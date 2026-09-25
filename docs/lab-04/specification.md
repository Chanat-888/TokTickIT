# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal

Give IT Staff a reliable way to plan and record the actual work behind a
Ticket by adding Actions Taken, close the gap between "Requester thinks
it's fixed" and "IT Staff formally confirms it" by hardening the existing
status-transition and concurrency rules, and give Requesters and IT
Staff/Administrators concise, backend-calculated dashboards that summarize
their own operational data and link into the existing detailed screens —
all while every Lab 1-3 capability keeps working exactly as before.

## 2. Stakeholder Request Interpretation

IT Staff currently have a queue and a way to talk to Requesters, but no
structured record of the work performed on a Ticket. Lab 4 adds that
record — Actions Taken — as a simple, append-and-update log under each
Ticket: what was done, what happened, whether it needs a follow-up, and
where to look for evidence (a note, not a real upload). One person still
owns the Ticket overall, but any IT Staff member may log or edit an Action
Taken on it, matching how ownership already works for the Ticket itself. A
Requester can keep saying "looks fixed to me," but that never formally
closes anything — only IT Staff or an Administrator does that, through the
existing status action. Finally, both sides get a small dashboard: enough
to see what needs attention today without duplicating the full ticket
list, and nothing resembling SLA clocks, alerts, or report builders, which
are explicitly out of scope.

## 3. Scope

### Included

- Actions Taken: create, update, and list on an accessible Ticket, with
  Description, Result, Performed By (auto), Follow-Up Required, Follow-up
  Note (conditional), and Attachment Notes.
- Requester read-only access to all Actions Taken on their own Tickets.
- Re-confirmation and documentation of the Lab 3 Ticket status-transition
  matrix as final for Lab 4 (no new statuses, no new transitions).
- Optimistic-concurrency protection on Ticket Status/Owner/IT Priority
  writes, so one user cannot silently overwrite another's recent change.
- Requester Dashboard: own-Ticket metrics with drill-down.
- IT Staff/Administrator Dashboard: operational metrics, current-user
  Actions Taken, and drill-down; Administrator adds a concise account-count
  card.
- Final regression and hardening pass across all Lab 1-3 functionality.

### Explicitly excluded

(carried forward from the Lab 4 handout §4.2, unchanged)

- Automatic SLA clocks, escalation engines, on-call scheduling, breach
  notifications.
- Email, SMS, LINE, push, or other external notification services.
- Inventory, spare-parts, purchasing, or cost accounting.
- Time-sheet billing, payroll, or labor-cost calculation.
- Multi-level approval workflows and electronic signatures.
- Advanced BI tools, custom report builders, export warehouses.
- Multi-tenant organizations and production-scale cloud operations.

Lab 4-specific exclusions (not in the handout's list, but out of scope for
the reasons given):

- Deleting an Action Taken — only create and update exist (§4.1 of the
  handout never mentions delete; an audit-style log is more defensible
  append/update-only, matching how Comments/Notes are already append-only
  and Tickets are already update-only).
- Real file upload behind Attachment Notes — it is descriptive text
  pointing to where a file lives, not a new upload pipeline; the existing
  `Attachment` model already covers real uploads (§7).
- A hard rule blocking `Resolved` until an Action Taken exists — see BR-16.
- Any status transition, role, or authorization change beyond what §5
  states; the Lab 3 matrix and roles are carried forward unchanged.

## 4. Functional Requirements

**Actions Taken**

- FR-01 IT Staff or Administrator creates an Action Taken on an accessible
  Ticket with Description, Result, Follow-Up Required, a conditional
  Follow-up Note, and Attachment Notes; Performed By and the creation
  timestamp are set automatically from the session and server clock
  (BR-03, BR-04).
- FR-02 IT Staff or Administrator updates an existing Action Taken's
  Description, Result, Follow-Up Required, Follow-up Note, and Attachment
  Notes (BR-09, BR-10).
- FR-03 IT Staff, Administrator, and the Ticket's owning Requester view the
  list of Actions Taken on a Ticket, oldest first (BR-11, BR-12).
- FR-04 A Requester's request to create or update an Action Taken is
  rejected regardless of any UI restriction (BR-08).

**Ticket workflow and resolution**

- FR-05 IT Staff or Administrator changes a Ticket's Status only along the
  confirmed Lab 3 transition matrix (§5), unchanged for Lab 4 (BR-15).
