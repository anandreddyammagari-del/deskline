# Work Log - Deskline Employee Service Request System

## 2026-09-29: Phase 1 Database Schema, Seed, and Authentication Engine
- **Goal**: Implement Section 4.1 Prisma schema and migrations, baseline seeding (3 departments, 12 categories, 4 SLA policies, 5 holidays, demo users), real RBAC endpoints (`/admin/users`, `/agent/queue`), memory-only JWT access tokens with rotating httpOnly refresh cookies, and session restoration.
- **Completed Actions**:
  - Implemented complete Prisma schema (`backend/prisma/schema.prisma`) and executed migration `20260929064226_init_schema`.
  - Created baseline seed script (`backend/prisma/seed.ts`) populating departments, categories, SLA policies, holidays, and demo users with hashed passwords (bcrypt cost 10). Zero ticket data seeded per Decision 001.
  - Built `AuthService` and `AuthController` supporting login rate-limiting (5/min), memory-only access tokens (15m), and rotating `httpOnly` refresh tokens (7d).
  - Identified and resolved bcrypt 72-byte truncation issue on long JWT strings by implementing SHA-256 pre-hashing and constant-time comparison (Decision 007).
  - Built real RBAC endpoints: `GET /admin/users` (returns seeded users, Admin-only), `GET /agent/queue` (returns `[]`, staff-only with DepartmentScopeGuard), and `GET /categories` (authenticated).
  - Built frontend `AuthProvider` with memory-only token storage and silent cookie session restoration (`POST /api/auth/refresh`), `LoginPage`, and `EvaluatorPage`.
  - Verified container stack with all three services healthy:
    - Employee token calling `GET /api/agent/queue` -> 403 Forbidden.
    - Employee token calling `GET /api/admin/users` -> 403 Forbidden.
    - Agent token calling `GET /api/agent/queue` -> 200 OK (`[]`).
    - Agent token calling `GET /api/admin/users` -> 403 Forbidden.
    - Admin token calling `GET /api/admin/users` -> 200 OK (seeded user list).
    - Refresh token rotation: 1st call returns 200 OK with rotated cookie; 2nd call reusing original cookie returns 401 Unauthorized (`Refresh token already used or revoked`).
    - Browser session restoration: Simulated F5 reload restores user session without prompting for login.
  - Documented evidence in `evidence/phase-1-evidence.txt`.

## 2026-10-01: Phase 2 Tickets Core, Pure State Machine, Routing, and Integration Tests
- **Goal**: Implement Section 4.2 Ticket State Machine as a pure function, Section 4.3 least-loaded routing engine with triage fallback, ticket and comment services/controllers, Supertest integration tests for Edge Cases 8 & 9 (User Addition 1), time-gating placeholder for the 72-hour reopen window with Decision 008 (User Addition 2), and explicit `needsTriage`/`assigneeId` fields in responses (User Addition 3).
- **Completed Actions**:
  - Implemented pure state machine `evaluateStatusTransition` (`backend/src/tickets/state-machine/ticket-state-machine.ts`) enforcing all allowed transitions, terminal statuses, note requirements for `WAITING_ON_REQUESTER`, role permissions, and the 72h reopen window limit.
  - Implemented unit test suite (`ticket-state-machine.spec.ts`) with 19/19 passing tests covering all states, transitions, invalid jumps (Edge Case 4), and the 72-hour expiration (Edge Case 10).
  - Implemented `RoutingService` (`backend/src/routing/routing.service.ts`) with least-loaded active agent assignment, tie-breaking by oldest last-assigned ticket, and triage fallback (`needsTriage: true`, `assigneeId: null`) for departments without active agents (Edge Case 9).
  - Implemented routing unit tests (`routing.service.spec.ts`) with 4/4 passing tests.
  - Implemented DTOs with validation pipes (`ticket.dto.ts`) and `TicketsService` with sequential ticket numbering (`REQ-YYYY-NNNNN`), full role scoping, `TicketHistory` recording, and `AuditLog` logging.
  - Wired `agent-queue.controller.ts` directly to `TicketsService.getAgentQueue`.
  - Implemented Supertest integration tests (`backend/test/tickets.e2e-spec.ts`):
    - Edge Case 8: Sequential stale `expectedCurrentAssigneeId` returning HTTP 409 Conflict (`CONCURRENT_ASSIGNMENT_CONFLICT`).
    - Edge Case 8 (Concurrent Race): Two simultaneous assignment requests fired via `Promise.all` against the same ticket returning exactly one HTTP 200 and one HTTP 409 Conflict.
    - Edge Case 9: No active agents in department returns HTTP 201 with `needsTriage: true`, `assigneeId: null`, and `status: NEW`.
    - Edge Case 3: Employees fetching ticket details have `isInternal: true` notes stripped.
    - Edge Case 4: Invalid out-of-sequence transitions return HTTP 400 Bad Request (`INVALID_STATUS_TRANSITION`).
    - Department Scoping: Cross-department manager assignment returns HTTP 403 Forbidden (`DEPARTMENT_MISMATCH`).
  - Recorded Decision 008 (wholesale replacement of reopen time-gate in Phase 3) and Decision 009 (routing tiebreaker ordering for agents with `lastAssignedAt: null` as epoch 0) in `DECISION_LOG.md`.
  - Verified backend and frontend builds with 0 errors.
  - Generated and saved evidence in `evidence/phase-2-evidence.txt`.

