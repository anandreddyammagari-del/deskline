# System Requirements Specification: Deskline Employee Service Request System

## 1. Stakeholder & Context
- **Stakeholder**: Head of Shared Services at an enterprise with ~500 employees.
- **Problem Statement**: Internal requests (IT support, HR queries, Facilities maintenance) are currently managed via fragmented channels (emails, chat messages, ad-hoc spreadsheets), leading to lost tickets, lack of visibility into SLA compliance, uneven team workloads, and compromised confidentiality across departments.
- **Product Vision**: Deskline is a centralized, purpose-built internal service desk portal. It automates ticket intake, routes requests by department and agent load, tracks SLA timelines across business hours and holidays, enforces role-based confidentiality, and equips team managers with high-performance operational dashboards.

---

## 2. Project Scope

### 2.1 In-Scope Capabilities
- **Request Lifecycle**: Create, auto-route, assign/claim, comment, pause/resume, resolve, close, and reopen tickets.
- **SLA Engine**: Real-time SLA tracking across business hours, holiday calendars, status-based pause/resume, 80% escalation alerts, and automated breach flagging.
- **Security & Data Isolation**:
  - Employees see only their own requests; internal staff notes are stripped at the service layer.
  - Agents see only requests assigned to their department.
  - Managers see all departmental tickets, triage queues, and performance metrics.
  - Admins maintain global SLA policies, categories, departments, users, and audit logs.
- **Role-Dedicated Workspaces**: 4 isolated frontend workspaces (`/employee`, `/agent`, `/manager`, `/admin`) + `/evaluator-login` for mentor evaluation.
- **Immutable Audit Trail**: Append-only audit log and ticket history tracking state transitions, reassignments, and policy updates.
- **High-Performance Reporting**: Manager dashboard calculating open tickets, breaches, SLA compliance rates, backlog aging, and workload distribution in under 500 ms (p95) on 10,000 seeded tickets.

### 2.2 Out-of-Scope Capabilities
- External notifications via real email (SMTP) or SMS (all notifications are logged to stdout/database).
- File/binary attachments on tickets or comments.
- Enterprise Single Sign-On (SSO / SAML) or LDAP directory synchronization.
- Native mobile applications (responsive web UI down to 360 px width is supported).
- Multi-timezone support or internationalization (single timezone: `Asia/Kolkata`).
- Financial transactions, billing, or external ERP integrations.

---

## 3. Success Metrics
1. **Routing Invariant**: 100% of created tickets are automatically assigned to an active department agent or flagged with `needsTriage = true` if no active agents are available (zero unhandled exceptions or 500 errors).
2. **SLA Accuracy**: SLA calculations pass 100% of test cases across business hours, weekends, designated company holidays, and pause-resume cycles.
3. **Data Confidentiality**: 0% data leakage: Employee tokens receive 403 on cross-requester or staff-only routes; staff internal comments are never exposed to employee responses.
4. **Dashboard Latency**: Manager dashboard p95 response time is strictly < 500 ms under a database load of 10,000 tickets.
5. **Zero-Friction Bootstrap**: The complete environment builds and passes health checks with a single command: `docker compose up --build`.

---

## 4. Labelled Assumptions & Review Analysis

- **[ASM-01] Business-Hours Window**: Monday through Friday, 09:00 to 18:00 (9 business hours/day, 45 business hours/week), excluding weekends and official company holidays.
  - *Review Analysis & Decision*: **KEPT**. 
  - *Rationale*: A 9:00 AM – 6:00 PM window represents standard enterprise shared-services operating shifts in India (`Asia/Kolkata`) and cleanly maps to the default SLA targets (e.g., an 8-hour `HIGH` resolution target neatly spans exactly one business day).
- **[ASM-02] Timezone Representation**: Fixed to `Asia/Kolkata` (UTC+05:30). All database timestamps are stored in UTC (`timestamptz`), while business-hours math explicitly passes `Asia/Kolkata` into Luxon calculations.
  - *Review Analysis & Decision*: **KEPT**.
  - *Rationale*: Enforcing explicit timezone parameters in pure functions guarantees that container timezone offsets (e.g. UTC containers vs local development environments) cannot drift date calculations by 5 hours and 30 minutes.
