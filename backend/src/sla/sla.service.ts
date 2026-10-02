import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Priority, TicketStatus } from '@prisma/client';
import {
  calculateDueDate,
  calculateBusinessMinutesElapsed,
  extendDueDate,
} from './sla-calculator';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches the company holiday date strings in 'YYYY-MM-DD' format.
   */
  async getHolidayDates(): Promise<string[]> {
    const holidays = await this.prisma.holiday.findMany({
      select: { date: true },
    });
    return holidays.map((h) => h.date.toISOString().split('T')[0]);
  }

  /**
   * Attaches an SLA tracking record when a ticket is created.
   */
  async createTicketSla(ticketId: string, priority: Priority, createdAt: Date) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { priority },
    });

    if (!policy) {
      this.logger.warn(`No SLA policy found for priority ${priority}`);
      return null;
    }

    const holidays = await this.getHolidayDates();

    const responseDueAt = calculateDueDate(
      createdAt,
      policy.responseMins,
      holidays,
    );

    const resolutionDueAt = calculateDueDate(
      createdAt,
      policy.resolutionMins,
      holidays,
    );

    return this.prisma.ticketSla.create({
      data: {
        ticketId,
        responseDueAt,
        resolutionDueAt,
      },
    });
  }

  /**
   * Pauses the SLA clock when ticket moves to WAITING_ON_REQUESTER.
   */
  async pauseSla(ticketId: string, pausedAt: Date = new Date()) {
    const sla = await this.prisma.ticketSla.findUnique({
      where: { ticketId },
    });

    if (!sla || sla.pausedAt) {
      return sla;
    }

    return this.prisma.ticketSla.update({
      where: { ticketId },
      data: {
        pausedAt,
      },
    });
  }

  /**
   * Resumes the SLA clock when ticket resumes to IN_PROGRESS.
   * Calculates elapsed working minutes, adds to totalPausedMins, and extends due dates.
   */
  async resumeSla(ticketId: string, resumedAt: Date = new Date()) {
    const sla = await this.prisma.ticketSla.findUnique({
      where: { ticketId },
    });

    if (!sla || !sla.pausedAt) {
      return sla;
    }

    const holidays = await this.getHolidayDates();
    const pausedBusinessMins = calculateBusinessMinutesElapsed(
      sla.pausedAt,
      resumedAt,
      holidays,
    );

    const newResponseDueAt = extendDueDate(
      sla.responseDueAt,
      pausedBusinessMins,
      holidays,
    );

    const newResolutionDueAt = extendDueDate(
      sla.resolutionDueAt,
      pausedBusinessMins,
      holidays,
    );

    return this.prisma.ticketSla.update({
      where: { ticketId },
      data: {
        pausedAt: null,
        totalPausedMins: {
          increment: pausedBusinessMins,
        },
        responseDueAt: newResponseDueAt,
        resolutionDueAt: newResolutionDueAt,
      },
    });
  }

  /**
   * Evaluates first response breach on transition to IN_PROGRESS.
   */
  async checkFirstResponse(ticketId: string, responseTime: Date = new Date()) {
    const sla = await this.prisma.ticketSla.findUnique({
      where: { ticketId },
    });

    if (!sla) return null;

    if (responseTime > sla.responseDueAt && !sla.responseBreached) {
      return this.prisma.ticketSla.update({
        where: { ticketId },
        data: { responseBreached: true },
      });
    }

    return sla;
  }

  /**
   * Evaluates resolution breach on transition to RESOLVED.
   */
  async checkResolution(ticketId: string, resolvedTime: Date = new Date()) {
    const sla = await this.prisma.ticketSla.findUnique({
      where: { ticketId },
    });

    if (!sla) return null;

    if (resolvedTime > sla.resolutionDueAt && !sla.resolutionBreached) {
      return this.prisma.ticketSla.update({
        where: { ticketId },
        data: { resolutionBreached: true },
      });
    }

    return sla;
  }
}
