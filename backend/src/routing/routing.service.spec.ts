import { Test, TestingModule } from '@nestjs/testing';
import { RoutingService } from './routing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role, TicketStatus } from '@prisma/client';

describe('RoutingService', () => {
  let service: RoutingService;
  let prisma: {
    user: { findMany: jest.Mock };
    ticket: { groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
      },
      ticket: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
  });

  it('Edge Case 9: returns needsTriage = true and assigneeId = null when no agents exist in department', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.findAssigneeForDepartment('dept-empty');

    expect(result).toEqual({
      assigned: false,
      assigneeId: null,
      needsTriage: true,
    });
    expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
  });

  it('selects the least-loaded agent when workload differs', async () => {
    const agent1 = { id: 'agent-1', name: 'Agent One', createdAt: new Date('2026-01-01') };
    const agent2 = { id: 'agent-2', name: 'Agent Two', createdAt: new Date('2026-01-02') };
    prisma.user.findMany.mockResolvedValue([agent1, agent2]);

    // Workload: agent1 has 3 open tickets, agent2 has 1 open ticket
    prisma.ticket.groupBy
      .mockResolvedValueOnce([
        { assigneeId: 'agent-1', _count: { id: 3 } },
        { assigneeId: 'agent-2', _count: { id: 1 } },
      ])
      // Last assigned
      .mockResolvedValueOnce([
        { assigneeId: 'agent-1', _max: { createdAt: new Date('2026-09-01') } },
        { assigneeId: 'agent-2', _max: { createdAt: new Date('2026-09-02') } },
      ]);

    const result = await service.findAssigneeForDepartment('dept-it');

    expect(result).toEqual({
      assigned: true,
      assigneeId: 'agent-2',
      needsTriage: false,
    });
  });

  it('breaks ties using oldest last-assigned ticket when workloads are equal', async () => {
    const agent1 = { id: 'agent-1', name: 'Agent One', createdAt: new Date('2026-01-01') };
    const agent2 = { id: 'agent-2', name: 'Agent Two', createdAt: new Date('2026-01-02') };
    prisma.user.findMany.mockResolvedValue([agent1, agent2]);

    // Workload: both have 2 open tickets
    prisma.ticket.groupBy
      .mockResolvedValueOnce([
        { assigneeId: 'agent-1', _count: { id: 2 } },
        { assigneeId: 'agent-2', _count: { id: 2 } },
      ])
      // Last assigned: agent1 was assigned yesterday, agent2 was assigned 5 days ago
      .mockResolvedValueOnce([
        { assigneeId: 'agent-1', _max: { createdAt: new Date('2026-09-10') } },
        { assigneeId: 'agent-2', _max: { createdAt: new Date('2026-09-05') } },
      ]);

    const result = await service.findAssigneeForDepartment('dept-it');

    // agent2 has the older assignment timestamp, so agent2 is chosen
    expect(result).toEqual({
      assigned: true,
      assigneeId: 'agent-2',
      needsTriage: false,
    });
  });

  it('prioritizes agent who has never been assigned any ticket over an assigned agent', async () => {
    const agent1 = { id: 'agent-1', name: 'Agent One', createdAt: new Date('2026-01-01') };
    const agent2 = { id: 'agent-2', name: 'Agent Two', createdAt: new Date('2026-01-02') };
    prisma.user.findMany.mockResolvedValue([agent1, agent2]);

    // Both have 0 open tickets
    prisma.ticket.groupBy
      .mockResolvedValueOnce([])
      // agent1 was assigned a ticket long ago (now resolved), agent2 has never had a ticket
      .mockResolvedValueOnce([
        { assigneeId: 'agent-1', _max: { createdAt: new Date('2026-05-01') } },
      ]);

    const result = await service.findAssigneeForDepartment('dept-it');

    // agent2 (never assigned, time = 0) should be prioritized
    expect(result).toEqual({
      assigned: true,
      assigneeId: 'agent-2',
      needsTriage: false,
    });
  });
});
