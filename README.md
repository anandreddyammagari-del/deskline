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
| **Admin** | Arjun Desai | `arjun.desai@deskline.test` | `Admin123!` | — | Manage SLA policies, categories, user accounts, audit ledger. |

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

## 4. Running Tests

```bash
# Backend unit tests (SLA pure functions, state machine, routing logic)
cd backend && npm test

# Timezone-invariant verification (must pass under both UTC and America/New_York)
cd backend && TZ=UTC npm test
cd backend && TZ=America/New_York npm test

# Automated edge case clearance tests
cd backend && npm run test:e2e
```

---

## 5. Known Limitations

1. **Email / SMS**: Notifications are logged to system stdout/audit logs rather than dispatched via external SMTP/SMS gateways.
2. **File Attachments**: Ticket descriptions and comments support text only; file upload attachments are currently out of scope.
3. **Single Timezone**: Business hours arithmetic is standardized on `Asia/Kolkata` (09:00 - 18:00, Monday-Friday).

---

## 6. Production-Readiness Roadmap

- **Distributed Job Queue**: Transition the in-process cron scheduler to Redis + BullMQ for clustered, highly-available SLA breach sweeps.
- **Enterprise SSO**: Integrate OAuth2 / OIDC (Okta, Azure AD, Google Workspace) with SCIM user provisioning.
- **Granular Rate Limiting**: Implement Redis-backed sliding-window rate limiters per IP and per authenticated user.
- **Database Backups & Replication**: Automated WAL archiving to S3/GCS with point-in-time recovery (PITR) and read replicas for reporting dashboards.
- **Telemetry & Observability**: OpenTelemetry tracing, Prometheus metrics scraping, and structured JSON logs with correlation IDs.
