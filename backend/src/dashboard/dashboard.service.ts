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

    // 4. Completed tickets for SLA compliance rate and average resolution time via native SQL aggregation
    interface CompletedStats {
      total_completed: number;
      met_count: number;
      avg_resolution_mins: number;
    }

    const completedStats = departmentId
      ? await this.prisma.$queryRaw<CompletedStats[]>`
          SELECT 
            COUNT(s.id)::int AS total_completed,
            COUNT(CASE WHEN s."resolutionBreached" = false THEN 1 END)::int AS met_count,
            COALESCE(AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 60), 0)::float AS avg_resolution_mins
          FROM tickets t
          LEFT JOIN ticket_slas s ON s."ticketId" = t.id
          WHERE t."departmentId" = ${departmentId}
            AND t.status IN ('RESOLVED', 'CLOSED') 
            AND t."resolvedAt" IS NOT NULL
        `
      : await this.prisma.$queryRaw<CompletedStats[]>`
          SELECT 
            COUNT(s.id)::int AS total_completed,
            COUNT(CASE WHEN s."resolutionBreached" = false THEN 1 END)::int AS met_count,
            COALESCE(AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 60), 0)::float AS avg_resolution_mins
          FROM tickets t
          LEFT JOIN ticket_slas s ON s."ticketId" = t.id
          WHERE t.status IN ('RESOLVED', 'CLOSED') 
            AND t."resolvedAt" IS NOT NULL
        `;

    let slaMetPercent = 100;
    let avgResolutionMinutes = 0;

    if (completedStats && completedStats.length > 0 && completedStats[0].total_completed > 0) {
      const stats = completedStats[0];
      slaMetPercent = Math.round((stats.met_count / stats.total_completed) * 100);
      avgResolutionMinutes = Math.round(stats.avg_resolution_mins);
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
   * Buckets open tickets by age: <1d, 1-3d, 3-7d, >7d using native database aggregation.
   */
  async getBacklogAging(user: User): Promise<BacklogAgingResponse> {
    const departmentId = this.getDepartmentScope(user);

    interface AgingRow {
      under1Day: number;
      from1To3Days: number;
      from3To7Days: number;
      over7Days: number;
    }

    const agingStats = departmentId
      ? await this.prisma.$queryRaw<AgingRow[]>`
          SELECT 
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 86400 THEN 1 END)::int AS "under1Day",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 86400 AND EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 259200 THEN 1 END)::int AS "from1To3Days",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 259200 AND EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 604800 THEN 1 END)::int AS "from3To7Days",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 604800 THEN 1 END)::int AS "over7Days"
          FROM tickets
          WHERE "departmentId" = ${departmentId}
            AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'REOPENED')
        `
      : await this.prisma.$queryRaw<AgingRow[]>`
          SELECT 
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 86400 THEN 1 END)::int AS "under1Day",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 86400 AND EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 259200 THEN 1 END)::int AS "from1To3Days",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 259200 AND EXTRACT(EPOCH FROM (NOW() - "createdAt")) < 604800 THEN 1 END)::int AS "from3To7Days",
            COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) >= 604800 THEN 1 END)::int AS "over7Days"
          FROM tickets
          WHERE status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'REOPENED')
        `;

    if (agingStats && agingStats.length > 0) {
      return {
        under1Day: agingStats[0].under1Day ?? 0,
        from1To3Days: agingStats[0].from1To3Days ?? 0,
        from3To7Days: agingStats[0].from3To7Days ?? 0,
        over7Days: agingStats[0].over7Days ?? 0,
      };
    }

    return {
      under1Day: 0,
      from1To3Days: 0,
      from3To7Days: 0,
      over7Days: 0,
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
