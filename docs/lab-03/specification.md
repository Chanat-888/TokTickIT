# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the temporary Development Requester selector with real, session-based
authentication and single-role authorization, so the application supports
three roles — Requester, IT Staff, and Administrator — each seeing only the
navigation and data their role permits, enforced on the server, not just
hidden in the UI. Requesters keep every Lab 2 ticket/attachment capability
under their authenticated identity and gain Public Comments and a "Problem
Appears Resolved" action; IT Staff gain a Ticket Queue and Ticket Detail
workflow (claim/assign, IT Priority, status transitions, Public Comments,
Internal Notes); Administrators gain one minimal User Management screen.

## 2. Stakeholder Request Interpretation

The Development Requester selector was a placeholder; the product now needs
real accounts. Anyone using the system logs in with an email and password,
and a user given a temporary initial password must choose their own before
they can do anything else. Requesters keep working exactly as in Lab 2, but
their identity now comes from who is logged in, not from a dropdown — and
they can talk to IT Staff through comments and flag when a problem looks
fixed, without being able to formally close it themselves. IT Staff get a
real queue to find and work tickets: claim them, set an internal priority,
move them through a defined status workflow, and keep a private paper trail
(Internal Notes) separate from what the Requester sees (Public Comments).
Administrators get exactly one screen to manage accounts — create people,
fix their basic details, turn accounts on/off, and reset a forgotten
password — nothing more elaborate. Every one of these actions must be
enforced by the backend; a button that is merely hidden is not security.

## 3. Scope

### Included

- Login, Logout, current-authenticated-user retrieval, and mandatory
  first-login password change.
- Role-based navigation and server-side authorization for Requester, IT
  Staff, and Administrator.
- Migration of Lab 2 `RequesterUser` records into the new `User` model
  (role `REQUESTER`), preserving Ticket ownership.
- Continued Requester ticket/attachment functions (Lab 2) under the
  authenticated session identity, plus Public Comments and "Problem Appears
  Resolved" on Requester Ticket Detail.
- IT Staff Ticket Queue: search, filter, sort, pagination, responsive
  layout.
- IT Staff Ticket Detail: claim/assign/reassign ownership, IT Priority,
  permitted status transitions, Public Comments, Internal Notes.
- Minimalist Administrator User Management: list, search, optional role
  filter, create, edit basic fields, set a new initial password, activate/
  deactivate with safety rules.

### Explicitly excluded

- Email invitations, password-reset email, multi-factor authentication,
  social login, single sign-on.
- Self-registration and Requester-created accounts.
- Actions Taken by IT Staff (deferred to Lab 4).
- Formal SLA calculation, escalation rules, notification services.
- Dashboards and KPI analytics beyond the Queue's own row counts.
- Multi-tenant organizations, departments, customer administration.
- Production-grade deployment or cloud infrastructure changes.
- Multiple roles per user; user deletion, bulk user operations,
  import/export, account-history screens.
- Department, organization, profile-photo, or other extended user-profile
  fields.
- Account unlocking, admin-approval workflows, advanced identity-management
  functions.
- Login rate limiting / account lockout after repeated failed attempts —
  not required by the labsheet and not built speculatively (§11.8).
- Mandatory pagination, multi-column sorting, or multiple simultaneous
  filters on the Administrator user list.
- Editing or deleting Public Comments / Internal Notes (append-only only).

## 4. Functional Requirements

**Authentication**

- FR-01 A user authenticates with email and password via `POST /auth/login`.
- FR-02 An authenticated user ends their session via `POST /auth/logout`.
- FR-03 An authenticated user retrieves their own identity and role via
  `GET /auth/me`.
- FR-04 A user whose account requires a password change cannot reach any
  screen except Change Password until a new valid password is saved.
- FR-05 The application shell shows only the navigation destinations
  permitted for the current user's role.

**Requester regression**

- FR-06 All Lab 2 Requester ticket and attachment functions (create, list
  with search/filter/sort/pagination, detail, add/remove attachment)
  operate using the authenticated Requester's session identity.
- FR-07 A Requester posts a Public Comment on an owned Ticket and views all
  Public Comments on it.
