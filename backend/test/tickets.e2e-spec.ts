import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role, TicketStatus } from '@prisma/client';

describe('Phase 2 Tickets Core Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const JWT_SECRET =
    process.env.JWT_ACCESS_SECRET ||
    'deskline_access_secret_key_change_in_production_min32chars';

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

  const itAgentToken = jwt.sign(
    {
      sub: 'mock-agent-it-1',
      name: 'IT Agent 1',
      email: 'itagent1@arrowstack.com',
      role: Role.AGENT,
      departmentId: 'dept-it-id',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

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

  const hrManagerToken = jwt.sign(
    {
      sub: 'mock-mgr-hr',
      name: 'HR Manager',
      email: 'hrmanager@arrowstack.com',
      role: Role.MANAGER,
      departmentId: 'dept-hr-id',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  beforeAll(async () => {
    const mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
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
        groupBy: jest.fn(),
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
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Edge Case 9: No Active Agents Triage Fallback', () => {
    it('creates ticket with status NEW, needsTriage: true, and assigneeId: null when department has no agents', async () => {
      // Mock category lookup
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce({
        id: 'cat-empty-dept',
        name: 'Empty Category',
        departmentId: 'dept-empty-id',
        defaultPriority: 'MEDIUM',
        createdAt: new Date(),
      } as any);

      // Routing lookup: find agents in dept -> empty
      jest.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([]);

      // Ticket number check
      jest.spyOn(prisma.ticket, 'findFirst').mockResolvedValueOnce(null);

      // Transaction mock
      const mockCreatedTicket = {
        id: 'ticket-triage-1',
        ticketNo: 'REQ-2026-00001',
        title: 'Need help with setup',
        description: 'No agents currently in this dept',
        priority: 'MEDIUM',
        status: TicketStatus.NEW,
        departmentId: 'dept-empty-id',
        categoryId: 'cat-empty-dept',
        requesterId: 'mock-emp-id',
        assigneeId: null,
        needsTriage: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-empty-dept', name: 'Empty Category' },
        department: { id: 'dept-empty-id', name: 'Empty Dept' },
        requester: { id: 'mock-emp-id', name: 'Test Employee', role: Role.EMPLOYEE },
        assignee: null,
      };

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const txMock = {
          ticket: {
            create: jest.fn().mockResolvedValue(mockCreatedTicket),
          },
          ticketHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(txMock);
      });

      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Need help with setup',
          description: 'No agents currently in this dept',
          categoryId: 'cat-empty-dept',
        })
        .expect(201);

      expect(res.body.status).toBe(TicketStatus.NEW);
      expect(res.body.needsTriage).toBe(true);
      expect(res.body.assigneeId).toBeNull();
      expect(res.body.ticketNo).toBe('REQ-2026-00001');
    });
  });

  describe('Edge Case 8: Concurrent Assignment Claim', () => {
    it('returns 409 Conflict when expectedCurrentAssigneeId does not match current state', async () => {
      // Mock target agent
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: 'mock-agent-it-2',
        name: 'IT Agent 2',
        role: Role.AGENT,
      } as any);

      // In transaction: ticket current assignee is already someone else
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const txMock = {
          ticket: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'ticket-concurrency-1',
              departmentId: 'dept-it-id',
              assigneeId: 'already-assigned-agent-3',
              status: TicketStatus.ASSIGNED,
            }),
          },
        };
        return cb(txMock);
      });

      const res = await request(app.getHttpServer())
        .patch('/tickets/ticket-concurrency-1/assign')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          assigneeId: 'mock-agent-it-2',
          expectedCurrentAssigneeId: 'mock-agent-it-1', // Stale expectation!
        })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.code).toBe('CONCURRENT_ASSIGNMENT_CONFLICT');
      expect(res.body.message).toContain('Ticket assignment was modified concurrently');
    });

    it('handles two simultaneous concurrent assignment requests (Promise.all) returning exactly one 200 and one 409', async () => {
      // Shared ticket state simulating database row
      let ticketInDb = {
        id: 'ticket-race-1',
        departmentId: 'dept-it-id',
        assigneeId: null as string | null,
        status: TicketStatus.NEW,
      };

      // Mock user lookups for both candidate agents
      (jest.spyOn(prisma.user, 'findUnique') as any).mockImplementation(async (args: any) => {
        if (args.where.id === 'mock-agent-it-1') {
          return { id: 'mock-agent-it-1', name: 'IT Agent 1', role: Role.AGENT } as any;
        }
        if (args.where.id === 'mock-agent-it-2') {
          return { id: 'mock-agent-it-2', name: 'IT Agent 2', role: Role.AGENT } as any;
        }
        return null;
      });

      // Transaction mock with mutex/isolation: exactly one transaction gets the initial state,
      // updates it, and the other sees the updated assigneeId and triggers 409
      let txLock = Promise.resolve();
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        // Queue transactions sequentially as PostgreSQL serializable/row-level lock would
        const release = txLock;
        let resolveNext: () => void;
        txLock = new Promise<void>((resolve) => {
          resolveNext = resolve;
        });

        await release;
        try {
          const txMock = {
            ticket: {
              findUnique: jest.fn().mockImplementation(async () => ({ ...ticketInDb })),
              update: jest.fn().mockImplementation(async (params: any) => {
                ticketInDb = {
                  ...ticketInDb,
                  assigneeId: params.data.assigneeId,
                  status: params.data.status,
                };
                return {
                  ...ticketInDb,
                  category: { name: 'IT Support' },
                  department: { name: 'IT' },
                  assignee: { id: params.data.assigneeId, name: 'Assigned Agent' },
                };
              }),
            },
            ticketHistory: { create: jest.fn().mockResolvedValue({}) },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          };
          return await cb(txMock);
        } finally {
          resolveNext!();
        }
      });

      // Both managers fire simultaneously believing current assignee is null
      const requestA = request(app.getHttpServer())
        .patch('/tickets/ticket-race-1/assign')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          assigneeId: 'mock-agent-it-1',
          expectedCurrentAssigneeId: null,
        });

      const requestB = request(app.getHttpServer())
        .patch('/tickets/ticket-race-1/assign')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          assigneeId: 'mock-agent-it-2',
          expectedCurrentAssigneeId: null,
        });

      const [resA, resB] = await Promise.all([requestA, requestB]);
      const statuses = [resA.status, resB.status].sort();

      // Exactly one request must succeed (200) and the other must be rejected (409)
      expect(statuses).toEqual([200, 409]);

      const conflictRes = resA.status === 409 ? resA : resB;
      expect(conflictRes.body.statusCode).toBe(409);
      expect(conflictRes.body.code).toBe('CONCURRENT_ASSIGNMENT_CONFLICT');
      expect(conflictRes.body.message).toContain('Ticket assignment was modified concurrently');
    });
  });

  describe('Edge Case 3: Stripping Internal Comments for Employees', () => {
    it('strips comments with isInternal: true when an Employee fetches ticket details', async () => {
      const mockTicket = {
        id: 'ticket-comments-1',
        ticketNo: 'REQ-2026-00002',
        requesterId: 'mock-emp-id',
        departmentId: 'dept-it-id',
        title: 'Hardware issue',
        description: 'Screen is flickering',
        status: TicketStatus.IN_PROGRESS,
        category: { name: 'Hardware' },
        department: { name: 'IT' },
        requester: { id: 'mock-emp-id', name: 'Test Employee' },
        assignee: { id: 'mock-agent-it-1', name: 'IT Agent 1' },
        history: [],
        comments: [
          {
            id: 'c1',
            authorId: 'mock-agent-it-1',
            body: 'Customer visible reply: We are checking your monitor model.',
            isInternal: false,
          },
          {
            id: 'c2',
            authorId: 'mock-agent-it-1',
            body: 'Internal staff note: Replacement stock is running low in IT room B.',
            isInternal: true,
          },
        ],
      };

      jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce(mockTicket as any);

      const res = await request(app.getHttpServer())
        .get('/tickets/ticket-comments-1')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0].isInternal).toBe(false);
      expect(res.body.comments[0].body).toContain('Customer visible reply');
      expect(
        res.body.comments.some((c: any) => c.body.includes('Internal staff note')),
      ).toBe(false);
    });
  });

  describe('Edge Case 4: Invalid Out-of-Sequence Status Transition', () => {
    it('returns 400 Bad Request when an invalid status transition is attempted', async () => {
      jest.spyOn(prisma.ticket, 'findUnique').mockResolvedValueOnce({
        id: 'ticket-seq-1',
        ticketNo: 'REQ-2026-00003',
        requesterId: 'mock-emp-id',
        departmentId: 'dept-it-id',
        status: TicketStatus.NEW,
        assigneeId: null,
      } as any);

      const res = await request(app.getHttpServer())
        .patch('/tickets/ticket-seq-1/status')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: TicketStatus.RESOLVED, // Cannot jump directly NEW -> RESOLVED
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      expect(res.body.message).toContain("NEW tickets must first be ASSIGNED or CANCELLED");
    });
  });

  describe('Department Scoping on Manager Assignment', () => {
    it('returns 403 Forbidden when HR Manager attempts to reassign an IT ticket', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: 'mock-agent-it-2',
        name: 'IT Agent 2',
        role: Role.AGENT,
      } as any);

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const txMock = {
          ticket: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'ticket-it-scope',
              departmentId: 'dept-it-id', // IT ticket
              assigneeId: 'mock-agent-it-1',
              status: TicketStatus.ASSIGNED,
            }),
          },
        };
        return cb(txMock);
      });

      const res = await request(app.getHttpServer())
        .patch('/tickets/ticket-it-scope/assign')
        .set('Authorization', `Bearer ${hrManagerToken}`) // HR Manager
        .send({
          assigneeId: 'mock-agent-it-2',
        })
        .expect(403);

      expect(res.body.statusCode).toBe(403);
      expect(res.body.code).toBe('DEPARTMENT_MISMATCH');
    });
  });
});
