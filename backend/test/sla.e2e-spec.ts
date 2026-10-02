import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { SlaService } from '../src/sla/sla.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role, TicketStatus, Priority } from '@prisma/client';

describe('Phase 3 SLA Engine & Scheduler Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: SchedulerService;
  let slaService: SlaService;

  const JWT_SECRET =
    process.env.JWT_ACCESS_SECRET ||
    'deskline_access_secret_key_change_in_production_min32chars';

  const employeeToken = jwt.sign(
    {
      sub: 'mock-emp-1',
      name: 'Test Employee',
      email: 'employee@arrowstack.com',
      role: Role.EMPLOYEE,
      departmentId: null,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const agentToken = jwt.sign(
    {
      sub: 'mock-agent-1',
      name: 'IT Agent',
      email: 'agent@arrowstack.com',
      role: Role.AGENT,
      departmentId: 'dept-it-1',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  beforeAll(async () => {
    const mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      holiday: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      slaPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          priority: Priority.HIGH,
          responseMins: 60,
          resolutionMins: 240,
        }),
      },
      category: {
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      ticket: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ticketSla: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ticketHistory: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
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
    scheduler = app.get<SchedulerService>(SchedulerService);
    slaService = app.get<SlaService>(SlaService);
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('SLA Pause and Resume Due Date Extension', () => {
    it('extends response and resolution due dates when ticket resumes from WAITING_ON_REQUESTER', async () => {
      // 1. Initial SLA created at Monday 10:00 IST
      // Response due at 11:00 IST (60 mins), Resolution due at 14:00 IST (240 mins)
      const pausedAt = new Date('2026-10-05T10:30:00+05:30'); // paused at 10:30 IST
      const resumedAt = new Date('2026-10-05T11:30:00+05:30'); // resumed at 11:30 IST (60 business mins paused)

      const originalSla = {
        id: 'sla-1',
        ticketId: 'ticket-1',
        responseDueAt: new Date('2026-10-05T11:00:00+05:30'),
        resolutionDueAt: new Date('2026-10-05T14:00:00+05:30'),
        pausedAt,
        totalPausedMins: 0,
        responseBreached: false,
        resolutionBreached: false,
      };

      jest.spyOn(prisma.ticketSla, 'findUnique').mockResolvedValueOnce(originalSla as any);
      jest.spyOn(prisma.holiday, 'findMany').mockResolvedValueOnce([]);

      let updatedData: any;
      (jest.spyOn(prisma.ticketSla, 'update') as any).mockImplementationOnce(async (args: any) => {
        updatedData = args.data;
        return { ...originalSla, ...args.data };
      });

      await slaService.resumeSla('ticket-1', resumedAt);

      expect(updatedData.pausedAt).toBeNull();
      // Due dates extended by 60 mins:
      // Response: 11:00 -> 12:00 IST
      // Resolution: 14:00 -> 15:00 IST
      expect(new Date(updatedData.responseDueAt).toISOString()).toBe(
        new Date('2026-10-05T12:00:00+05:30').toISOString(),
      );
      expect(new Date(updatedData.resolutionDueAt).toISOString()).toBe(
        new Date('2026-10-05T15:00:00+05:30').toISOString(),
      );
    });
  });

  describe('Scheduler SLA Breach Sweeper', () => {
    it('detects un-responded breached tickets and flags responseBreached', async () => {
      const now = new Date('2026-10-05T12:01:00+05:30');
      const pastDue = new Date('2026-10-05T12:00:00+05:30');

      jest.spyOn(prisma.ticketSla, 'findMany')
        .mockResolvedValueOnce([
          {
            id: 'sla-breach-1',
            ticketId: 'ticket-breach-1',
            responseDueAt: pastDue,
            responseBreached: false,
            ticket: { ticketNo: 'REQ-2026-00010', firstResponseAt: null },
          },
        ] as any)
        .mockResolvedValueOnce([]); // no resolution breaches

      const updateSpy = jest.fn();
      const auditSpy = jest.fn();
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          ticketSla: { update: updateSpy },
          auditLog: { create: auditSpy },
        });
      });

      await scheduler.sweepSlaBreaches(now);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'sla-breach-1' },
        data: { responseBreached: true },
      });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SLA_RESPONSE_BREACHED',
            entityId: 'ticket-breach-1',
          }),
        }),
      );
    });
  });

  describe('Scheduler 72-Hour Auto-Close Sweeper (Section 4.5 & Edge Case 10)', () => {
    it('automatically closes tickets in RESOLVED status older than 72 calendar hours', async () => {
      const now = new Date('2026-10-05T12:00:00Z');
      const resolvedAt = new Date('2026-10-02T11:00:00Z'); // 73 hours ago

      jest.spyOn(prisma.ticket, 'findMany').mockResolvedValueOnce([
        {
          id: 'ticket-auto-close-1',
          ticketNo: 'REQ-2026-00099',
          status: TicketStatus.RESOLVED,
          resolvedAt,
          requesterId: 'mock-emp-1',
        },
      ] as any);

      const ticketUpdateSpy = jest.fn();
      const historySpy = jest.fn();
      const auditSpy = jest.fn();

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          ticket: { update: ticketUpdateSpy },
          ticketHistory: { create: historySpy },
          auditLog: { create: auditSpy },
        });
      });

      await scheduler.sweepAutoCloseResolved(now);

      expect(ticketUpdateSpy).toHaveBeenCalledWith({
        where: { id: 'ticket-auto-close-1' },
        data: {
          status: TicketStatus.CLOSED,
          closedAt: now,
        },
      });

      expect(historySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'ticket-auto-close-1',
            fromStatus: TicketStatus.RESOLVED,
            toStatus: TicketStatus.CLOSED,
          }),
        }),
      );
    });
  });
});
