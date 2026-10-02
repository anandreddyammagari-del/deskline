import { PrismaClient, Priority, TicketStatus, Role } from '@prisma/client';
import { calculateDueDate } from '../src/sla/sla-calculator';

const prisma = new PrismaClient();

const SAMPLE_TITLES = [
  'VPN disconnects intermittently',
  'Software license activation failed',
  'Monitor flickering when plugged into dock',
  'Keyboard key stuck',
  'Request for dual monitor setup',
  'Payroll calculation error in bonus',
  'Annual leave quota query',
  'Health insurance dependent addition',
  'Desk chair lumbar support broken',
  'Air conditioning too cold in zone 4',
  'Keycard lost, need temporary replacement',
  'Cleaning requested for meeting room 3B',
  'Access request for AWS staging account',
  'Slack notification delay',
  'Laptop battery health degraded',
  'Ergonomic mousepad request',
  'Printer paper jam on 2nd floor',
  'Whiteboard marker restock needed',
  'Expense report approval pending',
  'Tax deduction form query',
];

const SAMPLE_DESCRIPTIONS = [
  'User is unable to complete urgent work due to this service interruption. Please assist promptly.',
  'Happened starting early this morning after system reboot. Error code displayed in dialog.',
  'Followed standard self-service troubleshooting steps without resolution.',
  'Request submitted on behalf of incoming project onboarding requirements.',
  'Requires routine maintenance inspection by the facilities operations team.',
];

/**
 * Large Scale Seed Generator (10,000 realistic tickets)
 * Uses real SLA due-date calculations and valid state machine transitions.
 */