- FR-06 A write that changes a Ticket's Status, Owner, or IT Priority is
  rejected with a conflict response when the caller's known `updatedAt` no
  longer matches the Ticket's current value (BR-17).
- FR-07 A Requester's "Problem Appears Resolved" indication remains
  advisory only and never changes Status (BR-18), unchanged from Lab 3.

**Dashboards**

- FR-08 An authenticated Requester retrieves Requester Dashboard data: My
  Open Tickets, Waiting for Requester, Recently Updated, Recently Resolved
  (BR-19, BR-20), each with a drill-down link (BR-25).
- FR-09 An authenticated IT Staff or Administrator retrieves IT Staff
  Dashboard data: Unassigned, My Assigned, By Status, Recently Updated, and
  My Recent Actions Taken (BR-21), each with a drill-down link.
- FR-10 An Administrator's dashboard additionally shows a concise
  active-user count by Role (BR-22).
- FR-11 Every dashboard metric and list is calculated by the backend at
  request time from authoritative Ticket/ActionTaken/User data (BR-23).

**Regression and hardening**

- FR-12 All Lab 1-3 Requester, IT Staff, and Administrator screens,
  navigation, and API behavior remain available and correct to their
  permitted roles (BR-26).
- FR-13 Loading, validation, success, empty/no-results, forbidden,
  conflict, not-found, and safe API-failure feedback is present and
  consistent across all Lab 4 screens, matching the pattern already
  established in Labs 2-3.
- FR-14 A duplicate Action Taken submission caused by repeated clicking or
  a network retry does not create a second record (BR-13); a duplicate
  Ticket Status/Owner/IT Priority write is prevented or safely surfaced by
  the concurrency check (BR-17).

## 5. Business Rules

- BR-01 Action Taken belongs to exactly one Ticket.
- BR-02 The Ticket Owner coordinates the Ticket, but an Action Taken may be
  by a different IT Staff member.
- BR-03 Performed By is always the authenticated session's user; it is
  never accepted from the client.
- BR-04 An Action Taken's date/time is the server clock at creation, not a
  client-editable field — the handout's own UI section (§8.3, "Action
  create date/time") is more specific than its earlier list (§4.1,
  "Action... date/time") and governs this reading.
- BR-05 Action Description and Result are required, non-empty after
  trimming, and limited to 2000 characters each — the same limit already
  used for Public Comments/Internal Notes (lab-03 BR-21).
- BR-06 Follow-Up Required defaults to `false`. When `true`, Follow-up Note
  is required (non-empty after trimming, ≤2000 characters); when `false`,
  any supplied Follow-up Note is ignored and stored as empty.
- BR-07 Attachment Notes is optional free text, ≤500 characters, and never
  triggers file storage — it is a pointer for a human to locate a file
  elsewhere, distinct from the Lab 2 `Attachment` model.
- BR-08 Only an active IT Staff or Administrator user may create or update
  an Action Taken, on any accessible Ticket (ownership of the Ticket is not
  required — same access rule as Ticket Detail, lab-03 FR-10). A Requester
  request is rejected with 403 regardless of any UI restriction.
- BR-09 An Action Taken update may change Description, Result, Follow-Up
  Required, Follow-up Note, and Attachment Notes; the Ticket link,
  Performed By, and the creation timestamp are immutable after creation.
- BR-10 Any active IT Staff or Administrator may update an Action Taken,
  not only its original performer — mirrors the shared-responsibility
  model already used for Ticket ownership (lab-03 BR-18).
- BR-11 Requesters have read-only access to every Action Taken field on
  their own Tickets (handout §8.3); Requesters never create or update an
  Action Taken (BR-08).
- BR-12 Actions Taken are listed oldest first per Ticket, the same
  ordering convention already used for Public Comments and Internal Notes
  (lab-03 §8).
- BR-13 Creating an Action Taken is idempotent per `(ticketId,
  idempotencyKey)`: a retried `POST` with the same client-supplied key
  returns the original Action Taken instead of creating a duplicate — the
  same mechanism Tickets already use for creation (lab-02 schema).
- BR-14 Creating or updating an Action Taken never modifies the parent
  Ticket's `updatedAt`. The Ticket's concurrency token (BR-17) changes on
  every write to the Ticket row itself: Status, Owner, IT Priority, the
  Requester's resolve-indication (lab-03 BR-24), and Attachment upload/
  soft-removal (lab-02 BR-39, made effective in Lab 4, §11.16). A stale-write 409 can
  therefore also be caused by one of those writes, not only by another
  staff member's workflow change; the client recovers the same way
  (refresh, retry).
