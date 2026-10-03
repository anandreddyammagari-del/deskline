import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Section 4.5 & Section 4.4: SLA Breach and Escalation Sweeper.
   * Runs every minute to detect breached response/resolution targets and trigger escalations.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepSlaBreaches(now: Date = new Date()) {
    const terminalStatuses: TicketStatus[] = [
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ];

    // 1. Response breach check: open tickets without firstResponseAt where responseDueAt < now
    const responseBreaches = await this.prisma.ticketSla.findMany({
      where: {
        responseBreached: false,
        responseDueAt: { lte: now },
        ticket: {
          firstResponseAt: null,
          status: { notIn: terminalStatuses },
        },
      },
      include: {
        ticket: true,
      },
    });

    for (const sla of responseBreaches) {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticketSla.update({
          where: { id: sla.id },
          data: { responseBreached: true },
        });

        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'SLA_RESPONSE_BREACHED',
            entity: 'Ticket',
            entityId: sla.ticketId,
            details: JSON.stringify({
              ticketNo: sla.ticket.ticketNo,
              responseDueAt: sla.responseDueAt,
              breachedAt: now,
            }),
          },
        });
      });
      this.logger.warn(`Response SLA breached for ticket ${sla.ticket.ticketNo}`);
    }

    // 2. Resolution breach and escalation check: open tickets where resolutionDueAt < now
    const resolutionBreaches = await this.prisma.ticketSla.findMany({
      where: {
        resolutionBreached: false,
        resolutionDueAt: { lte: now },
        ticket: {
          resolvedAt: null,
          status: { notIn: terminalStatuses },
        },
      },
      include: {
        ticket: true,
      },
    });

    for (const sla of resolutionBreaches) {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticketSla.update({
          where: { id: sla.id },
          data: {
            resolutionBreached: true,
            escalatedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'SLA_RESOLUTION_BREACHED_AND_ESCALATED',
            entity: 'Ticket',
            entityId: sla.ticketId,
            details: JSON.stringify({
              ticketNo: sla.ticket.ticketNo,
              resolutionDueAt: sla.resolutionDueAt,
              escalatedAt: now,
            }),
          },
        });
      });
      this.logger.warn(
        `Resolution SLA breached and escalated for ticket ${sla.ticket.ticketNo}`,
      );
    }
  }

  /**
   * Section 4.5 & Edge Case 10: Auto-close resolved tickets after 3 calendar days (72 hours).
   * Runs hourly (or programmatic invocation) to transition eligible tickets to CLOSED.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepAutoCloseResolved(now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - THREE_DAYS_MS);

    const eligibleTickets = await this.prisma.ticket.findMany({
      where: {
        status: TicketStatus.RESOLVED,
        resolvedAt: { lte: cutoff },
      },
    });

    for (const ticket of eligibleTickets) {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.CLOSED,
            closedAt: now,
          },
        });

        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            actorId: ticket.requesterId, // Attributed to system cycle on requester record
            fromStatus: TicketStatus.RESOLVED,
            toStatus: TicketStatus.CLOSED,
            note: 'Ticket auto-closed by system after 3 calendar days of resolution',
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'TICKET_AUTO_CLOSED',
            entity: 'Ticket',
            entityId: ticket.id,
            details: JSON.stringify({
              ticketNo: ticket.ticketNo,
              resolvedAt: ticket.resolvedAt,
              closedAt: now,
            }),
          },
        });
      });
      this.logger.log(`Ticket ${ticket.ticketNo} auto-closed after 72h`);
    }
  }
}
