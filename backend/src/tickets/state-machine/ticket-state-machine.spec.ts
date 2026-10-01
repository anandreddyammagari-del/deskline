import { Role, TicketStatus } from '@prisma/client';
import { evaluateStatusTransition } from './ticket-state-machine';

describe('TicketStateMachine (Pure Function)', () => {
  const requesterId = 'emp-001';
  const assigneeId = 'agent-001';
  const otherAgentId = 'agent-002';
  const managerId = 'manager-001';
  const adminId = 'admin-001';

  describe('NEW Status Transitions', () => {
    it('allows NEW -> ASSIGNED by System or Manager or Admin', () => {
      expect(
        evaluateStatusTransition({
          currentStatus: TicketStatus.NEW,
          targetStatus: TicketStatus.ASSIGNED,
          actorRole: 'SYSTEM',
          actorId: 'system',
          requesterId,
        }).allowed,
      ).toBe(true);

      expect(
        evaluateStatusTransition({
          currentStatus: TicketStatus.NEW,
          targetStatus: TicketStatus.ASSIGNED,
          actorRole: Role.MANAGER,
          actorId: managerId,
          requesterId,
        }).allowed,
      ).toBe(true);
    });

    it('rejects NEW -> ASSIGNED by unauthorized Employee or Agent', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.NEW,
        targetStatus: TicketStatus.ASSIGNED,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Only System, Manager, or Admin');
    });

    it('rejects out-of-sequence transitions like NEW -> RESOLVED (Edge Case 4)', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.NEW,
        targetStatus: TicketStatus.RESOLVED,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Invalid transition');
    });
  });

  describe('ASSIGNED Status Transitions', () => {
    it('allows ASSIGNED -> IN_PROGRESS by Assignee and flags firstResponseAtNeeded', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.ASSIGNED,
        targetStatus: TicketStatus.IN_PROGRESS,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(true);
      expect(res.firstResponseAtNeeded).toBe(true);
    });

    it('rejects ASSIGNED -> IN_PROGRESS by a non-assigned Agent', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.ASSIGNED,
        targetStatus: TicketStatus.IN_PROGRESS,
        actorRole: Role.AGENT,
        actorId: otherAgentId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(false);
    });
  });

  describe('IN_PROGRESS Status Transitions', () => {
    it('allows IN_PROGRESS -> WAITING_ON_REQUESTER by Assignee when note is provided', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.IN_PROGRESS,
        targetStatus: TicketStatus.WAITING_ON_REQUESTER,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
        note: 'Please provide error logs',
      });
      expect(res.allowed).toBe(true);
    });

    it('rejects IN_PROGRESS -> WAITING_ON_REQUESTER if note is missing', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.IN_PROGRESS,
        targetStatus: TicketStatus.WAITING_ON_REQUESTER,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
        note: '   ',
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('note is required');
    });

    it('allows IN_PROGRESS -> RESOLVED by Assignee or Manager and flags setResolvedAt', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.IN_PROGRESS,
        targetStatus: TicketStatus.RESOLVED,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(true);
      expect(res.setResolvedAt).toBe(true);
    });
  });

  describe('WAITING_ON_REQUESTER Status Transitions', () => {
    it('allows WAITING_ON_REQUESTER -> IN_PROGRESS when Employee replies', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.WAITING_ON_REQUESTER,
        targetStatus: TicketStatus.IN_PROGRESS,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(true);
    });

    it('allows WAITING_ON_REQUESTER -> IN_PROGRESS by Assignee', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.WAITING_ON_REQUESTER,
        targetStatus: TicketStatus.IN_PROGRESS,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        assigneeId,
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe('RESOLVED Status Transitions & 3-Day Window (Edge Case 10)', () => {
    const resolvedAt = new Date('2026-09-01T10:00:00Z');

    it('allows RESOLVED -> CLOSED by Requester', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.RESOLVED,
        targetStatus: TicketStatus.CLOSED,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
        resolvedAt,
      });
      expect(res.allowed).toBe(true);
    });

    it('allows RESOLVED -> REOPENED within 3 days (e.g. at 48 hours)', () => {
      const now = new Date('2026-09-03T10:00:00Z'); // exactly 48 hours later
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.RESOLVED,
        targetStatus: TicketStatus.REOPENED,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
        resolvedAt,
        now,
      });
      expect(res.allowed).toBe(true);
      expect(res.reopenResetNeeded).toBe(true);
    });

    it('rejects RESOLVED -> REOPENED after 3 days (e.g. at 73 hours - Edge Case 10)', () => {
      const now = new Date('2026-09-04T11:01:00Z'); // 73 hours and 1 minute later
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.RESOLVED,
        targetStatus: TicketStatus.REOPENED,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
        resolvedAt,
        now,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('reopen window has expired');
    });

    it('rejects RESOLVED -> REOPENED by non-requester staff', () => {
      const now = new Date('2026-09-02T10:00:00Z');
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.RESOLVED,
        targetStatus: TicketStatus.REOPENED,
        actorRole: Role.AGENT,
        actorId: assigneeId,
        requesterId,
        resolvedAt,
        now,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Only the ticket Requester');
    });
  });

  describe('Terminal Status Rules', () => {
    it('rejects any transition from CLOSED', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.CLOSED,
        targetStatus: TicketStatus.IN_PROGRESS,
        actorRole: Role.ADMIN,
        actorId: adminId,
        requesterId,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('permanently CLOSED');
    });

    it('rejects any transition from CANCELLED', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.CANCELLED,
        targetStatus: TicketStatus.NEW,
        actorRole: Role.ADMIN,
        actorId: adminId,
        requesterId,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('CANCELLED');
    });
  });

  describe('Cancellation Rules', () => {
    it('allows open tickets to be CANCELLED by Requester', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.IN_PROGRESS,
        targetStatus: TicketStatus.CANCELLED,
        actorRole: Role.EMPLOYEE,
        actorId: requesterId,
        requesterId,
      });
      expect(res.allowed).toBe(true);
    });

    it('allows open tickets to be CANCELLED by Admin', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.ASSIGNED,
        targetStatus: TicketStatus.CANCELLED,
        actorRole: Role.ADMIN,
        actorId: adminId,
        requesterId,
      });
      expect(res.allowed).toBe(true);
    });

    it('rejects cancellation by other unauthorized users', () => {
      const res = evaluateStatusTransition({
        currentStatus: TicketStatus.IN_PROGRESS,
        targetStatus: TicketStatus.CANCELLED,
        actorRole: Role.AGENT,
        actorId: otherAgentId,
        requesterId,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Only the ticket requester or an Administrator');
    });
  });
});
