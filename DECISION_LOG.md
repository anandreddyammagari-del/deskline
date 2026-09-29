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
