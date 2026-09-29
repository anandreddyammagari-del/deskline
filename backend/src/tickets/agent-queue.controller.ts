import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DepartmentScopeGuard } from '../common/guards/department-scope.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller(['agent', 'api/agent'])
@UseGuards(JwtAuthGuard, RolesGuard, DepartmentScopeGuard)
@Roles(Role.AGENT, Role.MANAGER, Role.ADMIN)
export class AgentQueueController {
  constructor(private prisma: PrismaService) {}

  @Get('queue')
  async getQueue(@CurrentUser() user: AuthenticatedUser) {
    // In Phase 1, no tickets exist yet; returns empty array as Phase 2 groundwork
    return [];
  }
}
