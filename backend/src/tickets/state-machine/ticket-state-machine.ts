import { Role, TicketStatus } from '@prisma/client';

export interface TransitionContext {
  currentStatus: TicketStatus;
  targetStatus: TicketStatus;
  actorRole: Role | 'SYSTEM';
  actorId: string;
  requesterId: string;
  assigneeId?: string | null;
  resolvedAt?: Date | null;
  note?: string;
  now?: Date;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  firstResponseAtNeeded?: boolean;
  setResolvedAt?: boolean;
  reopenResetNeeded?: boolean;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function evaluateStatusTransition(ctx: TransitionContext): TransitionResult {
  const {
    currentStatus,
    targetStatus,
    actorRole,
    actorId,
    requesterId,
    assigneeId,
    resolvedAt,
    note,
    now = new Date(),
  } = ctx;

  // 1. Same status is a no-op / invalid transition
  if (currentStatus === targetStatus) {
    return {
      allowed: false,
      reason: `Ticket is already in status '${currentStatus}'`,
    };
  }

  // 2. Terminal statuses cannot be transitioned
  if (currentStatus === TicketStatus.CLOSED) {
    return {
      allowed: false,
      reason: "Ticket is permanently CLOSED and cannot be transitioned to any other status",
    };
  }
  if (currentStatus === TicketStatus.CANCELLED) {
    return {
      allowed: false,
      reason: "Ticket is CANCELLED and cannot be transitioned to any other status",
    };
  }

  // 3. CANCELLED: Allowed from any open status for Requester or Admin
  if (targetStatus === TicketStatus.CANCELLED) {
    const isRequester = actorRole === Role.EMPLOYEE && actorId === requesterId;
    const isAdmin = actorRole === Role.ADMIN || actorRole === 'SYSTEM';

    if (isRequester || isAdmin) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Only the ticket requester or an Administrator may cancel an open ticket",
    };
  }

  // 4. State transition table rules
  switch (currentStatus) {
    case TicketStatus.NEW:
      if (targetStatus === TicketStatus.ASSIGNED) {
        if (actorRole === 'SYSTEM' || actorRole === Role.MANAGER || actorRole === Role.ADMIN) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: "Only System, Manager, or Admin may assign a NEW ticket",
        };
      }
      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. NEW tickets must first be ASSIGNED or CANCELLED.`,
      };

    case TicketStatus.ASSIGNED:
      if (targetStatus === TicketStatus.IN_PROGRESS) {
        const isAssignee = actorId === assigneeId;
        const isManagerOrAdmin = actorRole === Role.MANAGER || actorRole === Role.ADMIN || actorRole === 'SYSTEM';

        if (isAssignee || isManagerOrAdmin) {
          return { allowed: true, firstResponseAtNeeded: true };
        }
        return {
          allowed: false,
          reason: "Only the assigned Agent, Manager, or Admin may move ticket to IN_PROGRESS",
        };
      }
      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. ASSIGNED tickets can only move to IN_PROGRESS or CANCELLED.`,
      };

    case TicketStatus.IN_PROGRESS:
      if (targetStatus === TicketStatus.WAITING_ON_REQUESTER) {
        const isAssignee = actorId === assigneeId;
        if (!isAssignee) {
          return {
            allowed: false,
            reason: "Only the assigned Agent may move ticket to WAITING_ON_REQUESTER",
          };
        }
        if (!note || note.trim().length === 0) {
          return {
            allowed: false,
            reason: "A explanatory note is required when moving ticket to WAITING_ON_REQUESTER",
          };
        }
        return { allowed: true };
      }

      if (targetStatus === TicketStatus.RESOLVED) {
        const isAssignee = actorId === assigneeId;
        const isManager = actorRole === Role.MANAGER || actorRole === Role.ADMIN;
        if (isAssignee || isManager) {
          return { allowed: true, setResolvedAt: true };
        }
        return {
          allowed: false,
          reason: "Only the assigned Agent or Manager may mark a ticket as RESOLVED",
        };
      }

      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. IN_PROGRESS tickets can only move to WAITING_ON_REQUESTER, RESOLVED, or CANCELLED.`,
      };

    case TicketStatus.WAITING_ON_REQUESTER:
      if (targetStatus === TicketStatus.IN_PROGRESS) {
        const isAssignee = actorId === assigneeId;
        const isRequester = actorId === requesterId;
        const isStaff = actorRole === Role.MANAGER || actorRole === Role.ADMIN;

        if (isAssignee || isRequester || isStaff) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: "Only the assigned Agent or the Requester replying may resume ticket to IN_PROGRESS",
        };
      }
      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. WAITING_ON_REQUESTER tickets can only move to IN_PROGRESS or CANCELLED.`,
      };

    case TicketStatus.RESOLVED:
      if (targetStatus === TicketStatus.CLOSED) {
        const isRequester = actorId === requesterId;
        const isSystemOrScheduler = actorRole === 'SYSTEM' || actorRole === Role.ADMIN;
        if (isRequester || isSystemOrScheduler) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: "Only the Requester or the Scheduler/Admin may CLOSE a resolved ticket",
        };
      }

      if (targetStatus === TicketStatus.REOPENED) {
        const isRequester = actorId === requesterId;
        if (!isRequester) {
          return {
            allowed: false,
            reason: "Only the ticket Requester may REOPEN a resolved ticket",
          };
        }

        // Time gate: within 3 calendar days (72 hours) of resolvedAt
        if (!resolvedAt) {
          return {
            allowed: false,
            reason: "Cannot reopen ticket without resolution timestamp",
          };
        }

        // TODO [Phase 3 / SLA Engine]: This is option (b) - a temporary placeholder check
        // using plain Date arithmetic (72 hours). In Phase 3, this will be replaced wholesale
        // with the Luxon/IANA-timezone SLA calculation service (Section 14, Issue 4) to ensure
        // unified calendar-day arithmetic without timezone drift.
        const elapsedMs = now.getTime() - new Date(resolvedAt).getTime();
        if (elapsedMs > THREE_DAYS_MS) {
          return {
            allowed: false,
            reason: "Ticket reopen window has expired. Tickets cannot be reopened after 3 calendar days (72 hours) from resolution.",
          };
        }

        return { allowed: true, reopenResetNeeded: true };
      }

      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. RESOLVED tickets can only be CLOSED, REOPENED (within 3 days), or CANCELLED.`,
      };

    case TicketStatus.REOPENED:
      if (targetStatus === TicketStatus.IN_PROGRESS) {
        const isAssignee = actorId === assigneeId;
        const isManager = actorRole === Role.MANAGER || actorRole === Role.ADMIN;
        if (isAssignee || isManager) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: "Only the assigned Agent or Manager may move a REOPENED ticket to IN_PROGRESS",
        };
      }
      return {
        allowed: false,
        reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. REOPENED tickets can only move to IN_PROGRESS or CANCELLED.`,
      };

    default:
      return {
        allowed: false,
        reason: `Unknown or unhandled status: '${currentStatus}'`,
      };
  }
}