## 2026-10-02: Phase 3 SLA Engine, Scheduler, and Timezone Isolation
- **Goal**: Implement Section 4.4 SLA calculation pure functions (business hours 09:00 - 18:00 IST, holiday calendar, weekend skip), clock pause and resume extension during `WAITING_ON_REQUESTER`, Section 4.5 background scheduler (1-minute SLA breach sweeps and 72-hour auto-close sweep), wholesale replacement of the 72h reopen check with pure functions, multi-timezone test verification (`TZ=UTC` and `TZ=America/New_York`), and Supertest integration tests.
- **Completed Actions**:
  - Implemented pure SLA calculation engine in `backend/src/sla/sla-calculator.ts` with explicit IANA timezone `Asia/Kolkata` anchoring (`calculateDueDate`, `calculateBusinessMinutesElapsed`, `extendDueDate`, `isWithinReopenWindow`).
  - Replaced the temporary Phase 2 reopen window date arithmetic in `ticket-state-machine.ts` wholesale with `isWithinReopenWindow` (Decision 010).
  - Built `SlaService` (`backend/src/sla/sla.service.ts`) initializing `TicketSla` on ticket creation, handling clock pauses on `WAITING_ON_REQUESTER`, computing elapsed business minutes on resumption to extend due dates, and detecting response/resolution breaches.
  - Built `SchedulerService` (`backend/src/scheduler/scheduler.service.ts`) running every minute for SLA breach detection and escalation, and hourly for 72-hour auto-closure of `RESOLVED` tickets to `CLOSED`.
  - Added dedicated `npm run test:sla-tz` script in `backend/package.json` to verify timezone invariance across `TZ=UTC` and `TZ=America/New_York`. All 13 tests passed identically under both zones.
  - Implemented Supertest integration tests in `backend/test/sla.e2e-spec.ts` covering SLA pause/resume due-date extension, background breach sweep, and 72-hour auto-closure.
  - Recorded Decision 010 in `DECISION_LOG.md`.
  - Generated and saved evidence in `evidence/phase-3-evidence.txt`.

## 2026-10-02: Phase 4 Dashboards and Large-Scale Workload Generator
- **Goal**: Implement Section 4.6 / Section 8.4 Manager and Admin operational dashboard endpoints (`/dashboard/summary`, `/dashboard/backlog-aging`, `/dashboard/workload`), large-scale realistic 10,000-ticket generator (`backend/prisma/large-seed.ts`), composite index optimizations, and Supertest integration tests.
- **Completed Actions**:
  - Implemented `large-seed.ts` inserting 10,000 tickets in batches of 1,000 using `createMany`, computing real SLA targets via `calculateDueDate`, spreading realistic statuses (70% closed/resolved, 20% active, 5% triage/waiting), and populating `TicketHistory` and `TicketSla`.
  - Built `DashboardService` and `DashboardController` (`backend/src/dashboard/`):
    - `GET /dashboard/summary`: Scoped open tickets count, breached SLA count, compliance percentage, and average resolution time in minutes.
    - `GET /dashboard/backlog-aging`: Categorizes open requests into `<1d`, `1-3d`, `3-7d`, and `>7d`.
    - `GET /dashboard/workload`: Active ticket count per agent within the department.
  - Implemented Supertest integration test suite in `backend/test/dashboard.e2e-spec.ts` (4/4 tests passing).
  - Documented Decision 011 in `DECISION_LOG.md`.
  - Verified compilation and build across backend and frontend.
  - Generated and saved evidence in `evidence/phase-4-evidence.txt`.