- BR-15 The Lab 3 status-transition matrix and its role restriction
  (lab-03 §5, BR-19) are confirmed unchanged and final for Lab 4: Status
  may be changed only by IT Staff/Administrator, only via the dedicated
  status action, never as a side effect of an Action Taken or any other
  write.
- BR-16 No Ticket Status transition requires an existing Action Taken. The
  stakeholder's "IT Staff must review the work and formally update the
  Ticket" is satisfied by the existing status-change action already being
  restricted to IT Staff/Administrator (BR-15); Lab 4 does not add a hard
  gate tying Actions Taken to Resolved, consistent with the handout
  excluding SLA/escalation-style enforcement machinery.
- BR-17 A write that changes a Ticket's Status, Owner, or IT Priority must
  include the caller's last-known `Ticket.updatedAt` as `expectedUpdatedAt`;
  if it no longer matches the Ticket's current `updatedAt`, the write is
  rejected with 409 and not applied (§6.1 of the handout). The comparison
  and the write are one atomic conditional update (§11.15), never a
  separate check followed by an update.
- BR-18 A Requester's "Problem Appears Resolved" indication (lab-03 BR-24)
  remains advisory only and never changes Status, unchanged from Lab 3.
- BR-19 Requester Dashboard data is scoped exclusively to Tickets where
  `requesterId` equals the authenticated session's user id; no Requester
  dashboard query accepts a client-supplied requester id (mirrors lab-03
  BR-03).
- BR-20 Requester Dashboard metrics are defined as:
  - **My Open Tickets** — count of the Requester's own Tickets with status
    in {New, Open, In Progress, Reopened}.
  - **Waiting for Requester** — count of the Requester's own Tickets with
    status Waiting for Requester.
  - **Recently Updated** — the Requester's 5 most recently updated Tickets
    (any status), ordered by `updatedAt` descending.
  - **Recently Resolved** — the Requester's 5 most recently updated
    Tickets with status in {Resolved, Closed}, ordered by `updatedAt`
    descending.
- BR-21 IT Staff/Administrator Dashboard metrics are defined as:
  - **Unassigned** — count of Tickets with `ownerId` null and status not
    in {Closed, Cancelled}.
  - **My Assigned** — count of Tickets owned by the authenticated user
    with status not in {Closed, Cancelled}.
  - **By Status** — a count per `TicketStatus` value, across all Tickets.
  - **Recently Updated** — the 5 most recently updated Tickets (any
    status, any owner), ordered by `updatedAt` descending.
  - **My Recent Actions Taken** — the authenticated user's 5 most recent
    Actions Taken (any Ticket), ordered by `createdAt` descending, each
    linking to its Ticket.
- BR-22 The Administrator Dashboard reuses the IT Staff Dashboard
  unchanged and adds one concise "Accounts" card: active-user counts
  grouped by Role.
- BR-23 Every dashboard count and list is computed by the backend from the
  same `Ticket`/`ActionTaken`/`User` data the Queue and Ticket Detail
  already use — no denormalized or cached counter is introduced.
- BR-24 All timestamps are stored and returned in UTC (ISO 8601),
  unchanged from Labs 2-3. Dashboard "recently updated/resolved" lists use
  a fixed result-count limit (5) rather than a calendar-day boundary,
  avoiding a client-timezone-dependent cutoff (handout §6.2).
- BR-25 Every dashboard drill-down link (BR-20/BR-21) opens the existing
  Ticket Queue (staff) or My Tickets (Requester) view, pre-filtered by the
  same condition the metric used — never a separate, differently-computed
  list.
- BR-26 All Lab 1-3 authentication, authorization, Requester, IT Staff,
  Administrator, Comment, Note, and Attachment business rules remain in
  force unchanged except where explicitly superseded above (BR-17).
- BR-27 The existing `status` query parameter on `GET /api/tickets`
  (lab-02) and `GET /api/staff/tickets` (lab-03) is extended to accept a
  comma-separated list of status values (e.g. `status=NEW,OPEN`), purely
  additive: a single value keeps behaving exactly as before. This lets a
  dashboard drill-down link (BR-25) reproduce a grouped metric's (BR-20/
  BR-21) exact filter instead of approximating it.