- FR-08 A Requester marks an owned, non-terminal Ticket as "problem appears
  resolved" without changing its Status.

**IT Staff**

- FR-09 IT Staff retrieve the Ticket Queue with search, filters, sorting,
  and pagination.
- FR-10 IT Staff open Ticket Detail for any Ticket (ownership is not
  required to view).
- FR-11 IT Staff claim an unassigned Ticket, or assign/reassign its Owner
  to any active IT Staff or Administrator user.
- FR-12 IT Staff set a Ticket's IT Priority.
- FR-13 IT Staff change a Ticket's Status along the permitted transition
  matrix (§5, Business Rules).
- FR-14 IT Staff post a Public Comment on any Ticket.
- FR-15 IT Staff write an Internal Note on any Ticket and view all Internal
  Notes on it.

**Administrator**

- FR-16 An Administrator views the user list with search by name/email and
  an optional role filter.
- FR-17 An Administrator creates a user with name, email, one role,
  activation state, and an initial password.
- FR-18 An Administrator edits a user's name, email, role, and activation
  state.
- FR-19 An Administrator sets a new initial password for a user, forcing a
  password change at that user's next login.
- FR-20 An Administrator activates or deactivates a user, subject to the
  self-deactivation and last-active-Administrator safety rules (§5).

## 5. Business Rules

- BR-01 Only an active user with valid credentials may authenticate.
- BR-02 A user marked as requiring a password change cannot enter the
  normal application until a new valid password is saved.
- BR-03 The authenticated user identity, not a `requesterId` supplied by the
  client, determines ownership of Requester operations.
- BR-04 Public Comments are visible to the Requester, IT Staff, and
  Administrator. Internal Notes are visible only to IT Staff and
  Administrator.
- BR-05 A Requester may indicate that the problem appears resolved, but
  cannot formally set the Ticket to Resolved or Closed.
- BR-06 A user has exactly one role (`REQUESTER`, `IT_STAFF`, or
  `ADMINISTRATOR`), stored as a single enum field; Lab 3 has no multi-role
  or role-history support.
- BR-07 A password (initial or changed) must be at least 8 characters and
  contain at least one letter and one digit; this rule applies identically
  to Change Password and to an Administrator setting a new initial
  password.
- BR-08 Passwords are hashed with bcrypt (cost factor 12) before storage;
  plaintext passwords are never stored or logged (§11.2).
- BR-09 Email is matched case-insensitively for login and stored
  lowercased; a nonexistent email and a wrong password both return the
  identical 401 message, never revealing which was wrong or whether the
  account exists.
- BR-10 A login attempt with correct credentials for an inactive account
  returns a distinct 403 "account inactive" message rather than the
  generic 401 (labsheet §8.1 requires a clear inactive-account response);
  this is the one place Lab 3 deliberately confirms account existence, and
  is scoped to inactive-but-correct-credentials only.
- BR-11 Logout deletes the server-side Session row for the caller's token;
  a request using that token afterward is treated as unauthenticated.
- BR-12 A session expires 12 hours after login, with no sliding renewal in
  Lab 3; an expired session is treated as unauthenticated.
- BR-13 `GET /auth/me` never returns `passwordHash` or the raw session
  token.
- BR-14 Email addresses are unique (case-insensitive) across all users;
  creating or editing a user with an email already in use is rejected with
  409.
- BR-15 The Lab 2 `X-Requester-Id` header and Development Requester
  selector are removed entirely; Requester identity for every Ticket/
  Attachment operation comes from the authenticated session (BR-03).
- BR-16 A Ticket has zero or one Owner, who must be an active User with
  role `IT_STAFF` or `ADMINISTRATOR` at assignment time; this is enforced
  in application code, since Postgres cannot express a role-conditional
  foreign key.
- BR-17 IT Priority is initialized to the same value as Requested Priority
  at Ticket creation; only IT Staff or Administrator may change it
  afterward.
- BR-18 Any active IT Staff or Administrator may claim an unassigned
  Ticket, or assign/reassign a Ticket's Owner to any active IT Staff or
  Administrator user, regardless of the Ticket's current Owner.
