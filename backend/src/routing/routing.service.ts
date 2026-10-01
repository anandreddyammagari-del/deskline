import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role, TicketStatus } from '@prisma/client';

export interface RouteAssignmentResult {
  assigned: boolean;
  assigneeId: string | null;
  needsTriage: boolean;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Section 4.3: Least-loaded active agent in the target department.
   * "Active" agent: User with role AGENT assigned to departmentId.
   * Workload: Count of open tickets (status NOT IN ['RESOLVED', 'CLOSED', 'CANCELLED']).
   * Tie-breaking: Agent with oldest last-assigned ticket, or oldest createdAt if never assigned.
   * Edge Case 9: If department has no active agents, leaves ticket in NEW, needsTriage = true, assigneeId = null.
   */
  async findAssigneeForDepartment(departmentId: string): Promise<RouteAssignmentResult> {
    // 1. Fetch all agents belonging to the specified department
    const agents = await this.prisma.user.findMany({
      where: {
        role: Role.AGENT,
        departmentId: departmentId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (agents.length === 0) {
      this.logger.warn(`No active agents found in department ${departmentId}. Ticket marked for triage.`);
      return {
        assigned: false,
        assigneeId: null,
        needsTriage: true,
      };
    }

    const agentIds = agents.map((a) => a.id);

    // 2. Count active open tickets per agent
    const terminalStatuses: TicketStatus[] = [
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ];

    const openTicketCounts = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: agentIds },
        status: { notIn: terminalStatuses },
      },
      _count: {
        id: true,
      },
    });

    const workloadMap = new Map<string, number>();
    agentIds.forEach((id) => workloadMap.set(id, 0));
    openTicketCounts.forEach((group) => {
      if (group.assigneeId) {
        workloadMap.set(group.assigneeId, group._count.id);
      }
    });

    // 3. For tie-breaking, fetch the most recent ticket assignment timestamp per agent
    const lastAssignedPerAgent = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: agentIds },
      },
      _max: {
        createdAt: true,
      },
    });

    const lastAssignedMap = new Map<string, Date | null>();
    agentIds.forEach((id) => lastAssignedMap.set(id, null));
    lastAssignedPerAgent.forEach((group) => {
      if (group.assigneeId) {
        lastAssignedMap.set(group.assigneeId, group._max.createdAt);
      }
    });

    // 4. Sort agents by least workload, then oldest last-assigned (or oldest user createdAt)
    const sortedAgents = [...agents].sort((a, b) => {
      const loadA = workloadMap.get(a.id) ?? 0;
      const loadB = workloadMap.get(b.id) ?? 0;

      if (loadA !== loadB) {
        return loadA - loadB; // fewest open tickets first
      }

      // Tie-breaker: oldest last-assigned ticket
      const lastA = lastAssignedMap.get(a.id);
      const lastB = lastAssignedMap.get(b.id);

      const timeA = lastA ? lastA.getTime() : 0; // never assigned comes first
      const timeB = lastB ? lastB.getTime() : 0;

      if (timeA !== timeB) {
        return timeA - timeB; // older assignment date first
      }

      // Final deterministic fallback: oldest agent creation date
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const chosen = sortedAgents[0];

    return {
      assigned: true,
      assigneeId: chosen.id,
      needsTriage: false,
    };
  }
}