### Status transition matrix

Unchanged from Lab 3 (`docs/lab-03/specification.md` §5), reconfirmed as
final for Lab 4 per BR-15/BR-16:

| From | Allowed To |
|---|---|
| New | Open, Cancelled |
| Open | In Progress, Waiting for Requester, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Cancelled |
| Cancelled | *(terminal — no further transitions)* |

Allowed by IT Staff or Administrator only; any other pair is rejected with
409. Transitions **to** `Cancelled` or `Closed` still require an explicit
UI confirmation step (unchanged from Lab 3).

## 6. UI Specification Summary

Full detail is deferred to `ui-spec.md`; this section fixes the structure
that document must follow.

- **IT Staff Ticket Detail**: adds an Actions Taken area below the
  existing panels — list (oldest first), a create form, and edit mode per
  row; reuses existing form/table/card conventions.
- **Requester Ticket Detail**: adds a read-only Actions Taken list, same
  fields, no create/edit controls.
- **Ticket status controls**: show only permitted-from-current-status
  targets (unchanged approach from Lab 3), now also surface a conflict
  message and safe refresh path when a concurrency check fails (BR-17).
- **IT Staff/Administrator Dashboard**: metric cards (Unassigned, My
  Assigned, By Status, Recently Updated) plus a My Recent Actions Taken
  list and (Administrator only) an Accounts card; each actionable item
  opens Ticket Queue/Detail.
- **Requester Dashboard**: metric cards (My Open Tickets, Waiting for
  Requester, Recently Updated, Recently Resolved); each opens My Tickets
  pre-filtered.
- Role-appropriate Dashboard navigation entries with active-page
  indication, added to the existing application shell.
- Loading, empty, forbidden, conflict, and safe-failure feedback are
  required wherever a Lab 4 screen can reach that state, matching the
  established Lab 2-3 pattern.

## 7. Data Changes

### Models

- **`ActionTaken`** (new) — `id`, `ticketId` (FK → `Ticket`),
  `performedById` (FK → `User`), `description` (String), `result`
  (String), `followUpRequired` (Boolean, default `false`), `followUpNote`
  (String, nullable), `attachmentNotes` (String, nullable),
  `idempotencyKey` (String), `createdAt`, `updatedAt`.
- **`Ticket`**, **`User`** — unchanged column set; `User` gains the
  inverse `actionsTaken ActionTaken[]` relation, `Ticket` gains the
  inverse `actionsTaken ActionTaken[]` relation. `Ticket.updatedAt`
  (already present) is reused as the concurrency token (§11.1) — no new
  column.
- All other models (`Category`, `RelatedSystem`, `Attachment`,
  `PublicComment`, `InternalNote`, `Session`) are unchanged.

### Enums

No new enums. `Result` is free text (§11.2) — the handout gives no
controlled vocabulary for it, so one is not invented.

### Relationships

- One `Ticket` → many `ActionTaken` (BR-01).
- One `User` (any active IT Staff/Administrator) → many `ActionTaken` as
  performer; a Ticket's Owner and an Action Taken's performer are
  independent (BR-02).

### Indexes and constraints

- `ActionTaken.ticketId` indexed (per-Ticket list queries, FR-03).
- `ActionTaken.performedById` indexed (My Recent Actions Taken, BR-21).
- `@@unique([ticketId, idempotencyKey])` on `ActionTaken` (BR-13).

### Migration plan

- Purely additive: one new table (`ActionTaken`) with two foreign keys;
  no existing column is altered, renamed, or dropped, so no backfill is
  needed on `Ticket`, `User`, or any other existing table.
- A legacy Ticket with zero Actions Taken simply returns an empty list
  from FR-03 and contributes 0 to any Action-Taken-based metric (BR-21's
  My Recent Actions Taken) — no special-cased "legacy" handling is needed
  because an empty relation is already the natural zero state.
- Rollback is a plain `prisma migrate` down/drop of the new table; no
  other table's data is touched, so no recovery procedure beyond a normal
  migration revert is required.
- Verified the same way Lab 3's migration was (docs/lab-03/specification.md
  §5.2): run against a copied database first, diff row counts on every
  pre-existing table before/after to confirm zero drift.

### Seed data

Beyond the existing Lab 1-3 seed:

- A subset of seeded Tickets receive zero Actions Taken, a subset receive
  exactly one, and a subset receive multiple (2-4) — spanning several
  statuses and both assigned/unassigned ownership, so FR-03's list view
  and BR-21's My Recent Actions Taken have non-trivial data.
- Actions Taken are seeded across more than one IT Staff performer,
  including at least one Ticket whose Owner and whose Action Taken
  performer are different users (BR-02, demonstrated directly).
- At least one seeded Action Taken has `followUpRequired = true` with a
  populated Follow-up Note, and at least one has `followUpRequired =
  false`.
- Enough seeded Tickets/Actions Taken exist that both Requester and IT
  Staff dashboards show at least one non-zero metric. Zero states stay
  reachable too (handout §5.3): an active Requester with zero Tickets
  (Priya Nair), an active IT Staff user who performs no Actions Taken
  (Taylor Chen, so "My Recent Actions Taken" is empty), and `byStatus`
  counts of 0 for any status the seed does not use. Ticket ownership in the
  Lab 3 seed is not changed, so a staff user with zero owned Tickets is
  demonstrated in the test database, not the dev seed.
- Seed remains idempotent (safe to re-run), extending the existing
  upsert-based seed script rather than replacing it.

## 8. API Contract

Full detail is deferred to `api-spec.md`. All endpoints below require a
valid session cookie and follow the existing error-shape and role-check
conventions (`docs/lab-03/api-spec.md` §0).

| Method | Path | Purpose | Allowed roles |
|---|---|---|---|
| POST | `/api/tickets/:id/actions-taken` | Create an Action Taken | IT Staff, Administrator |
| GET | `/api/tickets/:id/actions-taken` | List Actions Taken, oldest first | Requester (own Ticket), IT Staff, Administrator |
| PATCH | `/api/tickets/:id/actions-taken/:actionId` | Update an Action Taken | IT Staff, Administrator |
| PATCH | `/api/staff/tickets/:id/status` | Status transition, now with `expectedUpdatedAt` conflict check | IT Staff, Administrator |
| PATCH | `/api/staff/tickets/:id/it-priority` | Set IT Priority, now with `expectedUpdatedAt` conflict check | IT Staff, Administrator |
| POST | `/api/staff/tickets/:id/owner` | Claim/assign/reassign, now with `expectedUpdatedAt` conflict check | IT Staff, Administrator |
| GET | `/api/dashboard/requester` | Requester Dashboard data (BR-19/BR-20) | Requester |
| GET | `/api/dashboard/staff` | IT Staff/Administrator Dashboard data (BR-21/BR-22) | IT Staff, Administrator |

All other Lab 1-3 endpoints keep their existing paths, shapes, and status
codes unchanged, except that `GET /api/tickets` and `GET /api/staff/
tickets` accept a comma-separated `status` value in addition to a single
value (BR-27).

## 9. Acceptance Criteria

- AC-01 Given a permitted IT Staff user and valid data, when an Action
  Taken is created, then it is saved under the correct Ticket with the
  authenticated creator recorded as Performed By.
- AC-02 Given an authenticated Requester, when Requester Dashboard data is
  retrieved, then only metrics and recent Tickets owned by that Requester
  are returned.
- AC-03 Given `followUpRequired: true` and no Follow-up Note, when an
  Action Taken is created or updated, then the request is rejected with
  400 and no record is written/changed.
- AC-04 Given a Ticket owned and worked by IT Staff A, when IT Staff B
  creates an Action Taken on it, then it is saved with Performed By = IT
  Staff B while the Ticket's Owner remains IT Staff A (BR-02).
- AC-05 Given a Requester session, when a create/update Action Taken
  endpoint is called directly, then it is rejected with 403 and no record
  is written/changed, regardless of any UI restriction.
- AC-06 Given a Ticket with three Actions Taken, when the Requester who
  owns it opens Ticket Detail, then all three are visible, oldest first,
  with every field from §4.1.
- AC-07 Given a create-Action-Taken request retried with the same
  idempotency key after a network timeout, when the second request
  arrives, then no second record is created and the original is returned.
- AC-08 Given a Ticket at its current `updatedAt`, when IT Staff A submits
  a status change concurrently with IT Staff B's own change, then the
  second write to reach the server is rejected with 409 and its Status
  change is not applied.
- AC-09 Given a Ticket in status `New`, when IT Staff attempts to set it
  directly to `Closed`, then the request is rejected because that
  transition is not in the matrix (unchanged from Lab 3 AC-17).