- BR-19 Ticket Status may be changed only by IT Staff or Administrator,
  only along the transition matrix below, and only via the dedicated
  status-change action — never as a side effect of claiming or assigning
  ownership.
- BR-20 Public Comments and Internal Notes are append-only: no edit or
  delete endpoint exists for either in Lab 3.
- BR-21 A Comment/Note body is rejected if empty or whitespace-only after
  trimming, and is limited to 2000 characters.
- BR-22 Every Comment/Note records its author from the session (never
  client-supplied) and its creation time from the server clock.
- BR-23 An Internal Note endpoint rejects a Requester's request with 403
  and returns no note content in the response body.
- BR-24 A Requester's "Problem Appears Resolved" action records a flag/
  timestamp on the Ticket and does not itself change Status; only IT Staff
  or Administrator formally set Resolved or Closed.
- BR-25 An Administrator cannot deactivate their own account (409).
- BR-26 The system always keeps at least one active Administrator; the
  last active Administrator cannot be deactivated or have their role
  changed away from Administrator.
- BR-27 Users are never deleted; Administrators only activate/deactivate.
- BR-28 An inactive user cannot authenticate (BR-01/BR-10) and cannot be
  newly assigned as a Ticket Owner (BR-16), but Tickets they already own
  and Comments/Notes they already authored remain unchanged and visible.
- BR-29 An Administrator setting a new initial password sets
  `mustChangePassword = true`; the user must change it at their next
  successful login before reaching any other screen (BR-02).
- BR-30 Creating a user requires name, a unique email, one role, an
  activation state, and an initial password meeting BR-07;
  `mustChangePassword` is always `true` for a newly created user.
- BR-31 Editing a user changes only name, email, role, and activation
  state; it never touches the password — setting a new initial password
  (BR-29) is a separate, explicit action.
- BR-32 The Ticket Queue search matches Ticket Number by prefix or Summary
  by case-insensitive substring (same rule as Lab 2 My Tickets); default
  sort is Created Date descending with id descending as a tiebreaker,
  applied universally for the same reason as Lab 2 (deterministic paging
  when the sorted field is not unique).
- BR-33 The Queue default page size is 10 with allowed sizes 10/20/50
  (same as Lab 2). An out-of-range `page`/`pageSize` number is clamped; an
  invalid `sortBy`, `sortDir`, `status`, or `itPriority` filter value
  returns 400.
- BR-34 All Lab 2 Requester Ticket/Attachment business rules remain in
  force unchanged except where explicitly superseded above (BR-03, BR-15)
  — attachment type/size/count limits and idempotent ticket creation are
  unaffected by Lab 3.
- BR-35 A successful password change invalidates the user's other active
  sessions; only the session that made the request stays valid.
- BR-36 `isActive` is checked on every authenticated request, not only at
  login. A session belonging to a user who becomes inactive is rejected on
  its next request.

### Status transition matrix

Allowed by IT Staff or Administrator only (BR-19); a Requester-initiated
status change is always rejected regardless of current status.

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

Any pair not listed above is rejected with 409. Transitions **to**
`Cancelled` or `Closed` require an explicit confirmation step in the UI
(§6); all other transitions do not.

## 6. UI Specification Summary

Full detail is deferred to `ui-spec.md`; this section fixes the structure
that document must follow.

- **Login**: email, password, validation, busy state, safe failure
  feedback, distinct inactive-account message (BR-10).
- **Change Password**: shown instead of any other screen when
  `mustChangePassword` is true; new-password rules (BR-07) and
  confirmation field.
- **Application shell**: current user's name and role, role-specific
  navigation only, Logout — replaces the Lab 2 Development Requester
  display entirely.
- **Requester Ticket Detail**: unchanged Lab 2 layout plus a Public
  Comments panel and a "Problem Appears Resolved" action; ownership
  protection unchanged.
- **IT Staff Ticket Queue**: search, filters, sortable columns,
  pagination, Owner/Status/Priority badges; desktop table collapses to
  stacked cards below 768px (same rule as Lab 2 My Tickets).
- **IT Staff Ticket Detail**: claim/assign/reassign control, IT Priority
  control, status-change control restricted to matrix-legal targets,
  visually distinct Public Comments tab and Internal Notes tab, existing
  Lab 2 attachment panel unchanged.