## 2026-10-02: Phase 5 Frontend Workspaces (Employee, Agent, Manager, Admin)
- **Goal**: Implement Section 7 visual tokens, Section 8 role-dedicated workspaces (`/employee`, `/agent`, `/manager`, `/admin`), 232px sidebar shell, high-contrast badges, SLA chips, conversation threads with staff note toggles, and manager KPI tiles.
- **Completed Actions**:
  - Implemented design tokens and shared components:
    - `StatusBadge` (`frontend/src/components/StatusBadge.tsx`): High-contrast status badges per Section 7.3.
    - `PriorityBadge` (`frontend/src/components/PriorityBadge.tsx`): Solid/hollow dots per Section 7.4.
    - `SlaChip` (`frontend/src/components/SlaChip.tsx`): Remaining duration, warning alert (< 1h), red breach flag, and paused status.
    - `Sidebar` (`frontend/src/components/Sidebar.tsx`): 232px left navigation with active indicators and count badges.
  - Built 4 dedicated workspaces:
    - `EmployeeWorkspace`: Request list, new request intake form with category auto-fill, ticket details with public comments, and cancel/reopen actions.
    - `AgentWorkspace`: Assigned queue, department requests, status action transitions (`Start working`, `Wait on requester`, `Mark resolved`), and internal staff notes toggle.
    - `ManagerWorkspace`: 4 operational KPI tiles (Open requests, SLA breached, compliance %, avg resolution), backlog aging breakdown, agent workload distribution, and quick-assign triage table.
    - `AdminWorkspace`: User directory and category management tables.
  - Integrated all workspaces into `App.tsx` with role-based routing and memory-only token authentication.
  - Verified frontend production build (`tsc && vite build`) with 0 errors.
  - Generated and saved evidence in `evidence/phase-5-evidence.txt`.

## 2026-10-02: Phase 6 Test Clearance (All 12 Mandatory Edge Cases)
- **Goal**: Implement dedicated automated test suite `backend/test/edge-cases.e2e-spec.ts` testing all 12 mandatory edge cases named "Edge Case N" per Section 10.
- **Completed Actions**:
  - Implemented `backend/test/edge-cases.e2e-spec.ts`:
    - Edge Case 1: Employee requests another employee's ticket: 403 Forbidden (`FORBIDDEN_TICKET_ACCESS`).
    - Edge Case 2: Agent in IT requests an HR ticket: 403 Forbidden (`DEPARTMENT_MISMATCH`).
    - Edge Case 3: Employee fetches a ticket that has internal notes: notes absent from the response.
    - Edge Case 4: Out-of-sequence status change (NEW to RESOLVED): 400 Bad Request (`INVALID_STATUS_TRANSITION`).
    - Edge Case 5: SLA due date across a weekend and a holiday: correct due time calculated via pure functions.
    - Edge Case 6: WAITING_ON_REQUESTER for 4 business hours then resumed: due time extended by exactly 4 hours.
    - Edge Case 7: Breach scheduler runs twice: breach recorded once, one audit entry (idempotency verified).
    - Edge Case 8: Two agents claim the same ticket concurrently: one succeeds (200), one gets 409 (`CONCURRENT_ASSIGNMENT_CONFLICT`).
    - Edge Case 9: Department with no active agents: ticket stays NEW, needsTriage set to true, returns 201 without 500 error.
    - Edge Case 10: Employee reopens after the 3-day window: rejected with 400 Bad Request.
    - Edge Case 11: Malformed body with unknown fields returns 400 with standard `{ statusCode, message, code }` shape.
    - Edge Case 12: Expired JWT on a mutating route returns 401 Unauthorized with no side effects.
  - Standardized `HttpExceptionFilter` error codes to uppercase snake_case (`BAD_REQUEST`).
  - All 12 edge cases passed with 100% pass rate.
  - Saved test execution log in `evidence/test-run.log`.
  - Generated and saved evidence in `evidence/phase-6-evidence.txt`.

## 2026-10-02: Phase 7 UI Polish & Design System Governance
- **Goal**: Apply Section 7 design tokens, typography, and contrast rules across all screens without changing routes or API contracts. Verify avoid-list items (no gradients, no soft shadows, no neon accents, no warm cream backgrounds).
- **Completed Actions**:
  - Enforced tabular figures (`font-variant-numeric: tabular-nums`) across all numeric and date table cells.
  - Added visible keyboard focus indicators (`:focus-visible`) for WCAG AA compliance.
  - Added reduced motion media queries (`prefers-reduced-motion: reduce`).
  - Audited against Section 7.2 avoid-list:
    - Zero gradients, zero all-caps eyebrow labels, zero neon or saturated accent washes.
    - Neutral 1px borders (`#D5DBE1`) separating cards and table rows without soft drop shadows.
    - Plain, active language on buttons ("Send reply", "Mark resolved", "Reopen request").
  - Verified frontend build with 0 errors.
  - Generated and saved evidence in `evidence/phase-7-evidence.txt`.




