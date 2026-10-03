import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role, TicketStatus } from '@prisma/client';

describe('Phase 4 Dashboard Endpoints Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const JWT_SECRET =
    process.env.JWT_ACCESS_SECRET ||
    'deskline_access_secret_key_change_in_production_min32chars';

  const managerToken = jwt.sign(
    {
      sub: 'mock-mgr-it',
      name: 'IT Manager',
      email: 'itmanager@arrowstack.com',
      role: Role.MANAGER,
      departmentId: 'dept-it-id',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const employeeToken = jwt.sign(
    {
      sub: 'mock-emp-id',
      name: 'Test Employee',
      email: 'employee@arrowstack.com',
      role: Role.EMPLOYEE,
      departmentId: null,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  beforeAll(async () => {
    const mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      ticket: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /dashboard/summary', () => {
    it('returns calculated metrics scoped to department for Manager', async () => {
      // 1. openCount = 42
      // 2. needsTriageCount = 3
      // 3. breachedCount = 2
      jest.spyOn(prisma.ticket, 'count')
        .mockResolvedValueOnce(42) // open count
        .mockResolvedValueOnce(3)  // needs triage count
        .mockResolvedValueOnce(2); // breached count

      // completed tickets for SLA % and avg resolution
      jest.spyOn(prisma.ticket, 'findMany').mockResolvedValueOnce([
        {
          createdAt: new Date('2026-10-01T09:00:00Z'),
          resolvedAt: new Date('2026-10-01T11:00:00Z'),
          sla: { resolutionBreached: false },
        },
        {
          createdAt: new Date('2026-10-01T09:00:00Z'),
          resolvedAt: new Date('2026-10-01T15:00:00Z'),
          sla: { resolutionBreached: true },
        },
      ] as any);

      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.openCount).toBe(42);
      expect(res.body.needsTriageCount).toBe(3);
      expect(res.body.breachedCount).toBe(2);
      expect(res.body.slaMetPercent).toBe(50); // 1 of 2 met
      expect(res.body.avgResolutionMinutes).toBe(240); // (120 + 360)/2 = 240 mins
    });

    it('rejects Employee with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  describe('GET /dashboard/backlog-aging', () => {
    it('buckets open tickets into aging brackets', async () => {
      const now = new Date();
      const h12 = new Date(now.getTime() - 12 * 60 * 60 * 1000); // under 1 day
      const d2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 1-3 days
      const d5 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 3-7 days
      const d10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // over 7 days

      jest.spyOn(prisma.ticket, 'findMany').mockResolvedValueOnce([
        { createdAt: h12 },
        { createdAt: d2 },
        { createdAt: d5 },
        { createdAt: d10 },
      ] as any);

      const res = await request(app.getHttpServer())
        .get('/dashboard/backlog-aging')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body).toEqual({
        under1Day: 1,
        from1To3Days: 1,
        from3To7Days: 1,
        over7Days: 1,
      });
    });
  });

  describe('GET /dashboard/workload', () => {
    it('returns open ticket distribution per agent in the department', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([
        { id: 'agent-1', name: 'Ravi Mehta' },
        { id: 'agent-2', name: 'Kavita Patel' },
      ] as any);

      jest.spyOn(prisma.ticket as any, 'groupBy').mockResolvedValueOnce([
        { assigneeId: 'agent-1', _count: { id: 14 } },
        { assigneeId: 'agent-2', _count: { id: 8 } },
      ] as any);

      const res = await request(app.getHttpServer())
        .get('/dashboard/workload')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body).toEqual([
        { agentId: 'agent-1', agentName: 'Ravi Mehta', openTicketCount: 14 },
        { agentId: 'agent-2', agentName: 'Kavita Patel', openTicketCount: 8 },
      ]);
    });
  });
});