export async function generateLargeScaleSeed(targetCount = 10000) {
  console.log(`[LargeSeed] Initiating generation of ${targetCount} realistic tickets...`);

  // 1. Fetch departments, categories, users, holidays, and policies
  const [departments, categories, users, holidays, slaPolicies] = await Promise.all([
    prisma.department.findMany(),
    prisma.category.findMany(),
    prisma.user.findMany(),
    prisma.holiday.findMany(),
    prisma.slaPolicy.findMany(),
  ]);

  if (departments.length === 0 || categories.length === 0 || users.length === 0) {
    throw new Error('Baseline data missing. Please run baseline seed first.');
  }

  const holidayDateStrings = holidays.map((h) => h.date.toISOString().split('T')[0]);
  const policyMap = new Map<Priority, { responseMins: number; resolutionMins: number }>();
  slaPolicies.forEach((p) => {
    policyMap.set(p.priority, { responseMins: p.responseMins, resolutionMins: p.resolutionMins });
  });

  const employees = users.filter((u) => u.role === Role.EMPLOYEE);
  const agents = users.filter((u) => u.role === Role.AGENT);
  const managers = users.filter((u) => u.role === Role.MANAGER);

  const agentsByDept = new Map<string, string[]>();
  departments.forEach((d) => agentsByDept.set(d.id, []));
  agents.forEach((a) => {
    if (a.departmentId) {
      agentsByDept.get(a.departmentId)?.push(a.id);
    }
  });

  const categoriesByDept = new Map<string, typeof categories>();
  departments.forEach((d) => categoriesByDept.set(d.id, []));
  categories.forEach((c) => {
    categoriesByDept.get(c.departmentId)?.push(c);
  });

  // Distribution weights for realistic simulation:
  // Closed/Resolved: ~70%, In Progress/Assigned: ~20%, New/Triage: ~5%, Waiting: ~5%
  const statuses: TicketStatus[] = [
    TicketStatus.CLOSED,
    TicketStatus.RESOLVED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.ASSIGNED,
    TicketStatus.WAITING_ON_REQUESTER,
    TicketStatus.NEW,
  ];

  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(targetCount / BATCH_SIZE);

  const baseInstant = new Date('2026-07-01T09:00:00Z').getTime();
  const endInstant = new Date('2026-09-30T18:00:00Z').getTime();
  const timeSpanMs = endInstant - baseInstant;

  let globalCounter = 1;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const currentBatchCount = Math.min(BATCH_SIZE, targetCount - batchIdx * BATCH_SIZE);
    const ticketsData: any[] = [];
    const slasData: any[] = [];
    const historiesData: any[] = [];

    for (let i = 0; i < currentBatchCount; i++) {
      const ticketNo = `REQ-2026-${(globalCounter++).toString().padStart(5, '0')}`;
      const dept = departments[i % departments.length];
      const deptCategories = categoriesByDept.get(dept.id) || categories;
      const category = deptCategories[i % deptCategories.length];
      const requester = employees[i % employees.length];
      const deptAgents = agentsByDept.get(dept.id) || [];
      const priority = category.defaultPriority;

      // Random createdAt spread across past 3 months
      const createdTimeMs = baseInstant + Math.floor(Math.random() * timeSpanMs);
      const createdAt = new Date(createdTimeMs);

      // Determine realistic status
      const randStatus = Math.random();
      let status: TicketStatus;
      let assigneeId: string | null = null;
      let needsTriage = false;
      let firstResponseAt: Date | null = null;
      let resolvedAt: Date | null = null;
      let closedAt: Date | null = null;

      if (randStatus < 0.50) {
        status = TicketStatus.CLOSED;
      } else if (randStatus < 0.70) {
        status = TicketStatus.RESOLVED;
      } else if (randStatus < 0.85) {
        status = TicketStatus.IN_PROGRESS;
      } else if (randStatus < 0.93) {
        status = TicketStatus.ASSIGNED;
      } else if (randStatus < 0.97) {
        status = TicketStatus.WAITING_ON_REQUESTER;
      } else {
        status = TicketStatus.NEW;
      }

      // Assignee logic
      if (status !== TicketStatus.NEW) {
        if (deptAgents.length > 0) {
          assigneeId = deptAgents[i % deptAgents.length];
        } else {
          status = TicketStatus.NEW;
          needsTriage = true;
        }
      } else {
        // Some new tickets need triage
        needsTriage = Math.random() < 0.3;
      }

      // Compute SLA targets via pure SLA engine
      const policy = policyMap.get(priority) || { responseMins: 60, resolutionMins: 240 };
      const responseDueAt = calculateDueDate(createdAt, policy.responseMins, holidayDateStrings);
      const resolutionDueAt = calculateDueDate(createdAt, policy.resolutionMins, holidayDateStrings);

      // Populate lifecycle timestamps according to status
      const responseMs = createdAt.getTime() + Math.floor(policy.responseMins * 60 * 1000 * (0.4 + Math.random() * 0.8));
      firstResponseAt = status !== TicketStatus.NEW && status !== TicketStatus.ASSIGNED
        ? new Date(responseMs)
        : null;

      if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
        const resolutionMs = createdAt.getTime() + Math.floor(policy.resolutionMins * 60 * 1000 * (0.6 + Math.random() * 0.7));
        resolvedAt = new Date(resolutionMs);
      }

      if (status === TicketStatus.CLOSED && resolvedAt) {
        // Auto-closed 72h after resolvedAt or manually closed
        closedAt = new Date(resolvedAt.getTime() + 72 * 60 * 60 * 1000);
      }

      const responseBreached = Boolean(firstResponseAt && firstResponseAt > responseDueAt);
      const resolutionBreached = Boolean(resolvedAt && resolvedAt > resolutionDueAt);

      const ticketId = `gen-tkt-${batchIdx * BATCH_SIZE + i + 1}`;

      ticketsData.push({
        id: ticketId,
        ticketNo,
        title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
        description: SAMPLE_DESCRIPTIONS[i % SAMPLE_DESCRIPTIONS.length],
        categoryId: category.id,
        departmentId: dept.id,
        requesterId: requester.id,
        assigneeId,
        priority,
        status,
        needsTriage,
        firstResponseAt,
        resolvedAt,
        closedAt,
        createdAt,
        updatedAt: closedAt || resolvedAt || firstResponseAt || createdAt,
      });

      slasData.push({
        id: `gen-sla-${batchIdx * BATCH_SIZE + i + 1}`,
        ticketId,
        responseDueAt,
        resolutionDueAt,
        pausedAt: status === TicketStatus.WAITING_ON_REQUESTER ? new Date() : null,
        totalPausedMins: status === TicketStatus.WAITING_ON_REQUESTER ? 30 : 0,
        responseBreached,
        resolutionBreached,
        escalatedAt: resolutionBreached ? resolutionDueAt : null,
      });

      // Ticket history reflecting state machine path
      historiesData.push({
        id: `gen-hist-${batchIdx * BATCH_SIZE + i + 1}`,
        ticketId,
        actorId: requester.id,
        fromStatus: TicketStatus.NEW,
        toStatus: status,
        note: `Initial state transition to ${status}`,
        at: createdAt,
      });
    }

    // Insert batch using createMany for high-throughput insertion
    await prisma.ticket.createMany({ data: ticketsData });
    await prisma.ticketSla.createMany({ data: slasData });
    await prisma.ticketHistory.createMany({ data: historiesData });

    console.log(`[LargeSeed] Inserted batch ${batchIdx + 1}/${totalBatches} (${ticketsData.length} tickets)`);
  }

  const finalCount = await prisma.ticket.count();
  console.log(`[LargeSeed] Completed large scale seeding! Total tickets in database: ${finalCount}`);
}

// Allow direct execution: npx ts-node prisma/large-seed.ts
if (require.main === module) {
  generateLargeScaleSeed()
    .catch((err) => {
      console.error('[LargeSeed] Generation failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
