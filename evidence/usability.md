# Usability Walkthrough Notes: Deskline

This document captures the evaluation walkthrough notes across each role persona, validating keyboard navigation, focus indicators, contrast, and task completion ergonomics per Section 7 and Section 10.

---

## 1. Persona: Employee (`asha.rao@deskline.test`)
- **Key Task**: Submit a new service request, monitor status, reply to agent inquiry, and reopen if necessary.
- **Navigation Flow**:
  1. Accesses `/` -> Redirected to `/workspace/employee`.
  2. Tab navigation directly lands on "New Request" button with high-contrast `:focus-visible` outline.
  3. "New Request" modal opens with autofocus on the Category selector.
  4. Ticket submission provides immediate optimistic visual feedback and lands user on their request list.
  5. Ticket detail displays SLA deadline chip in tabular numbers (`font-variant-numeric: tabular-nums`).
  6. Reopen action is cleanly exposed when status is `RESOLVED` and within 72 hours.
- **Ergonomics & Polish**:
  - No marketing gradients or distracting animations (`prefers-reduced-motion` respected).
  - Clear distinction between public comments and system updates.

---

## 2. Persona: Agent (`ravi.mehta@deskline.test`)
- **Key Task**: Review IT ticket queue, triage unassigned tickets, post internal notes, pause SLA clock, resolve tickets.
- **Navigation Flow**:
  1. Lands on `/workspace/agent`.
  2. Queue split: "Assigned to Me" and "Unassigned IT Requests".
  3. Clicking a ticket opens the dual-pane workbench with metadata sidebar (232px width).
  4. Adding an internal note provides explicit visual amber styling distinguishing it from public replies.
  5. Status dropdown triggers modal confirmation when transitioning to `WAITING_FOR_EMPLOYEE` (requiring a reason) or `RESOLVED` (requiring resolution notes).
- **Ergonomics & Polish**:
  - SLA chips show remaining time with distinct status tokens (Normal, At Risk, Breached).
  - Tab navigation cycles through comment textarea, private toggle, and submit button smoothly.

---

## 3. Persona: Manager (`meera.kapoor@deskline.test`)
- **Key Task**: Monitor team workload, SLA breach rates, and backlog aging.
- **Navigation Flow**:
  1. Lands on `/workspace/manager`.
  2. Top metric cards show Total Active, At Risk, Breached, and Avg Resolution Time.
  3. Backlog aging chart groups tickets into `<24h`, `24-48h`, and `>48h` buckets.
  4. Agent workload table shows real-time active ticket counts with one-click reassign actions.
- **Ergonomics & Polish**:
  - Department scoping guarantees Meera only sees IT department tickets and metrics.
  - Numbers use tabular figures to prevent jitter during real-time updates.

---

## 4. Persona: System Administrator (`admin@deskline.test`)
- **Key Task**: Audit system activity, manage users and SLA policies.
- **Navigation Flow**:
  1. Lands on `/workspace/admin`.
  2. Audit ledger table lists all state transitions, system events, and actor IDs with full timestamp precision.
  3. Filterable by action type, entity, and actor.
- **Ergonomics & Polish**:
  - Dense tabular view with clean 1px borders adhering to Section 7 design tokens.
