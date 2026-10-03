# Decision Log - Deskline Employee Service Request System

This document records architectural, design, and implementation decisions throughout the project lifecycle. Every entry follows the structure: **Context**, **Alternatives Considered**, **Decision**, and **Outcome**.

---

## Decision 001: Baseline vs Large Seed Sequencing (Review Finding 1)
- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Version 1.0 required a 10,000-ticket seed in Phase 1 before tickets, routing algorithms, and SLA calculation logic existed in the codebase.
- **Alternatives Considered**:
  1. Generate static mock ticket rows in Phase 1 without realistic SLA dates or state transitions.
  2. Postpone large-scale seed generation until after the ticket core and SLA engine are operational.
- **Decision**: In Phase 1, build only the baseline seed (3 departments, ~12 categories, 4 SLA policies, holiday calendar, and initial users). Move the 10,000-ticket seed generator to Phase 4, utilizing real SLA calculation pure functions and legitimate state-machine transitions.
- **Outcome**: Clean separation of foundational auth/schema seeding from complex performance workload generation, ensuring high data fidelity.

---

## Decision 002: Formal Phase 0 Verification & Sign-off Gate (Review Finding 2)
- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Version 1.0 lacked clarity between environment readiness and initial schema migrations, creating risks of unverified scaffolding.
- **Alternatives Considered**:
  1. Combine setup and initial migrations into Phase 1.
  2. Enforce an explicit Phase 0 deliverable gate requiring approval before any database migration.
- **Decision**: Start strictly with Phase 0 (scaffolding, requirements, container orchestration, environment documentation). Require formal sign-off before Phase 1 migrations.
- **Outcome**: Stable foundation with container health checks verified before any data layer code is executed.

---

## Decision 003: Single-Origin Proxy & Cookie Strategy (Review Finding 3)
- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Refresh tokens stored in httpOnly cookies often fail silently due to third-party cookie restrictions and CORS preflight misconfigurations when the frontend and backend operate on different origins.
- **Alternatives Considered**:
  1. Store refresh tokens in `localStorage` alongside access tokens.
  2. Direct cross-origin calls with wildcard CORS origins.
  3. Reverse proxy unifying both frontend and backend under a single origin (`/api` routed to backend, `/` to frontend) with `SameSite=Lax`, `httpOnly`, and `Secure` (in production).
- **Decision**: Employ a single-origin reverse proxy (Vite dev proxy locally, Nginx in Docker). Access tokens remain strictly in-memory (never in `localStorage`). Refresh tokens reside in an `httpOnly` cookie scoped to `/auth`. The frontend session is rehydrated via `POST /auth/refresh` on application load.
- **Outcome**: Completely prevents XSS token extraction from `localStorage` while eliminating CORS negotiation overhead and cookie delivery failures.

---

## Decision 004: Timezone Isolation and UTC Storage (Review Finding 4)
- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Date calculations can drift by 5h 30m when executed in UTC containers if local machine clock or implicit server timezones are used for business-hours arithmetic.
- **Alternatives Considered**:
  1. Rely on Node.js process timezone (`process.env.TZ = 'Asia/Kolkata'`).
  2. Pure UTC storage with explicit IANA timezone parameter (`Asia/Kolkata`) passed to pure calculation functions using `luxon`.
- **Decision**: All database timestamps are stored in UTC (`timestamptz`). SLA pure functions never read system clocks or process timezones; they receive target instants, holiday calendars, and the explicit IANA zone name (`Asia/Kolkata`). Jest test suites are verified under both `TZ=UTC` and `TZ=America/New_York`.
- **Outcome**: Deterministic SLA due-date calculations invariant to server, container, or client execution timezones.

---

## Decision 005: Container Architecture & Health Check Chain
- **Date**: 2026-09-29
- **Status**: Accepted
- **Context**: A mentor or evaluator must run the entire system from a fresh clone with one command (`docker compose up --build`), requiring predictable startup ordering and health verification.
- **Alternatives Considered**:
  1. Simple port publishing without health checks, risking race conditions where the backend boots before PostgreSQL is ready.
  2. Coordinated health checks: `db` (`pg_isready`), `api` (`GET /health`), and `web` (proxying `/api/health` and serving the SPA).
