# Deskline: Employee Service Request System

> Internal service desk portal for IT, HR, and Facilities requests with strict SLA enforcement, least-loaded auto-routing, and role-based confidentiality.

---

## 1. Quick Start (Setup in Three Commands)

Ensure Docker Desktop is running, then execute:

```bash
# 1. Clone and enter the repository
git clone https://github.com/anandreddyammagari-del/deskline.git && cd deskline

# 2. Copy the environment variables template
cp .env.example .env

# 3. Build and boot the entire stack (PostgreSQL, NestJS API, Web SPA)
docker compose up --build -d
```

Access the application in your browser:
- **Web Portal**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health) (via proxy)
- **Direct Backend API**: [http://localhost:4000/health](http://localhost:4000/health)

---

## 2. Seed Accounts & Roles (Simulated Demo Credentials)

The system is pre-configured with the following demo personas:

| Role | Name | Email | Password | Department | Primary Responsibilities |
|---|---|---|---|---|---|
| **Employee** | Asha Rao | `asha.rao@deskline.test` | `Employee123!` | — | Create requests, view own tickets, reply, reopen within 3 days. |
| **Employee** | Vikram Shah | `vikram.shah@deskline.test` | `Employee123!` | — | Create requests, view own tickets. |
| **Agent** | Ravi Mehta | `ravi.mehta@deskline.test` | `Agent123!` | IT | View IT queue, claim tickets, pause/resume, resolve, internal notes. |
| **Agent** | Sunita Iyer | `sunita.iyer@deskline.test` | `Agent123!` | HR | View HR queue, claim tickets, resolve requests. |
| **Agent** | Prakash Nair | `prakash.nair@deskline.test` | `Agent123!` | Facilities | View Facilities queue, claim tickets, resolve requests. |
| **Manager** | Meera Kapoor | `meera.kapoor@deskline.test` | `Manager123!` | IT | Department dashboard, triage unassigned tickets, team workload. |
| **Admin** | Arjun Desai | `admin@deskline.test` | `Admin123!` | — | Manage SLA policies, categories, user accounts, audit ledger. |

*Quick Access Evaluator*: Mentors can use `/evaluator-login` for one-click authentication into any seeded role.

---

## 3. Architecture Overview

Deskline utilizes a strict single-origin proxy architecture to eliminate cross-origin cookie sharing issues:

```
+--------------------+            +-------------------------------------------+
| React 18 + Vite    |  /api/*    | NestJS Backend API                        |
| Role Workspaces    | ---------> | Guards: Auth, Roles, Dept Scope, Ownership|
| Nginx Reverse Proxy|            | Modules: Auth, Users, Tickets, Routing,   |
+--------------------+            |          SLA, Comments, Dashboard, Admin  |
                                  +-------------------------------------------+
                                                        |
                                                  Prisma Client
                                                        |
                                                        v
                                          +---------------------------+
                                          | PostgreSQL 16 (UTC)       |
                                          +---------------------------+
```

- **Frontend**: React 18, TypeScript, Vite, custom tokens matching Jira Service Management aesthetic (neutral 1px borders, Public Sans, no marketing gradients).
- **Backend**: NestJS modular application with strict DTO validation (`whitelist: true`, `forbidNonWhitelisted: true`) and standardized error shape `{ statusCode, message, code }`.
- **Database**: PostgreSQL with Prisma ORM; all timestamps in UTC (`timestamptz`).
- **Security**: JWT access tokens (15m in memory), refresh tokens (7d in httpOnly cookie scoped to `/auth`), bcrypt (cost 10), login rate limiter.

---

## 4. Running Tests & Timezone Verification

```bash
# Backend unit tests (SLA pure functions, state machine, routing logic)
cd backend && npm test

# Timezone-invariant verification (verified across multiple system timezones)
cd backend && npm run test:sla-tz

# Automated edge case clearance tests (covers all 12 mandatory edge cases)
cd backend && npm run test:e2e
```

---

## 5. 7–8 Minute Demo Script (Evaluation Walkthrough)

Follow this structured script to demonstrate the system end-to-end:

1. **Context & Problem Overview (1 min)**:
   - Introduce Deskline: A high-integrity employee service portal solving cross-department request tracking (IT, HR, Facilities) with strict SLA computation and role boundaries.
   - Highlight the single-origin architecture (React frontend + NestJS backend via Nginx reverse proxy on port 3000) preventing cookie issues.

2. **Employee Experience (1.5 min)**:
   - Log in as `asha.rao@deskline.test` (or via one-click evaluator login).
   - Submit a new IT Support request (Priority: High).
   - Observe automatic routing: Ticket is instantly routed to the least-loaded IT agent (`ravi.mehta@deskline.test`) using strict active-ticket count and tie-breaker sorting.
   - Show that employee cannot see other employees' requests or internal notes.

3. **Agent Workflow & SLA Pause/Resume (2 min)**:
   - Log in as `ravi.mehta@deskline.test`.
   - Open the newly assigned ticket.
   - Post an internal note (verify only agents/managers see this).
   - Transition status from `ASSIGNED` to `WAITING_FOR_EMPLOYEE` with reason: *"Awaiting laptop serial number"*.
   - Verify SLA clock pauses: Due date shifts dynamically to protect resolution SLA during customer wait time.
   - Resume ticket: Add employee reply or transition to `IN_PROGRESS`. SLA clock resumes with new calculated deadline.
   - Transition to `RESOLVED` with mandatory resolution note.

4. **Reopen Window vs. Auto-Close (1 min)**:
   - Switch back to `asha.rao@deskline.test`.
   - Reopen ticket within the 72-hour window: Status returns to `IN_PROGRESS` and route assignee is maintained.
   - Explain the 72-hour auto-close: After 72 hours without employee activity, background scheduler automatically moves resolved tickets to `CLOSED`.

5. **Manager Analytics & Workload (1 min)**:
   - Log in as `meera.kapoor@deskline.test` (IT Department Manager).
   - View IT Dashboard: Breach rates, active backlog aging buckets (<24h, 24-48h, >48h), and real-time agent workload bar distribution.
   - Verify Department Scoping: IT manager cannot see HR or Facilities data.

6. **Security & Guard Enforcement Proof (1 min)**:
   - Demonstrate API-level protection: An employee calling `PATCH /tickets/:id/transition` or attempting to read `/dashboard/summary` receives HTTP 403 Forbidden with `{ "statusCode": 403, "error": "FORBIDDEN", "message": "..." }`.
   - Direct database inspect: Timestamps are stored in pure UTC.

7. **Test Suite Clearance (0.5 min)**:
   - Show `npm run test:e2e`: 12/12 mandatory edge cases passing (61/61 total tests passing).

---

## 6. Requirements Traceability Matrix

A complete mapping from PRD Requirements (AC-01 through AC-15) to implementation files, controllers, services, and e2e test cases is documented in:
👉 [`docs/traceability.md`](docs/traceability.md)

---

## 7. Known Limitations

1. **Email / SMS**: Notifications are logged to system stdout/audit logs rather than dispatched via external SMTP/SMS gateways.
2. **File Attachments**: Ticket descriptions and comments support text only; binary file upload attachments are intentionally out of scope.
3. **Single Business Timezone**: Business hours arithmetic is standardized on `Asia/Kolkata` (09:00 - 18:00, Monday-Friday).

---

## 8. Production-Readiness Roadmap

- **Distributed Job Queue**: Transition the in-process NestJS scheduler to Redis + BullMQ for clustered, highly-available SLA breach sweeps and email delivery.
- **Enterprise SSO**: Integrate OAuth2 / OIDC (Okta, Azure AD, Google Workspace) with SCIM user provisioning.
- **Granular Rate Limiting**: Implement Redis-backed sliding-window rate limiters per IP and per authenticated user.
- **Database Backups & Replication**: Automated WAL archiving to S3/GCS with point-in-time recovery (PITR) and read replicas for reporting dashboards.
- **Telemetry & Observability**: OpenTelemetry tracing, Prometheus metrics scraping, and structured JSON logs with correlation IDs.
