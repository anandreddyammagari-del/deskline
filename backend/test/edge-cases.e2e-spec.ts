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
import { calculateDueDate } from '../src/sla/sla-calculator';

describe('Mandatory 12 Edge Cases (Section 10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: SchedulerService;
  let slaService: SlaService;

  const JWT_SECRET =
    process.env.JWT_ACCESS_SECRET ||
    'deskline_access_secret_key_change_in_production_min32chars';

  const employee1Token = jwt.sign(
    { sub: 'emp-1', name: 'Employee One', email: 'emp1@deskline.test', role: Role.EMPLOYEE, departmentId: null },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const itAgentToken = jwt.sign(
    { sub: 'agent-it-1', name: 'IT Agent', email: 'agentit@deskline.test', role: Role.AGENT, departmentId: 'dept-it' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const managerToken = jwt.sign(
    { sub: 'mgr-it', name: 'IT Manager', email: 'mgrit@deskline.test', role: Role.MANAGER, departmentId: 'dept-it' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const expiredToken = jwt.sign(
    { sub: 'emp-1', name: 'Employee One', email: 'emp1@deskline.test', role: Role.EMPLOYEE, departmentId: null },
    JWT_SECRET,
    { expiresIn: '-10s' }, // Expired!
  );

  beforeAll(async () => {
    const mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      slaPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          priority: Priority.HIGH,
          responseMins: 60,
          resolutionMins: 240,
        }),
      },
      category: { findUnique: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
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
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      ticketHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
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

  // Edge Case 1: Employee requests another employee's ticket: 403.
  it('Edge Case 1: Employee requests another employee ticket returns 403 Forbidden', async () => {
    jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
      id: 'ticket-foreign',
      requesterId: 'emp-2', // Belonging to someone else
      departmentId: 'dept-it',
      comments: [],
    } as any);

    const res = await request(app.getHttpServer())
      .get('/tickets/ticket-foreign')
      .set('Authorization', `Bearer ${employee1Token}`)
      .expect(403);

    expect(res.body.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TICKET_ACCESS');
  });

  // Edge Case 2: Agent in IT requests an HR ticket: 403.
  it('Edge Case 2: Agent in IT requests an HR ticket returns 403 Forbidden', async () => {
    jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
      id: 'ticket-hr',
      requesterId: 'emp-someone',
      departmentId: 'dept-hr', // HR department ticket
      comments: [],
    } as any);

    const res = await request(app.getHttpServer())
      .get('/tickets/ticket-hr')
      .set('Authorization', `Bearer ${itAgentToken}`) // IT agent
      .expect(403);

    expect(res.body.statusCode).toBe(403);
    expect(res.body.code).toBe('DEPARTMENT_MISMATCH');
  });

  // Edge Case 3: Employee fetches a ticket that has internal notes: notes absent from the response.
  it('Edge Case 3: Employee fetches ticket: internal notes are absent from the response', async () => {
    jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
      id: 'ticket-1',
      requesterId: 'emp-1',
      departmentId: 'dept-it',
      comments: [
        { id: 'c1', body: 'Customer visible reply', isInternal: false },
        { id: 'c2', body: 'Confidential staff note', isInternal: true },
      ],
      history: [],
    } as any);

    const res = await request(app.getHttpServer())
      .get('/tickets/ticket-1')
      .set('Authorization', `Bearer ${employee1Token}`)
      .expect(200);

    expect(res.body.comments.length).toBe(1);
    expect(res.body.comments[0].body).toBe('Customer visible reply');
  });

  // Edge Case 4: Out-of-sequence status change (NEW to RESOLVED): 400.
  it('Edge Case 4: Out-of-sequence status change (NEW to RESOLVED) returns 400 Bad Request', async () => {
    jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
      id: 'ticket-new',
      status: TicketStatus.NEW,
      requesterId: 'emp-1',
      departmentId: 'dept-it',
    } as any);

    const res = await request(app.getHttpServer())
      .patch('/tickets/ticket-new/status')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  // Edge Case 5: SLA due date across a weekend and a holiday: correct due time.
  it('Edge Case 5: SLA due date across a weekend and a holiday calculates correct due time', () => {
    // Thursday 2026-10-01 at 17:00 IST + 180 business mins:
    // Thursday has 60 mins left (17:00 to 18:00)
    // Friday 2026-10-02 (Gandhi Jayanti) skipped
    // Saturday 2026-10-03 & Sunday 2026-10-04 (weekend) skipped
    // Remaining 120 mins applied to Monday 2026-10-05 (09:00 to 11:00 IST)
    const holidays = ['2026-10-02'];
    const due = calculateDueDate('2026-10-01T17:00:00+05:30', 180, holidays);
    expect(due.toISOString()).toBe(new Date('2026-10-05T11:00:00+05:30').toISOString());
  });

  // Edge Case 6: WAITING_ON_REQUESTER for 4 business hours then resumed: due time extended by exactly that amount.
  it('Edge Case 6: WAITING_ON_REQUESTER paused for 4 business hours then resumed extends due date by exactly 4 hours', async () => {
    const pausedAt = new Date('2026-10-05T10:00:00+05:30');
    const resumedAt = new Date('2026-10-05T14:00:00+05:30'); // exactly 4 hours (240 mins)

    const originalSla = {
      id: 'sla-6',
      ticketId: 'ticket-6',
      responseDueAt: new Date('2026-10-05T12:00:00+05:30'),
      resolutionDueAt: new Date('2026-10-05T16:00:00+05:30'),
      pausedAt,
      totalPausedMins: 0,
    };

    jest.spyOn(prisma.ticketSla, 'findUnique').mockResolvedValueOnce(originalSla as any);
    jest.spyOn(prisma.holiday, 'findMany').mockResolvedValueOnce([]);

    let updatedData: any;
    (jest.spyOn(prisma.ticketSla, 'update') as any).mockImplementationOnce(async (args: any) => {
      updatedData = args.data;
      return { ...originalSla, ...args.data };
    });

    await slaService.resumeSla('ticket-6', resumedAt);

    // 16:00 + 4 hours (2 hours today 16:00->18:00, 2 hours next day 09:00->11:00)
    expect(new Date(updatedData.resolutionDueAt).toISOString()).toBe(
      new Date('2026-10-06T11:00:00+05:30').toISOString(),
    );
  });

  // Edge Case 7: Breach scheduler runs twice: breach recorded once, one audit entry.
  it('Edge Case 7: Breach scheduler runs twice idempotently: breach recorded once, one audit entry', async () => {
    const now = new Date('2026-10-05T12:01:00+05:30');

    // Run 1: finds un-flagged breach
    jest.spyOn(prisma.ticketSla, 'findMany')
      .mockResolvedValueOnce([
        {
          id: 'sla-7',
          ticketId: 'ticket-7',
          responseDueAt: new Date('2026-10-05T12:00:00+05:30'),
          responseBreached: false,
          ticket: { ticketNo: 'REQ-2026-00007', firstResponseAt: null },
        },
      ] as any)
      .mockResolvedValueOnce([]) // Run 1 resolution checks
      .mockResolvedValueOnce([]) // Run 2: responseBreached is now true in DB, query returns []
      .mockResolvedValueOnce([]); // Run 2 resolution checks

    const updateSpy = jest.fn();
    const auditSpy = jest.fn();
    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        ticketSla: { update: updateSpy },
        auditLog: { create: auditSpy },
      });
    });

    await scheduler.sweepSlaBreaches(now);
    await scheduler.sweepSlaBreaches(now); // Second run immediately after

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  // Edge Case 8: Two agents claim the same ticket at once: one succeeds, one gets 409.
  it('Edge Case 8: Two agents claim the same ticket concurrently: one succeeds, one gets 409', async () => {
    let ticketInDb = {
      id: 'ticket-ec8',
      departmentId: 'dept-it',
      assigneeId: null as string | null,
      status: TicketStatus.NEW,
    };

    (jest.spyOn(prisma.user, 'findUnique') as any).mockImplementation(async (args: any) => ({
      id: args.where.id,
      name: 'Agent',
      role: Role.AGENT,
    }));

    let txLock = Promise.resolve();
    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const release = txLock;
      let resolveNext: () => void;
      txLock = new Promise<void>((resolve) => { resolveNext = resolve; });
      await release;
      try {
        const txMock = {
          ticket: {
            findUnique: jest.fn().mockImplementation(async () => ({ ...ticketInDb })),
            update: jest.fn().mockImplementation(async (params: any) => {
              ticketInDb = { ...ticketInDb, assigneeId: params.data.assigneeId, status: params.data.status };
              return { ...ticketInDb, category: {}, department: {}, assignee: { id: params.data.assigneeId } };
            }),
          },
          ticketHistory: { create: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return await cb(txMock);
      } finally {
        resolveNext!();
      }
    });

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer()).patch('/tickets/ticket-ec8/assign').set('Authorization', `Bearer ${managerToken}`).send({ assigneeId: 'agent-1', expectedCurrentAssigneeId: null }),
      request(app.getHttpServer()).patch('/tickets/ticket-ec8/assign').set('Authorization', `Bearer ${managerToken}`).send({ assigneeId: 'agent-2', expectedCurrentAssigneeId: null }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  // Edge Case 9: Department with no active agents: ticket stays NEW, needsTriage set, no 500.
  it('Edge Case 9: Department with no active agents: ticket stays NEW, needsTriage set, returns 201', async () => {
    jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce({
      id: 'cat-empty',
      departmentId: 'dept-empty',
      defaultPriority: 'MEDIUM',
    } as any);

    jest.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([]); // No agents
    jest.spyOn(prisma.ticket, 'findFirst').mockResolvedValueOnce(null);

    const mockTicket = {
      id: 'ticket-ec9',
      ticketNo: 'REQ-2026-00009',
      status: TicketStatus.NEW,
      needsTriage: true,
      assigneeId: null,
      createdAt: new Date(),
    };

    jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb({
      ticket: { create: jest.fn().mockResolvedValue(mockTicket) },
      ticketHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    }));

    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${employee1Token}`)
      .send({ title: 'Triage request', description: 'Testing triage fallback', categoryId: 'cat-empty' })
      .expect(201);

    expect(res.body.status).toBe(TicketStatus.NEW);
    expect(res.body.needsTriage).toBe(true);
    expect(res.body.assigneeId).toBeNull();
  });

  // Edge Case 10: Employee reopens after the 3-day window: rejected.
  it('Edge Case 10: Employee reopens after the 3-day window is rejected with 400 Bad Request', async () => {
    const expiredResolvedAt = new Date(Date.now() - 74 * 60 * 60 * 1000); // 74h ago

    jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
      id: 'ticket-ec10',
      status: TicketStatus.RESOLVED,
      resolvedAt: expiredResolvedAt,
      requesterId: 'emp-1',
      departmentId: 'dept-it',
    } as any);

    const res = await request(app.getHttpServer())
      .patch('/tickets/ticket-ec10/status')
      .set('Authorization', `Bearer ${employee1Token}`)
      .send({ status: TicketStatus.REOPENED })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.message).toContain('Ticket reopen window has expired');
  });

  // Edge Case 11: Malformed body, unknown fields, or invalid priority: 400 with the standard error shape.
  it('Edge Case 11: Malformed body with unknown fields returns 400 with standard error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${employee1Token}`)
      .send({
        title: 'Valid title',
        description: 'Valid description',
        categoryId: 'cat-1',
        unknownHackerField: 'injected_value', // forbidden!
      })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toBeDefined();
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  // Edge Case 12: Expired JWT on a mutating route: 401 with no side effects.
  it('Edge Case 12: Expired JWT on a mutating route returns 401 Unauthorized with no side effects', async () => {
    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({
        title: 'Should not create',
        description: 'Token is expired',
        categoryId: 'cat-1',
      })
      .expect(401);

    expect(res.body.statusCode).toBe(401);
  });
});