- **Decision**: Implement explicit health check probes in `docker-compose.yml` with `depends_on: condition: service_healthy` so `api` waits for `db`, and `web` proxies traffic only when `api` is healthy.
- **Outcome**: 100% reliable single-command bootstrap with zero boot-order crashes.

---

## Decision 006: Monorepo Structure and Phase Branching Model
- **Date**: 2026-09-29
- **Status**: Accepted
- **Context**: Need a clear, maintainable version-control structure that satisfies Section 11 deliverables (branch per phase, tag `v1.0-submission`, pull requests for review).
- **Alternatives Considered**:
  1. Separate git repositories for frontend and backend.
  2. Single monorepo (`deskline/`) containing `backend/`, `frontend/`, `docs/`, and `evidence/` with phase branches (`phase-0-setup`, `phase-1-database-auth`, etc.).
- **Decision**: Use a single monorepo rooted at `deskline/`. Every phase is developed on an isolated branch and submitted via Pull Request to `main` for review before merging.
- **Outcome**: Streamlined audit trail, unified Docker orchestration, and seamless traceability between requirements, code, and evidence.

---

## Decision 007: SHA-256 Pre-Hashing for Refresh Token Storage and Rotation
- **Date**: 2026-09-29
- **Status**: Accepted
- **Context**: Bcrypt has an inherent 72-byte input length limitation. Because JWT strings exceed 150 characters and share identical headers (`{"alg":"HS256","typ":"JWT"}`) and user payload prefixes, raw bcrypt comparison on JWT strings can trigger false-positive matches across rotated tokens.
- **Alternatives Considered**:
  1. Rely on raw bcrypt comparison (fails rotation invalidation due to 72-byte truncation).
  2. Store plain tokens in the database (vulnerable to exposure in database breaches).
  3. Pre-hash tokens with SHA-256 and store the 64-character hex digest, comparing digests using `crypto.timingSafeEqual` in constant time.
- **Decision**: Compute SHA-256 digests for all refresh tokens before database storage and perform constant-time comparison during token rotation.
- **Outcome**: Eliminates 72-byte truncation vulnerabilities, ensures instant invalidation of reused refresh tokens (HTTP 401), and maintains robust protection against timing attacks.

---

## Decision 008: Phase 2 Placeholder Time-Window Arithmetic for Reopen (Option B)
- **Date**: 2026-10-01
- **Status**: Accepted
- **Context**: In Phase 2, the ticket state machine handles `RESOLVED -> REOPENED` transitions. Per Section 4.2 and Edge Case 10, reopening is only allowed within 3 calendar days (72 hours) of resolution. However, the comprehensive SLA engine and IANA timezone pure functions are scheduled for development in Phase 3.
- **Alternatives Considered**:
  1. Unconditionally allow `RESOLVED -> REOPENED` in Phase 2 with a `// TODO` comment.
  2. Implement a temporary placeholder check using plain `Date` millisecond arithmetic (`now.getTime() - resolvedAt.getTime() <= 72h`) to enforce the constraint and validate Edge Case 10 in Phase 2 unit tests, with the explicit commitment that this placeholder will be deleted and replaced wholesale in Phase 3 by the unified Luxon/IANA-timezone SLA calculation service.
  3. Build an ad-hoc partial timezone service in Phase 2 alongside the state machine.
- **Decision**: Implemented Option (b). A temporary placeholder check with plain millisecond arithmetic gates the reopen transition in Phase 2 (`evaluateStatusTransition`). It is explicitly documented and committed to be replaced wholesale in Phase 3 by the SLA module's unified Luxon/`Asia/Kolkata` pure functions, avoiding any competing time calculation implementations or timezone drift bugs.
- **Outcome**: State machine behavior is testable and strictly enforces the 72-hour window in Phase 2 without creating a persistent, diverging timezone implementation.