- **Administrator User Management**: one screen, list + search + optional
  role filter, create/edit forms, set-new-initial-password action; self-
  deactivation and last-Administrator controls disabled/rejected per
  BR-25/BR-26.
- Loading, empty, no-results, forbidden, not-found, conflict, and safe-
  failure feedback are required wherever a screen can reach that state
  (§9 Definition of Done).

## 7. Data Changes

### Models

- **`User`** (renames/replaces `RequesterUser`) — `id`, `name`, `email`
  (unique, stored lowercased), `passwordHash`, `role` (`Role` enum:
  `REQUESTER` / `IT_STAFF` / `ADMINISTRATOR`), `isActive` (existing,
  default `true`), `mustChangePassword` (default `true`), `createdAt`
  (existing), `updatedAt` (new).
- **`Session`** (new) — `id`, `userId` (FK → `User`), `tokenHash` (SHA-256
  of the opaque cookie value — the raw token is never stored), `createdAt`,
  `expiresAt`.
- **`Ticket`** (extended) — adds `ownerId` (nullable FK → `User`),
  `itPriority` (`Priority` enum, same enum Requested Priority already
  uses), `requesterIndicatedResolvedAt` (nullable, BR-24). `status` keeps
  its existing `TicketStatus` enum column, extended with new values
  (below).
- **`PublicComment`** (new) — `id`, `ticketId` (FK → `Ticket`), `authorId`
  (FK → `User`), `body`, `createdAt`.
- **`InternalNote`** (new) — `id`, `ticketId` (FK → `Ticket`), `authorId`
  (FK → `User`), `body`, `createdAt`.
- **`Category`**, **`RelatedSystem`**, **`Attachment`** — unchanged from
  Lab 2.

### Enums