- AC-10 Given a Ticket resolved without any Action Taken ever created on
  it, when IT Staff sets Status to `Resolved`, then the transition
  succeeds (BR-16 — no Action Taken gate exists).
- AC-11 Given an IT Staff user with two Tickets unassigned and one Ticket
  owned by them, when they open the IT Staff Dashboard, then Unassigned
  shows 2 and My Assigned shows 1, each linking to the Queue pre-filtered
  accordingly.
- AC-12 Given an IT Staff user who has authored zero Actions Taken, when
  they open the IT Staff Dashboard, then My Recent Actions Taken renders
  its defined empty state, not an error.
- AC-13 Given a Requester with zero Tickets, when they open the Requester
  Dashboard, then every metric shows 0 and every list renders its defined
  empty state.
- AC-14 Given the Administrator Dashboard, when it is opened, then it
  shows the same metrics as the IT Staff Dashboard plus an Accounts card
  with active-user counts by Role.
- AC-15 Given an Action Taken created by IT Staff A, when IT Staff B edits
  its Description and Result, then the update succeeds and Performed By
  still shows IT Staff A (BR-09/BR-10).
- AC-16 Given all Lab 1-3 automated tests, when the Lab 4 test suite runs
  against `main`, then they continue to pass unmodified in behavior
  (regression, FR-12).
- AC-17 Given IT Staff holding a Ticket at `updatedAt` T, when the
  Requester uploads an Attachment (bumping `updatedAt`) and IT Staff then
  submits a status change with `expectedUpdatedAt = T`, then 409 is
  returned with the fresh Ticket in `current`, and a retry using it
  succeeds (BR-14).
- AC-18 Given Tickets in several statuses, when `GET /api/staff/tickets?
  status=NEW,OPEN` is requested, then only New and Open Tickets are
  returned, a single-value `status` behaves as before, and an invalid
  token in the list returns 400 (BR-27).

## 10. Definition of Done

The AI coding agent may report Lab 4 complete only when all of the
following hold on the final `main` branch:

- Every FR, BR, and AC above is implemented; none silently narrowed or
  skipped.
- All Lab 1-3 tests (`server/tests/lab-0{1,2,3}/*`, the corresponding
  `client/.../lab-0{1,2,3}` component tests, and `e2e/lab-0{1,2,3}/*`)
  still pass unmodified in behavior, proving the regression requirement.
- `server/tests/lab-04/*`, the four `client/.../lab-04` component test
  files, and `e2e/lab-04/*` all pass with zero skipped/disabled/todo
  tests, from the commands documented in `tests.md`.
- Every Acceptance Criterion above has at least one passing automated test
  tracing back to it.
- Cross-role access (Requester → create/update Action Taken, non-Admin →
  Administrator-only endpoints, non-authenticated → any protected route)
  is verified to return the correct 401/403 by automated tests, not just
  manual inspection.
- The concurrency check (BR-17) is verified by an automated test that
  performs two concurrent writes and asserts the second is rejected with
  409, not just documented.
- No dashboard metric is computed from anything other than
  `Ticket`/`ActionTaken`/`User` tables at request time (BR-23) — verified
  by comparing a metric's displayed value to a direct database query in at
  least one test/screenshot pair per metric.
- Screens conform to `ui-spec.md`; loading/empty/no-results/forbidden/
  conflict/failure states are visually verified against Playwright
  screenshots at desktop/tablet/mobile, not personal memory.
- README setup, migration, seed, and test-run instructions are current for
  Lab 4 and were followed to produce the passing-test evidence.
- No required test, endpoint, or screen is unrelated to an approved FR/BR/
  AC.

## 11. Assumptions and Decisions

Meaningful choices not already fixed by the handout, each with its reason:

1. Action Taken's date/time is the server-clock creation timestamp, not a
   client-editable field — the handout's UI section (§8.3) is more
   specific than its requirements list (§4.1) and is taken as governing
   (BR-04).
2. `Result` is free text with no enum — the handout gives no fixed set of
   result values, and inventing one would narrow what IT Staff can record
   without a stated need.
3. Any active IT Staff/Administrator, not only the original performer, may
   update an Action Taken — matches the existing shared-ownership model
   for Ticket assignment (lab-03 BR-18) rather than introducing a new,
   stricter single-author rule the handout never asks for.