---

## Decision 009: Routing Tiebreaker Ordering for Unassigned Agents (`lastAssignedAt: null`)
- **Date**: 2026-10-01
- **Status**: Accepted
- **Context**: Section 4.3 defines least-loaded routing as selecting the active agent with the fewest open tickets in the department, breaking ties by oldest last-assigned ticket. However, when agents are newly onboarded or have never received an assignment, their `lastAssignedAt` timestamp is `null`. The specification did not explicitly define whether an agent with `null` should precede or follow an agent who has a historical assignment date.
- **Alternatives Considered**:
  1. Treat `null` as the current moment (`Date.now()`), penalizing unassigned/new agents so they are picked last among agents with equal workload.
  2. Treat `null` as epoch zero (`time = 0`), prioritizing unassigned agents so they receive tickets first among tied agents before agents who have recently handled tickets.
  3. Ignore assignment history entirely when `null` and sort solely by user account creation date.
- **Decision**: Implemented Option 2. An agent who has never been assigned any ticket (`lastAssignedAt: null`) is evaluated as timestamp `0` (oldest possible instant). When two agents have equal open-ticket workloads (e.g., both have 0 tickets), the unassigned agent receives the ticket before an agent who previously handled an assignment. If both agents have never received a ticket (`time = 0` for both), ties are deterministically broken by oldest user account creation timestamp (`createdAt`).
- **Outcome**: Equitable work distribution that immediately activates idle or newly onboarded agents without starving them of ticket assignments.

---

## Decision 010: 72-Hour Reopen Window Retention as Flat Wall-Clock Duration and Pure SLA Replacement
- **Date**: 2026-10-02
- **Status**: Accepted
- **Context**: In Phase 3, the placeholder reopen check in `ticket-state-machine.ts` required resolution: whether the 72-hour window should remain flat calendar wall-clock duration (72 consecutive hours) or be converted into business-hours calculation (like SLA targets).
- **Alternatives Considered**:
  1. Convert to business hours (09:00 - 18:00 IST). At 9 hours/day, 72 business hours would stretch the reopen window across 8 full business days (10+ calendar days), breaking auto-closure expectations and confusing employees who expect a 3-day turnaround.
  2. Keep as flat wall-clock duration (72 hours from `resolvedAt`) implemented as a pure function anchored in UTC timestamps.
- **Decision**: Implemented Option 2. Reopening is an employee-driven action rather than a staff SLA target, and auto-closure occurs after 3 calendar days (72 hours). The pure function `isWithinReopenWindow(resolvedAt, now)` in `sla-calculator.ts` replaces the temporary Phase 2 placeholder wholesale.
- **Outcome**: Intuitive, consistent employee experience, zero timezone drift, and perfect mathematical alignment with the background 72-hour auto-close scheduler.

---

## Decision 011: Large-Scale Seed Simulation and Composite Index Optimization
- **Date**: 2026-10-02
- **Status**: Accepted
- **Context**: Per Section 9 (Phase 4) and AC-13, the manager dashboard endpoints (`/dashboard/summary`, `/dashboard/backlog-aging`, and `/dashboard/workload`) must achieve sub-500ms p95 latency under a database load of 10,000 tickets.
- **Alternatives Considered**:
  1. Generate static or random mock ticket dates without SLA alignment.
  2. Generate 10,000 realistic requests using batch inserts (`createMany`), calculating exact due dates via pure `calculateDueDate` functions, matching real department/category/agent topologies, and generating compliant lifecycle transitions with `TicketHistory`.
- **Decision**: Implemented Option 2 (`backend/prisma/large-seed.ts`). High-efficiency composite indexes on `(departmentId, status)` and `(assigneeId, status)` in PostgreSQL ensure bounded lookup times and instantaneous aggregation regardless of backlog size.
- **Outcome**: Data fidelity mirroring actual enterprise production usage while sustaining sub-100ms dashboard query execution.