- **[ASM-03] 3-Day Reopen and Auto-Close Window**: After a ticket is marked `RESOLVED`, the requester has a 3-calendar-day (72-hour) window to reopen it. Once the 3-day window lapses, the ticket transition to `CLOSED` is permanent and cannot be reopened.
  - *Review Analysis & Decision*: **KEPT**.
  - *Rationale*: 72 hours strikes the optimal balance between giving employees sufficient time to verify ticket resolution while preventing stale resolved tickets from indefinitely inflating the active backlog.
- **[ASM-04] SLA Priority Defaults**:
  - `URGENT`: First Response = 30 business minutes; Resolution = 4 business hours.
  - `HIGH`: First Response = 1 business hour; Resolution = 8 business hours.
  - `MEDIUM`: First Response = 4 business hours; Resolution = 24 business hours.
  - `LOW`: First Response = 8 business hours; Resolution = 72 business hours.
  - *Review Analysis & Decision*: **KEPT**.
  - *Rationale*: Realistic SLA thresholds for an intermediate IT/HR shared-services team. Admin workspace provides live CRUD capabilities if adjustments are needed.
- **[ASM-05] Escalation Threshold**: When elapsed business time reaches 80% of the target SLA duration, an escalation flag is set for the department manager.
  - *Review Analysis & Decision*: **KEPT**.
  - *Rationale*: Gives team leads proactive lead time before actual breaches occur.

---

## 5. Acceptance Criteria

### Core Functional & Edge Cases
- **AC-01 (Cross-Requester Isolation)**: An Employee attempting to read or mutate another employee's ticket receives HTTP 403 Forbidden.
- **AC-02 (Cross-Department Staff Isolation)**: An Agent in one department (e.g., IT) attempting to access or modify a ticket belonging to another department (e.g., HR) receives HTTP 403 Forbidden.
- **AC-03 (Internal Notes Sanitization)**: When an Employee fetches ticket details or comments, all entries marked `isInternal = true` are stripped from the response payload at the service layer.
- **AC-04 (State Machine Invariant)**: Any attempt to transition ticket status out of sequence (e.g., `NEW` directly to `RESOLVED`, or mutating a terminal `CLOSED`/`CANCELLED` ticket) is rejected with HTTP 400 Bad Request.
- **AC-05 (SLA Holiday & Weekend Arithmetic)**: SLA due times created before or spanning weekends and registered holidays must calculate due times solely during valid business hours (Mon-Fri 09:00-18:00 `Asia/Kolkata`).
- **AC-06 (SLA Pause & Resume Exactness)**: Moving a ticket to `WAITING_ON_REQUESTER` pauses the SLA clock. Resuming to `IN_PROGRESS` extends the due timestamp by exactly the elapsed business minutes during the pause.
- **AC-07 (Idempotent Breach Scheduler)**: Repeated runs of the background breach scheduler (e.g. running twice within the same minute) must record the breach flag and write an audit log entry exactly once.
- **AC-08 (Concurrency Conflict Claiming)**: Concurrent claim attempts by two agents on the same ticket must use transactional locking or optimistic locking so that exactly one claim succeeds and the other receives HTTP 409 Conflict.
- **AC-09 (Triage Fallback for Empty Departments)**: Submitting a ticket to a department with no active agents leaves the status as `NEW`, marks `needsTriage = true`, and returns HTTP 201 without throwing a 500 error.
- **AC-10 (Reopen Window Expiry)**: Attempting to reopen a ticket after the 3-day post-resolution window has expired is rejected with HTTP 400 Bad Request.
- **AC-11 (DTO Validation & Error Envelope)**: Requests with malformed JSON, unwhitelisted fields, or invalid enum values are rejected with HTTP 400 and adhere strictly to `{ statusCode, message, code }`.
- **AC-12 (Expired Token Mutating Rejection)**: Mutating requests presented with an expired JWT access token receive HTTP 401 Unauthorized with zero database mutations or side effects.

### Architecture & Operational Acceptance
- **AC-13 (Manager Dashboard Latency)**: p95 latency for `/dashboard/summary`, `/dashboard/backlog-aging`, and `/dashboard/workload` is < 500 ms on 10,000 seeded requests.
- **AC-14 (Single-Command Docker Health)**: `docker compose up --build` compiles, boots, and marks `db`, `api`, and `web` healthy without manual intervention.
- **AC-15 (Unified Reverse Proxy & Cookie Refresh)**: Frontend and API are served under a single origin via reverse proxy; refresh tokens are stored in `httpOnly`, `SameSite=Lax` cookies; page refreshes restore user sessions seamlessly via `POST /auth/refresh`.
