import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TicketStatus, User, Role } from '@prisma/client';

export interface DashboardSummaryResponse {
  openCount: number;
  breachedCount: number;
  slaMetPercent: number;
  avgResolutionMinutes: number;
  needsTriageCount: number;
}

export interface BacklogAgingResponse {
  under1Day: number;
  from1To3Days: number;
  from3To7Days: number;
  over7Days: number;
}

export interface WorkloadDistributionItem {
  agentId: string;
  agentName: string;
  openTicketCount: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getDepartmentScope(user: User): string | null {
    if (user.role === Role.ADMIN) {
      return null; // Admins view global enterprise scope
    }
    return user.departmentId;
  }

  /**
   * GET /dashboard/summary
   * Returns: Open tickets count, breached SLA count, SLA compliance %, average resolution minutes.
   */
  async getSummary(user: User): Promise<DashboardSummaryResponse> {
    const departmentId = this.getDepartmentScope(user);

    const openStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_ON_REQUESTER,
      TicketStatus.REOPENED,
    ];

    const whereScope: any = departmentId ? { departmentId } : {};

    // 1. Open count
    const openCount = await this.prisma.ticket.count({
      where: {
        ...whereScope,
        status: { in: openStatuses },
      },
    });

    // 2. Needs triage count
    const needsTriageCount = await this.prisma.ticket.count({
      where: {
        ...whereScope,
        needsTriage: true,
        status: { in: openStatuses },
      },
    });

    // 3. Breached count: open tickets where response or resolution is breached
    const breachedCount = await this.prisma.ticket.count({
      where: {
        ...whereScope,
        status: { in: openStatuses },
        sla: {
          OR: [{ responseBreached: true }, { resolutionBreached: true }],
        },
      },
    });

    // 4. Completed tickets for SLA compliance rate and average resolution time
    const completedTickets = await this.prisma.ticket.findMany({
      where: {
        ...whereScope,
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
        sla: {
          select: {
            resolutionBreached: true,
          },
        },
      },
      take: 1000, // sample most recent 1000 for bounded sub-millisecond calculation
      orderBy: { resolvedAt: 'desc' },
    });

    let slaMetPercent = 100;
    let avgResolutionMinutes = 0;

    if (completedTickets.length > 0) {
      const metCount = completedTickets.filter(
        (t) => !t.sla || !t.sla.resolutionBreached,
      ).length;
      slaMetPercent = Math.round((metCount / completedTickets.length) * 100);

      const totalResolutionMs = completedTickets.reduce((acc, t) => {
        const diff = t.resolvedAt!.getTime() - t.createdAt.getTime();
        return acc + Math.max(0, diff);
      }, 0);

      avgResolutionMinutes = Math.round(
        totalResolutionMs / (completedTickets.length * 60 * 1000),
      );
    }

    return {
      openCount,
      breachedCount,
      slaMetPercent,
      avgResolutionMinutes,
      needsTriageCount,
    };
  }

  /**
   * GET /dashboard/backlog-aging
   * Buckets open tickets by age: <1d, 1-3d, 3-7d, >7d.
   */
  async getBacklogAging(user: User): Promise<BacklogAgingResponse> {
    const departmentId = this.getDepartmentScope(user);
    const now = new Date();

    const openStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_ON_REQUESTER,
      TicketStatus.REOPENED,
    ];

    const whereScope: any = departmentId ? { departmentId } : {};

    const openTickets = await this.prisma.ticket.findMany({
      where: {
        ...whereScope,
        status: { in: openStatuses },
      },
      select: {
        createdAt: true,
      },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    let under1Day = 0;
    let from1To3Days = 0;
    let from3To7Days = 0;
    let over7Days = 0;

    for (const ticket of openTickets) {
      const ageDays = (now.getTime() - ticket.createdAt.getTime()) / dayMs;
      if (ageDays < 1) {
        under1Day++;
      } else if (ageDays < 3) {
        from1To3Days++;
      } else if (ageDays < 7) {
        from3To7Days++;
      } else {
        over7Days++;
      }
    }

    return {
      under1Day,
      from1To3Days,
      from3To7Days,
      over7Days,
    };
  }

  /**
   * GET /dashboard/workload
   * Returns open ticket counts distributed per active agent in the department.
   */
  async getWorkload(user: User): Promise<WorkloadDistributionItem[]> {
    const departmentId = this.getDepartmentScope(user);

    const openStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_ON_REQUESTER,
      TicketStatus.REOPENED,
    ];

    const whereAgents: any = { role: Role.AGENT };
    if (departmentId) {
      whereAgents.departmentId = departmentId;
    }

    const agents = await this.prisma.user.findMany({
      where: whereAgents,
      select: { id: true, name: true },
    });

    const agentIds = agents.map((a) => a.id);

    const workloadCounts = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: agentIds },
        status: { in: openStatuses },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map<string, number>();
    workloadCounts.forEach((group) => {
      if (group.assigneeId) {
        countMap.set(group.assigneeId, group._count.id);
      }
    });

    return agents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      openTicketCount: countMap.get(agent.id) ?? 0,
    }));
  }
}