- `Role` (new): `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
- `TicketStatus` (extended in place via `ALTER TYPE ... ADD VALUE`, not
  replaced): adds `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`,
  `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED` to the existing `NEW`.
  Every Lab 2 Ticket already has status `NEW`, so no data migration is
  needed on this column.
- `Priority` — unchanged; reused for `itPriority` (§11.5).

### Relationships

- One `User` (role `REQUESTER`) → many submitted Tickets (unchanged FK,
  renamed from `requester`).
- One `User` (role `IT_STAFF`/`ADMINISTRATOR`) → many owned Tickets
  (`ownerId`, nullable).
- One `Ticket` → many `PublicComment`, many `InternalNote`.
- One `User` → many `PublicComment`/`InternalNote` as author.
- One `Session` → one `User`.

### Indexes and constraints

- `User.email` unique (existing `RequesterUser.email` unique constraint
  carries over).
- `Session.tokenHash` unique; `Session.userId` indexed.
- `Ticket.ownerId` indexed (Queue filters/sorts by it).
- `Ticket.status` indexed (Queue filters by it).
- `PublicComment.ticketId` and `InternalNote.ticketId` indexed.

### Migration plan

- **Decision**: generate the migration with `prisma migrate dev
  --create-only`, then hand-edit the SQL to `ALTER TABLE "RequesterUser"
  RENAME TO "User"` followed by `ALTER TABLE "User" ADD COLUMN ...`,
  instead of accepting Prisma's default drop-and-recreate diff. This
  preserves existing `User.id` values so `Ticket.requesterId` (FK,
  unrenamed) keeps resolving correctly with zero data rewriting.
- Newly added `User` columns: `passwordHash` (temporarily nullable during
  the migration step, backfilled immediately, then made `NOT NULL` in the
  same migration), `role` (default `REQUESTER` — correct for every
  migrated row), `mustChangePassword` (default `true`), `updatedAt`
  (backfilled from `createdAt`).
- Migrated Requesters receive one shared, documented local-dev password
  (§11.9) with `mustChangePassword = true`, hashed with bcrypt like any
  other password (BR-08).
- `Ticket.ownerId`, `itPriority`, `requesterIndicatedResolvedAt` are added
  as nullable columns — every existing Lab 2 Ticket is unassigned
  (`ownerId = null`) with `itPriority` backfilled equal to its existing
  `requestedPriority`.
- `PublicComment` and `InternalNote` ship as new empty tables in the same
  migration.
- Verification: the migration is run against a copied database first
  (Phase 3 of the work plan); row counts and every existing Ticket's
  `requesterId` are diffed before/after to confirm no ownership drift.

### Seed data

Beyond Lab 2's existing seed (Categories, Related Systems):

- 4 active Requester `User` rows, 1 inactive Requester `User` row.
- 3 active IT Staff `User` rows, 1 inactive IT Staff `User` row.
- 1 active Administrator `User` row.
- Existing Lab 2 seeded Tickets keep their `requesterId`; a subset is
  additionally given an `ownerId` (active IT Staff/Admin), a mix of the
  new `status` values, and `itPriority` sometimes changed from
  `requestedPriority` — so Queue filters, sorts, and IT Priority all have
  non-trivial data to exercise.
- A handful of example Public Comments and Internal Notes on seeded
  Tickets, with no sensitive content.
- Seed is idempotent (safe to re-run) — matching the Lab 2 seed script's
  existing upsert pattern.
- All seeded passwords are documented in the README as local-development-
  only; no real secret is committed.

## 8. API Contract

Full detail is deferred to `api-spec.md`. Every endpoint below (except
`POST /auth/login`) requires a valid session cookie; a missing/invalid/
expired session returns 401. `mustChangePassword = true` blocks every
endpoint except `/auth/me`, `/auth/logout`, and `/auth/change-password`
with 403 (BR-02).

| Method | Path | Purpose | Allowed roles |
|---|---|---|---|
| POST | `/auth/login` | Authenticate, set session cookie | anyone (unauthenticated) |
| POST | `/auth/logout` | Invalidate session | any authenticated user |
| GET | `/auth/me` | Current user identity/role | any authenticated user |
| POST | `/auth/change-password` | Set a new password, clears `mustChangePassword` | any authenticated user |
| GET/POST/... | `/api/tickets...`, `/api/tickets/:id/attachments...` | Lab 2 Requester endpoints, unchanged shape, session-scoped | Requester (own Tickets only) |
| POST | `/api/tickets/:id/comments` | Create a Public Comment | Requester (own), IT Staff, Administrator |
| GET | `/api/tickets/:id/comments` | List Public Comments | Requester (own), IT Staff, Administrator |
| POST | `/api/tickets/:id/resolve-indication` | "Problem appears resolved" | Requester (own) |
| GET | `/api/staff/tickets` | Ticket Queue (search/filter/sort/page) | IT Staff, Administrator |
| GET | `/api/staff/tickets/:id` | Ticket Detail for staff | IT Staff, Administrator |
| POST | `/api/staff/tickets/:id/owner` | Claim/assign/reassign Owner | IT Staff, Administrator |
| GET | `/api/staff/assignable-users` | Active IT Staff/Administrator users for the Owner picker | IT Staff, Administrator |
| PATCH | `/api/staff/tickets/:id/it-priority` | Set IT Priority | IT Staff, Administrator |
| PATCH | `/api/staff/tickets/:id/status` | Status transition | IT Staff, Administrator |
| POST | `/api/tickets/:id/notes` | Create an Internal Note | IT Staff, Administrator |
| GET | `/api/tickets/:id/notes` | List Internal Notes | IT Staff, Administrator |
| GET | `/api/admin/users` | User list (search/role filter) | Administrator |
| POST | `/api/admin/users` | Create user | Administrator |
| PATCH | `/api/admin/users/:id` | Edit name/email/role/activation | Administrator |
| POST | `/api/admin/users/:id/password` | Set new initial password | Administrator |

## 9. Acceptance Criteria

- AC-01 Given an active user with valid credentials, when the user logs in,
  then the backend establishes authenticated access and returns the
  permitted user identity and role.
- AC-02 Given a user who must change the initial password, when login
  succeeds, then normal application screens remain unavailable until a
  valid new password is saved.
- AC-03 Given an authenticated Requester, when the client supplies another
  `requesterId`, then the backend still applies the authenticated identity
  and does not return another Requester's data.
- AC-04 Given a Requester account, when an Internal Note endpoint is
  requested, then the operation is rejected without exposing note content.
- AC-05 Given a wrong password for an existing active user, when login is
  attempted, then 401 is returned with the generic message and no session
  cookie is set.
- AC-06 Given an inactive user's correct credentials, when login is
  attempted, then 403 is returned with the distinct inactive-account
  message and no session cookie is set.
- AC-07 Given an authenticated user, when Logout is called, then the
  session is deleted server-side and a later request with the old cookie
  is treated as unauthenticated.
- AC-08 Given an Administrator sets a new initial password for a user,
  when that user next logs in with it, then they are forced into Change
  Password before reaching any other screen.
- AC-09 Given a Requester's authenticated session, when Lab 2 ticket/
  attachment endpoints are called, then they behave identically to Lab 2
  except the identity comes from the session, not a header.
- AC-10 Given an owned Ticket, when the Requester posts a Public Comment,
  then it appears on Ticket Detail with the Requester's name and a server
  timestamp.
- AC-11 Given an owned, non-terminal Ticket, when the Requester clicks
  "Problem Appears Resolved", then the flag is recorded and the Ticket's
  Status is unchanged.
- AC-12 Given 30+ Tickets across categories/statuses/owners, when IT Staff
  opens the Ticket Queue, then results page at the documented default size
  with correct pagination metadata.
- AC-13 Given a Queue search term matching a Ticket Number prefix, when IT
  Staff searches, then only matching Tickets are shown.
- AC-14 Given an unassigned Ticket, when an IT Staff user clicks Claim,
  then that Ticket's Owner becomes the acting IT Staff user.
- AC-15 Given a Ticket owned by IT Staff A, when IT Staff B reassigns it to
  themselves, then the Owner updates to IT Staff B and the change is
  visible in both the Queue and Ticket Detail.
- AC-16 Given a Ticket with Requested Priority `HIGH`, when the Ticket is
  created, then IT Priority is initialized to `HIGH`.
- AC-17 Given a Ticket in status `New`, when IT Staff attempts to set it
  directly to `Closed`, then the request is rejected because that
  transition is not in the matrix.
- AC-18 Given a Ticket in status `In Progress`, when IT Staff sets it to
  `Resolved`, then the transition succeeds and is recorded.
- AC-19 Given a Requester account, when a status-change endpoint is
  requested directly, then it is rejected with 403 regardless of any UI
  restriction.
- AC-20 Given an owned Ticket, when IT Staff writes an Internal Note, then
  it is visible to IT Staff/Administrator on Ticket Detail but never
  appears in any Requester-facing response.
- AC-21 Given the Administrator user list, when an Admin searches by
  partial email, then only matching users are shown.
- AC-22 Given a new-user form with an email already in use, when the
  Administrator submits it, then 409 is returned and no user is created.
- AC-23 Given the currently-authenticated Administrator's own account,
  when they attempt to deactivate it, then the request is rejected with
  409 and the account remains active.
- AC-24 Given exactly one active Administrator, when an Admin attempts to
  deactivate that account or change its role away from Administrator,
  then the request is rejected and the system still has one active
  Administrator.
- AC-25 Given a non-Administrator session, when any `/api/admin/users`
  endpoint is requested directly, then it is rejected with 403.
- AC-26 Given the Lab 2-to-Lab-3 migration has run, when a migrated
  Requester logs in with their documented seed password, then login
  succeeds and their pre-existing Tickets are still owned by them under
  the new `User` id.
- AC-27 Given a viewport under 768px, when the IT Staff Ticket Queue is
  open, then Tickets render as stacked cards, not a horizontally-scrolling
  table.

## 10. Definition of Done

The AI coding agent may report Lab 3 complete only when all of the
following hold on the final `main` branch:

- Every FR, BR, and AC above is implemented; none silently narrowed or
  skipped.
- All Lab 2 tests (`server/tests/lab-02/*`, `client/.../lab-02` tests,
  `e2e/lab-02/*`) still pass unmodified in behavior, proving the
  regression requirement.
- `server/tests/lab-03/*`, the five `client/.../lab-03` component test
  files, and `e2e/lab-03/*` all pass with zero skipped/disabled/todo
  tests, from the commands documented in `tests.md`.
- Every Acceptance Criterion has at least one passing automated test
  tracing back to it.
- Cross-role and cross-ownership access (Requester → Internal Notes,
  Requester → status-change, non-Admin → `/api/admin/users`,
  non-authenticated → any protected route) is verified to return the
  correct 401/403 by automated tests, not just manual inspection.
- The Lab 2 → Lab 3 migration is verified on a copied database: row counts
  and every Ticket's owning Requester match before and after.
- No plaintext password appears in the database, logs, or source control;
  passwords are bcrypt-hashed (BR-08).
- No client-supplied `requesterId` is trusted anywhere in the Requester
  code path (BR-03).
- Screens conform to `ui-spec.md`; loading/empty/no-results/forbidden/not-
  found/conflict/failure states are visually verified against Playwright
  screenshots at desktop/tablet/mobile, not personal memory.
- README setup, migration, seed, and test-run instructions are current and
  were followed to produce the passing-test evidence; seeded credentials
  are documented as local-dev-only.
- No required test, endpoint, or screen is unrelated to an approved FR/BR/
  AC.

## 11. Assumptions and Decisions

Meaningful choices not already fixed by the labsheet, each with its
reason:

1. `RequesterUser` is renamed to `User` via a hand-edited migration
   (`ALTER TABLE ... RENAME TO`) rather than dropped and recreated —
   preserves existing ids so `Ticket.requesterId` needs no data rewrite.
2. Password hashing uses **bcrypt**, not argon2 — bcrypt is the more
   battle-tested choice in the Node ecosystem for a course-scale app and
   avoids argon2's native-build friction on a Windows dev machine, which
   this project's environment is.
3. Sessions are **DB-backed** (`Session` table, opaque random token in an
   httpOnly cookie), not JWT — a JWT cannot be invalidated on logout
   without a server-side blocklist, which is exactly the complexity a
   DB-backed session already avoids; BR-11 (logout must actually
   invalidate) is trivial with this choice and awkward with a bare JWT.
4. CSRF mitigation relies on `SameSite=Lax` (plus `Secure` outside local
   dev) and same-origin `fetch` calls, with no separate CSRF token —
   `SameSite=Lax` already blocks cross-site POST/PATCH/DELETE with the
   cookie attached, which covers this app's actual attack surface at
   course scope; a double-submit token is not built speculatively.
5. IT Priority reuses the existing `Priority` enum (`LOW`/`MEDIUM`/`HIGH`)
   rather than introducing a separate range — nothing in the labsheet
   asks IT Priority to have different granularity than Requested Priority.
6. `Ticket.ownerId`'s "must be IT Staff or Administrator" rule is enforced
   in application code only, not a DB constraint — Postgres foreign keys
   cannot condition on another column's value without a trigger, which is
   more machinery than this rule is worth here.
7. Status transitions are a dedicated action, decoupled from claim/assign
   — claiming or reassigning a Ticket never changes its Status as a side
   effect, keeping two orthogonal concerns independently testable.
8. No login rate limiting or account lockout is built — the labsheet
   excludes MFA/SSO but is silent on lockout; adding one would be
   speculative for a scope this size and is deferred rather than invented.
9. Migrated Lab 2 Requesters all receive one shared, documented local-dev
   initial password (`mustChangePassword = true`) rather than per-user
   random passwords — Lab 3 explicitly excludes email delivery, so a
   random, undeliverable password would lock every migrated account out
   with no recovery path.
10. Email uniqueness is case-insensitive (stored lowercased) — prevents
    duplicate accounts differing only by letter case, consistent with
    BR-14 and common practice.
11. `TicketStatus` is extended in place (`ALTER TYPE ... ADD VALUE`)
    rather than replaced — every existing Lab 2 Ticket already has status
    `NEW`, so no data migration is needed on that column.
12. The Ticket Queue and IT Staff Ticket Detail live under `/api/staff/...`
    rather than reusing `/api/tickets/...` — keeps staff-only, non-
    ownership-scoped queries syntactically distinct from the Requester's
    own-tickets-only endpoints, reducing the chance of an authorization
    check being copy-pasted from the wrong sibling.
