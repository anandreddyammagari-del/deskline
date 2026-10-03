import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthService {
  private loginAttempts = new Map<string, RateLimitRecord>();

  constructor(private prisma: PrismaService) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private checkLoginRateLimit(ip: string): void {
    const now = Date.now();
    const record = this.loginAttempts.get(ip);

    if (record) {
      if (now > record.resetAt) {
        this.loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
        return;
      }

      if (record.count >= 5) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many login attempts. Please try again after 1 minute.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      record.count += 1;
    } else {
      this.loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    }
  }

  async login(loginDto: LoginDto, ip: string = '127.0.0.1') {
    this.checkLoginRateLimit(ip);

    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
      include: { department: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const accessSecret =
      process.env.JWT_ACCESS_SECRET || 'deskline_access_secret_key_change_in_production_min32chars';
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'deskline_refresh_secret_key_change_in_production_min32chars';

    const accessToken = jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
      accessSecret,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        jti: crypto.randomUUID(),
      },
      refreshSecret,
      { expiresIn: '7d' },
    );

    // Store SHA-256 hash of refresh token (immune to bcrypt 72-byte truncation)
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'deskline_refresh_secret_key_change_in_production_min32chars';

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, refreshSecret);
    } catch (err: any) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const incomingHash = this.hashToken(refreshToken);
    const isMatch =
      incomingHash.length === user.refreshTokenHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(incomingHash, 'utf8'),
        Buffer.from(user.refreshTokenHash, 'utf8'),
      );

    if (!isMatch) {
      // Possible token reuse attack! Revoke existing token immediately
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token already used or revoked');
    }

    // Issue rotated tokens
    const accessSecret =
      process.env.JWT_ACCESS_SECRET || 'deskline_access_secret_key_change_in_production_min32chars';

    const newAccessToken = jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
      accessSecret,
      { expiresIn: '15m' },
    );

    const newRefreshToken = jwt.sign(
      {
        sub: user.id,
        jti: crypto.randomUUID(),
      },
      refreshSecret,
      { expiresIn: '7d' },
    );

    const newRefreshTokenHash = this.hashToken(newRefreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }
}