4. Resolving a Ticket does **not** require an existing Action Taken
   (BR-16) — the handout's stakeholder text asks for IT Staff review via
   the existing status action, not a new enforcement gate, and the
   handout explicitly excludes SLA/escalation-style machinery of that
   kind.
5. Ticket concurrency reuses the existing `updatedAt` column as the
   version token (`expectedUpdatedAt` in the request body) instead of
   adding a new integer version column — `updatedAt` already changes on
   every Ticket write and needs no migration.
6. Action Taken create/update never bumps `Ticket.updatedAt` — an Action
   Taken edit must not invalidate another user's in-flight Ticket status
   change. Attachment upload/removal and resolve-indication also bump it
   (lab-02 BR-39, lab-03 BR-24), so a Requester attaching a file can cause
   a staff 409; accepted as a safe, recoverable false-positive (BR-14).
7. The concurrency check (BR-17) applies only to Ticket Status/Owner/IT
   Priority writes, not to Action Taken updates — the handout's §6.1
   conflict requirement is stated specifically for "Ticket Resolution and
   Conflict Behavior," and extending it to every child record would be
   unrequested scope.
8. Action Taken creation reuses the Ticket-creation idempotency-key
   pattern (`@@unique([ticketId, idempotencyKey])`) rather than a new
   mechanism, satisfying the handout's duplicate-submission hardening
   requirement (§8.5) with an already-proven approach.
9. Dashboard "recently updated/resolved" lists use a fixed top-5 count
   ordered by `updatedAt`/`createdAt`, not a calendar-day cutoff —
   sidesteps a client-timezone-dependent boundary while still satisfying
   "recently" (handout §6.2 asks the contract to define this explicitly).
10. Administrator Dashboard reuses the IT Staff Dashboard endpoint and UI
    unchanged, adding only the Accounts card — the handout explicitly
    allows this reuse (§4.6) and building a separate screen would
    duplicate logic with no stated benefit.
11. Actions Taken are listed oldest first, matching the existing Public
    Comment/Internal Note ordering convention, rather than newest first —
    keeps one chronological-log convention across the whole app.
12. Attachment Notes is capped at 500 characters, shorter than
    Description/Result's 2000 — it is a short pointer ("see photo attached
    to comment #3"), not primary content, so a smaller limit is reasonable
    without being restrictive.
13. Deleting an Action Taken is not built — the handout's role table only
    grants "create and update," and an audit-style log is more defensible
    without a delete path, consistent with Comments/Notes already being
    append-only.
14. The `status` filter on the existing Lab 2/3 list endpoints is extended
    to accept a comma-separated list (BR-27) rather than adding a second,
    dashboard-only query endpoint — a grouped metric like "My Open
    Tickets" needs several statuses at once, and extending the parameter
    keeps one query mechanism instead of two that would need to stay in
    sync.
15. Ticket writes under BR-17 use a single conditional write (`updateMany`
    with `where: { id, updatedAt: expectedUpdatedAt }`, `count === 0` →
    409) on all three endpoints, not check-then-update, so two concurrent
    requests cannot both pass the check. Today the status endpoint's
    `updateMany` is conditioned on the current status only, not `updatedAt`,
    and the owner and it-priority endpoints use a plain `update`; Lab 4
    changes all three (status keeps its current-status condition and adds
    the `updatedAt` one).
16. Lab 2's BR-39 (attachment upload/removal touches the parent Ticket's
    `updatedAt`) was implemented as `ticket.update({ data: {} })`, which
    Prisma treats as a no-op, so `updatedAt` never actually changed and the
    Lab 2 test could not tell (it asserts `>=`). Lab 4 fixes it to set
    `updatedAt` explicitly, because BR-14/BR-17 depend on it. This is the
    one Lab 2 behavior change beyond BR-27; it makes the code match Lab 2's
    own written rule.
17. Tests whose contracts Lab 4 supersedes on purpose are updated, not
    left failing: Lab 3 `staff-ticket-detail.api.test.ts` now sends
    `expectedUpdatedAt` (BR-17), and Lab 2 `my-tickets.api.test.ts` API-28
    uses an unrecognized status instead of `RESOLVED` (BR-27). AC-16's
    "unmodified in behavior" means every other Lab 1-3 behavior; these two
    edits are the contract changes themselves.
18. A stale write is detected before the change is judged (api-spec §2 step
    4) as well as by the atomic write (step 6): the pre-check gives stale
    callers the right message, the atomic write closes the race.
