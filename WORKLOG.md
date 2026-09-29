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
