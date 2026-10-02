import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RoutingService } from '../routing/routing.service';
import { evaluateStatusTransition } from './state-machine/ticket-state-machine';
import {
  CreateTicketDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  CreateCommentDto,
} from './dto/ticket.dto';
import { SlaService } from '../sla/sla.service';
import { Role, TicketStatus, User } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routingService: RoutingService,
    private readonly slaService: SlaService,
  ) {}

  /**
   * Generates a sequential ticket number in the format REQ-YYYY-NNNNN
   */
  private async generateTicketNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}-`;

    const latest = await this.prisma.ticket.findFirst({
      where: {
        ticketNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNo: 'desc',
      },
      select: {
        ticketNo: true,
      },
    });

    let nextSeq = 1;
    if (latest && latest.ticketNo) {
      const parts = latest.ticketNo.split('-');
      const seqStr = parts[2];
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    const paddedSeq = nextSeq.toString().padStart(5, '0');
    return `${prefix}${paddedSeq}`;
  }

  /**
   * POST /tickets
   * Creates a new service request by an Employee.
   * Auto-assigns to the least-loaded agent via RoutingService.
   * If no agent is available, leaves ticket NEW with needsTriage = true, assigneeId = null (User Addition 3).
   */
  async createTicket(creator: User, dto: CreateTicketDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      include: { department: true },
    });

    if (!category) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Category does not exist',
        code: 'INVALID_CATEGORY',
      });
    }

    const priority = dto.priority || category.defaultPriority;
    const ticketNo = await this.generateTicketNo();

    // Auto-routing
    const routeResult = await this.routingService.findAssigneeForDepartment(
      category.departmentId,
    );

    const initialStatus = routeResult.assigned
      ? TicketStatus.ASSIGNED
      : TicketStatus.NEW;

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNo,
          title: dto.title,
          description: dto.description,
          priority,
          status: initialStatus,
          departmentId: category.departmentId,
          categoryId: category.id,
          requesterId: creator.id,
          assigneeId: routeResult.assigneeId,
          needsTriage: routeResult.needsTriage,
        },
        include: {
          category: true,
          department: true,
          requester: {
            select: { id: true, name: true, email: true, role: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      // Record in TicketHistory
      await tx.ticketHistory.create({
        data: {
          ticketId: created.id,
          actorId: creator.id,
          fromStatus: TicketStatus.NEW,
          toStatus: initialStatus,
          note: routeResult.assigned
            ? `Ticket created and auto-assigned to agent ${routeResult.assigneeId}`
            : 'Ticket created and placed in department triage queue',
        },
      });

      // Record in AuditLog
      await tx.auditLog.create({
        data: {
          actorId: creator.id,
          action: 'TICKET_CREATED',
          entity: 'Ticket',
          entityId: created.id,
          details: JSON.stringify({
            ticketNo,
            initialStatus,
            needsTriage: routeResult.needsTriage,
            assigneeId: routeResult.assigneeId,
          }),
        },
      });

      return created;
    });

    // Initialize SLA tracking in Phase 3
    await this.slaService.createTicketSla(ticket.id, priority, ticket.createdAt);

    return ticket;
  }

  /**
   * GET /tickets/mine
   * Returns tickets submitted by the authenticated employee.
   */
  async getRequesterTickets(requesterId: string) {
    return this.prisma.ticket.findMany({
      where: { requesterId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        department: true,
        assignee: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * GET /tickets
   * Role-scoped ticket listing:
   * - ADMIN sees all tickets
   * - AGENT / MANAGER sees only tickets within their department
   * - EMPLOYEE receives 403 Forbidden (must use /tickets/mine)
   */
  async getScopedTickets(user: User) {
    if (user.role === Role.EMPLOYEE) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Employees must use /tickets/mine to view their requests',
        code: 'FORBIDDEN_EMPLOYEE_QUEUE',
      });
    }

    if (user.role === Role.ADMIN) {
      return this.prisma.ticket.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          department: true,
          requester: {
            select: { id: true, name: true, email: true, role: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
    }

    // AGENT or MANAGER: Department scoped
    return this.prisma.ticket.findMany({
      where: {
        departmentId: user.departmentId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        department: true,
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * GET /agent/queue
   * Returns tickets assigned to the authenticated agent or in need of triage in their department.
   */
  async getAgentQueue(agent: User) {
    return this.prisma.ticket.findMany({
      where: {
        OR: [
          { assigneeId: agent.id },
          { departmentId: agent.departmentId ?? undefined, needsTriage: true },
        ],
        status: {
          notIn: [
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        category: true,
        department: true,
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * GET /tickets/:id
   * Edge Case 3: When requester (EMPLOYEE) fetches ticket, internal notes (isInternal: true)
   * MUST be stripped before returning.
   */
  async getTicketById(user: User, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        department: true,
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, role: true },
        },
        history: {
          orderBy: { at: 'desc' },
          include: {
            actor: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        sla: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Ticket not found',
        code: 'TICKET_NOT_FOUND',
      });
    }

    // Enforce scoping
    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You cannot view tickets submitted by other employees',
        code: 'FORBIDDEN_TICKET_ACCESS',
      });
    }

    if (
      (user.role === Role.AGENT || user.role === Role.MANAGER) &&
      user.departmentId !== ticket.departmentId
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You cannot view tickets outside your assigned department',
        code: 'DEPARTMENT_MISMATCH',
      });
    }

    // Edge Case 3: Strip internal comments for Employees
    if (user.role === Role.EMPLOYEE) {
      ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    }

    return ticket;
  }

  /**
   * PATCH /tickets/:id/status
   * Executes a status transition through the pure state machine.
   * Records TicketHistory and AuditLog.
   */
  async updateStatus(user: User, ticketId: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Ticket not found',
        code: 'TICKET_NOT_FOUND',
      });
    }

    // Role and department check
    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Cannot update status on tickets belonging to other employees',
        code: 'FORBIDDEN_STATUS_UPDATE',
      });
    }

    if (
      (user.role === Role.AGENT || user.role === Role.MANAGER) &&
      user.departmentId !== ticket.departmentId
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Cannot update status on tickets outside your department',
        code: 'DEPARTMENT_MISMATCH',
      });
    }

    // State machine check
    const transition = evaluateStatusTransition({
      currentStatus: ticket.status,
      targetStatus: dto.status,
      actorRole: user.role,
      actorId: user.id,
      requesterId: ticket.requesterId,
      assigneeId: ticket.assigneeId,
      resolvedAt: ticket.resolvedAt,
      note: dto.note,
    });

    if (!transition.allowed) {
      throw new BadRequestException({
        statusCode: 400,
        message: transition.reason || 'Invalid status transition',
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    // Execute state change in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: dto.status,
      };

      if (transition.firstResponseAtNeeded && !ticket.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }

      if (transition.setResolvedAt) {
        updateData.resolvedAt = new Date();
      }

      if (dto.status === TicketStatus.CLOSED) {
        updateData.closedAt = new Date();
      }

      if (transition.reopenResetNeeded) {
        updateData.resolvedAt = null;
      }

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          category: true,
          department: true,
          requester: {
            select: { id: true, name: true, email: true, role: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      // Ticket history
      await tx.ticketHistory.create({
        data: {
          ticketId,
          actorId: user.id,
          fromStatus: ticket.status,
          toStatus: dto.status,
          note: dto.note || null,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_STATUS_CHANGED',
          entity: 'Ticket',
          entityId: ticketId,
          details: JSON.stringify({
            fromStatus: ticket.status,
            toStatus: dto.status,
            note: dto.note,
          }),
        },
      });

      return updated;
    });

    // Phase 3 SLA Engine lifecycle hooks
    if (ticket.status === TicketStatus.ASSIGNED && dto.status === TicketStatus.IN_PROGRESS) {
      await this.slaService.checkFirstResponse(ticketId, new Date());
    }

    if (ticket.status === TicketStatus.WAITING_ON_REQUESTER && dto.status === TicketStatus.IN_PROGRESS) {
      await this.slaService.resumeSla(ticketId, new Date());
    }

    if (dto.status === TicketStatus.WAITING_ON_REQUESTER) {
      await this.slaService.pauseSla(ticketId, new Date());
    }

    if (dto.status === TicketStatus.RESOLVED) {
      await this.slaService.checkResolution(ticketId, new Date());
    }

    return result;
  }

  /**
   * PATCH /tickets/:id/assign
   * Assigns or reassigns ticket to an agent.
   * Edge Case 8: Concurrent assignment claim returning 409 Conflict.
   */
  async assignTicket(user: User, ticketId: string, dto: AssignTicketDto) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Only Managers and Admins can assign or reassign tickets',
        code: 'FORBIDDEN_ASSIGN',
      });
    }

    // Validate the target agent
    const targetAgent = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
    });

    if (!targetAgent || targetAgent.role !== Role.AGENT) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Target user must be an active Agent',
        code: 'INVALID_AGENT',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Ticket not found',
          code: 'TICKET_NOT_FOUND',
        });
      }

      if (user.role === Role.MANAGER && user.departmentId !== ticket.departmentId) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Managers cannot assign tickets outside their department',
          code: 'DEPARTMENT_MISMATCH',
        });
      }

      // Edge Case 8: Optimistic concurrency check
      // If client provided expectedCurrentAssigneeId, ensure it matches current assignee
      if (
        dto.expectedCurrentAssigneeId !== undefined &&
        ticket.assigneeId !== dto.expectedCurrentAssigneeId
      ) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Ticket assignment was modified concurrently by another user',
          code: 'CONCURRENT_ASSIGNMENT_CONFLICT',
        });
      }

      const nextStatus =
        ticket.status === TicketStatus.NEW ? TicketStatus.ASSIGNED : ticket.status;

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          assigneeId: targetAgent.id,
          needsTriage: false,
          status: nextStatus,
        },
        include: {
          category: true,
          department: true,
          assignee: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      await tx.ticketHistory.create({
        data: {
          ticketId,
          actorId: user.id,
          fromStatus: ticket.status,
          toStatus: nextStatus,
          note: `Reassigned from ${ticket.assigneeId || 'None'} to ${targetAgent.name}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_ASSIGNED',
          entity: 'Ticket',
          entityId: ticketId,
          details: JSON.stringify({
            previousAssigneeId: ticket.assigneeId,
            newAssigneeId: targetAgent.id,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * POST /tickets/:id/comments
   * Adds a public reply or internal staff note.
   * If an employee replies on a WAITING_ON_REQUESTER ticket, status automatically moves back to IN_PROGRESS.
   */
  async addComment(user: User, ticketId: string, dto: CreateCommentDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Ticket not found',
        code: 'TICKET_NOT_FOUND',
      });
    }

    // Role and department restrictions
    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Cannot comment on tickets belonging to other employees',
        code: 'FORBIDDEN_COMMENT_ACCESS',
      });
    }

    if (
      (user.role === Role.AGENT || user.role === Role.MANAGER) &&
      user.departmentId !== ticket.departmentId
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Cannot comment on tickets outside your department',
        code: 'DEPARTMENT_MISMATCH',
      });
    }

    // Employees can never create internal comments
    const isInternal = user.role === Role.EMPLOYEE ? false : Boolean(dto.isInternal);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: user.id,
          body: dto.body,
          isInternal,
        },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // Check auto-resumption: WAITING_ON_REQUESTER -> IN_PROGRESS on requester reply
      if (
        user.role === Role.EMPLOYEE &&
        ticket.status === TicketStatus.WAITING_ON_REQUESTER
      ) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.IN_PROGRESS },
        });

        await tx.ticketHistory.create({
          data: {
            ticketId,
            actorId: user.id,
            fromStatus: TicketStatus.WAITING_ON_REQUESTER,
            toStatus: TicketStatus.IN_PROGRESS,
            note: 'Ticket resumed to IN_PROGRESS via requester reply',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'COMMENT_ADDED',
          entity: 'TicketComment',
          entityId: comment.id,
          details: JSON.stringify({
            ticketId,
            isInternal,
          }),
        },
      });

      return comment;
    });
  }
}
