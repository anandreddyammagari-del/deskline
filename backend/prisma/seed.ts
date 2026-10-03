import { PrismaClient, Role, Priority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting baseline database seeding...');

  // 1. Departments
  const itDept = await prisma.department.upsert({
    where: { name: 'IT' },
    update: {},
    create: { name: 'IT' },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: 'HR' },
    update: {},
    create: { name: 'HR' },
  });

  const facilitiesDept = await prisma.department.upsert({
    where: { name: 'FACILITIES' },
    update: {},
    create: { name: 'FACILITIES' },
  });

  console.log('[Seed] Seeded 3 departments (IT, HR, FACILITIES)');

  // 2. Categories
  const categories = [
    // IT Categories
    { name: 'Hardware Failure', departmentId: itDept.id, defaultPriority: Priority.HIGH },
    { name: 'Software Provisioning', departmentId: itDept.id, defaultPriority: Priority.MEDIUM },
    { name: 'VPN & Access', departmentId: itDept.id, defaultPriority: Priority.HIGH },
    { name: 'Network Outage', departmentId: itDept.id, defaultPriority: Priority.URGENT },

    // HR Categories
    { name: 'Leave Policy', departmentId: hrDept.id, defaultPriority: Priority.LOW },
    { name: 'Benefits & Insurance', departmentId: hrDept.id, defaultPriority: Priority.LOW },
    { name: 'Payroll Discrepancy', departmentId: hrDept.id, defaultPriority: Priority.HIGH },
    { name: 'Onboarding Request', departmentId: hrDept.id, defaultPriority: Priority.MEDIUM },

    // Facilities Categories
    { name: 'Desk & Ergonomics', departmentId: facilitiesDept.id, defaultPriority: Priority.LOW },
    { name: 'AC & Climate Control', departmentId: facilitiesDept.id, defaultPriority: Priority.MEDIUM },
    { name: 'Keycard & Access Pass', departmentId: facilitiesDept.id, defaultPriority: Priority.HIGH },
    { name: 'Sanitation & Cleaning', departmentId: facilitiesDept.id, defaultPriority: Priority.LOW },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: {
        name_departmentId: {
          name: cat.name,
          departmentId: cat.departmentId,
        },
      },
      update: { defaultPriority: cat.defaultPriority },
      create: cat,
    });
  }
  console.log(`[Seed] Seeded ${categories.length} categories`);

  // 3. SLA Policies
  const slaPolicies = [
    { priority: Priority.URGENT, responseMins: 30, resolutionMins: 240 },
    { priority: Priority.HIGH, responseMins: 60, resolutionMins: 480 },
    { priority: Priority.MEDIUM, responseMins: 240, resolutionMins: 1440 },
    { priority: Priority.LOW, responseMins: 480, resolutionMins: 4320 },
  ];

  for (const policy of slaPolicies) {
    await prisma.slaPolicy.upsert({
      where: { priority: policy.priority },
      update: { responseMins: policy.responseMins, resolutionMins: policy.resolutionMins },
      create: policy,
    });
  }
  console.log('[Seed] Seeded 4 SLA policies (URGENT, HIGH, MEDIUM, LOW)');

  // 4. Holidays (Asia/Kolkata 2026 calendar dates)
  const holidays = [
    { date: new Date('2026-01-26T00:00:00.000Z'), name: 'Republic Day' },
    { date: new Date('2026-08-15T00:00:00.000Z'), name: 'Independence Day' },
    { date: new Date('2026-10-02T00:00:00.000Z'), name: 'Gandhi Jayanti' },
    { date: new Date('2026-11-08T00:00:00.000Z'), name: 'Diwali' },
    { date: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas' },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { date: holiday.date },
      update: { name: holiday.name },
      create: holiday,
    });
  }
  console.log(`[Seed] Seeded ${holidays.length} holidays`);

  // 5. Users
  const employeePasswordHash = await bcrypt.hash('Employee123!', 10);
  const agentPasswordHash = await bcrypt.hash('Agent123!', 10);
  const managerPasswordHash = await bcrypt.hash('Manager123!', 10);
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

  // Employees (No department)
  await prisma.user.upsert({
    where: { email: 'asha.rao@deskline.test' },
    update: { passwordHash: employeePasswordHash, role: Role.EMPLOYEE },
    create: {
      name: 'Asha Rao',
      email: 'asha.rao@deskline.test',
      passwordHash: employeePasswordHash,
      role: Role.EMPLOYEE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'vikram.shah@deskline.test' },
    update: { passwordHash: employeePasswordHash, role: Role.EMPLOYEE },
    create: {
      name: 'Vikram Shah',
      email: 'vikram.shah@deskline.test',
      passwordHash: employeePasswordHash,
      role: Role.EMPLOYEE,
    },
  });

  // Manager (IT Department)
  const managerMeera = await prisma.user.upsert({
    where: { email: 'meera.kapoor@deskline.test' },
    update: {
      passwordHash: managerPasswordHash,
      role: Role.MANAGER,
      departmentId: itDept.id,
    },
    create: {
      name: 'Meera Kapoor',
      email: 'meera.kapoor@deskline.test',
      passwordHash: managerPasswordHash,
      role: Role.MANAGER,
      departmentId: itDept.id,
    },
  });

  // Agents (at least 2 per department per Section 12)
  const agents = [
    // IT Agents
    { name: 'Ravi Mehta', email: 'ravi.mehta@deskline.test', departmentId: itDept.id, managerId: managerMeera.id },
    { name: 'Kavita Patel', email: 'kavita.patel@deskline.test', departmentId: itDept.id, managerId: managerMeera.id },

    // HR Agents
    { name: 'Sunita Iyer', email: 'sunita.iyer@deskline.test', departmentId: hrDept.id, managerId: null },
    { name: 'Amit Verma', email: 'amit.verma@deskline.test', departmentId: hrDept.id, managerId: null },

    // Facilities Agents
    { name: 'Prakash Nair', email: 'prakash.nair@deskline.test', departmentId: facilitiesDept.id, managerId: null },
    { name: 'Deepa Sharma', email: 'deepa.sharma@deskline.test', departmentId: facilitiesDept.id, managerId: null },
  ];

  for (const agent of agents) {
    await prisma.user.upsert({
      where: { email: agent.email },
      update: {
        passwordHash: agentPasswordHash,
        role: Role.AGENT,
        departmentId: agent.departmentId,
        managerId: agent.managerId,
      },
      create: {
        name: agent.name,
        email: agent.email,
        passwordHash: agentPasswordHash,
        role: Role.AGENT,
        departmentId: agent.departmentId,
        managerId: agent.managerId,
      },
    });
  }

  // Admin (No department)
  await prisma.user.upsert({
    where: { email: 'arjun.desai@deskline.test' },
    update: { passwordHash: adminPasswordHash, role: Role.ADMIN },
    create: {
      name: 'Arjun Desai',
      email: 'arjun.desai@deskline.test',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  console.log('[Seed] Seeded demo users: 2 Employees, 1 Manager, 6 Agents, 1 Admin');
  console.log('[Seed] Baseline database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
