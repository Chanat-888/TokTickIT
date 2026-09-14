# Lab 3 Test Plan

Sources of truth, in this order: `specification.md`, `api-spec.md`,
`ui-spec.md` (all merged and authoritative). This document does not
re-decide anything fixed there — it maps FR/BR/AC/UI rules onto concrete,
automatable tests. No code is included; the test files listed below do not
exist yet, this is the plan that governs what they must contain. Every
row's `Final` column is left blank until the corresponding test file is
written and run — same evidence format as `docs/lab-02/tests.md`.

---

## 1. Test Strategy

Same six test levels and tools as Lab 2 (`docs/lab-02/tests.md` §1):
Unit (Vitest), API/Integration (Vitest + Supertest against `toktickit_test`),
UI Component (Vitest + React Testing Library), UI Style (same, asserting
only `ui-spec.md` §7 class names), Responsive (Playwright), E2E
(Playwright).

**ID scheme**: `UNIT-nn`, `API-nn`, `UI-nn`, `STYLE-nn`, `RESP-nn`,
`E2E-nn`, each independently and continuously numbered within this
document (not reset per file).

**File locations.** The labsheet fixes 14 exact paths (specification.md
§12 / repository structure); this plan uses exactly those, plus a small
number of additional files for pure-logic unit tests, UI style assertions,
and the migration/regression suite — following the same pattern Lab 2
used to add files beyond its own minimum.

Server (`server/tests/lab-03/`): `auth.api.test.ts`,
`authorization.api.test.ts`, `staff-queue.api.test.ts`,
`staff-ticket-detail.api.test.ts`, `comments-notes.api.test.ts`,
`users-admin.api.test.ts` (all six labsheet-fixed), plus
`password.unit.test.ts`, `session.unit.test.ts`,
`status-transition.unit.test.ts`, and `migration-regression.api.test.ts`
(added).

Client (`client/tests/lab-03/`): `Login.test.tsx`,
`ChangePassword.test.tsx`, `StaffTicketQueue.test.tsx`,
`StaffTicketDetail.test.tsx`, `UserManagement.test.tsx` (all five
labsheet-fixed), plus `password-rules.unit.test.ts` and four files under
`client/tests/lab-03/style/` (`badges.style.test.tsx`,
`comment-panels.style.test.tsx`, `ticket-ops.style.test.tsx`,
`user-management.style.test.tsx`) (added).

E2E (`e2e/lab-03/`): `authentication.spec.ts`, `staff-ticket-flow.spec.ts`,
`user-administration.spec.ts` (all three labsheet-fixed), plus
`responsive-visual.spec.ts` (added, mirroring Lab 2's own addition of
`responsive-visual.spec.ts`).

**Regression as a first-class concern.** Lab 2's own four suites
(`server/tests/lab-02/*`, `client/tests/lab-02` tests, `e2e/lab-02/*`) are
re-run unmodified against the Lab 3 schema and code as part of Definition
of Done (specification.md §10); `migration-regression.api.test.ts` adds
Lab-3-specific migration checks on top, not a replacement for re-running
them.

**Database isolation.** Same as Lab 2 (§5 below): a dedicated
`toktickit_test` database, migrated once in global setup, truncated
between tests.

**What "boundaries" means here.** Every length/count/time limit in
specification.md §5 (BR-07, BR-12, BR-21, BR-33) gets at least one test at
its edge value, not only comfortably-inside/outside values.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-08 | bcrypt hash-then-compare round trip | A correct password compares true against its own hash; a wrong password compares false | `server/tests/lab-03/password.unit.test.ts` | |
| UNIT-02 | Unit | BR-07 | Password rule boundary | 7 chars fails; 8 chars with a letter+digit passes; all-letters fails; all-digits fails | `server/tests/lab-03/password.unit.test.ts` | |
| UNIT-03 | Unit | specification.md §7 (Session model) | Session token hashing (SHA-256) | Same raw token always hashes identically; two distinct tokens never collide in a small sample | `server/tests/lab-03/session.unit.test.ts` | |
| UNIT-04 | Unit | BR-12 | Session expiry check | A session with `expiresAt` in the past is treated as expired; one in the future is not | `server/tests/lab-03/session.unit.test.ts` | |
| UNIT-05 | Unit | BR-19 (transition matrix) | Status-transition legality function | Every pair listed in specification.md §5's matrix returns allowed; every other pair (including any pair starting from `Cancelled`) returns not-allowed | `server/tests/lab-03/status-transition.unit.test.ts` | |
| UNIT-06 | Unit | BR-07 | Client-side password rule mirror (used for inline Change-Password validation) | Same boundary behavior as UNIT-02, evaluated client-side with no network call | `client/tests/lab-03/password-rules.unit.test.ts` | |

### 2.2 API/Integration

**auth.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API/Integration | AC-01, BR-01 | `POST /auth/login` valid credentials | 200, User representation, `sid` cookie set | `server/tests/lab-03/auth.api.test.ts` | |
| API-02 | API/Integration | AC-05, BR-09 | `POST /auth/login` correct email, wrong password | 401, generic message, no cookie set | `server/tests/lab-03/auth.api.test.ts` | |
| API-03 | API/Integration | AC-06, BR-10 | `POST /auth/login` correct credentials, inactive account | 403, distinct inactive-account message, no cookie set | `server/tests/lab-03/auth.api.test.ts` | |
| API-04 | API/Integration | BR-09 | `POST /auth/login` nonexistent email | 401, byte-identical body to API-02 | `server/tests/lab-03/auth.api.test.ts` | |
| API-05 | API/Integration | api-spec.md §1 | `POST /auth/login` missing `email` or `password` | 400 | `server/tests/lab-03/auth.api.test.ts` | |
| API-06 | API/Integration | BR-13 | `GET /auth/me` authenticated | 200, User representation; response body has no `passwordHash` key | `server/tests/lab-03/auth.api.test.ts` | |
| API-07 | API/Integration | api-spec.md §0.1 | `GET /auth/me` unauthenticated | 401 | `server/tests/lab-03/auth.api.test.ts` | |
| API-08 | API/Integration | AC-07, BR-11 | `POST /auth/logout`, then reuse the same cookie on `GET /auth/me` | Logout 200; the later request returns 401 | `server/tests/lab-03/auth.api.test.ts` | |
| API-09 | API/Integration | AC-02, AC-08, BR-02 | `POST /auth/change-password` valid new password | 200, `mustChangePassword: false`; a subsequent `GET /api/tickets` with the same session now succeeds | `server/tests/lab-03/auth.api.test.ts` | |
| API-10 | API/Integration | api-spec.md §1 | `POST /auth/change-password` wrong `currentPassword` | 401 | `server/tests/lab-03/auth.api.test.ts` | |
| API-11 | API/Integration | BR-07 | `POST /auth/change-password` `newPassword` at 7 chars / missing a digit | 400 for each | `server/tests/lab-03/auth.api.test.ts` | |
| API-12 | API/Integration | AC-02, BR-02 | A session with `mustChangePassword: true` calls `GET /api/tickets` | 403, `"Password change required"`; the same session's `GET /auth/me` still succeeds | `server/tests/lab-03/auth.api.test.ts` | |
| API-13 | API/Integration | BR-12 | A session past its 12-hour `expiresAt` (clock mocked) calls `GET /auth/me` | 401, same as no session | `server/tests/lab-03/auth.api.test.ts` | |

**authorization.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-14 | API/Integration | api-spec.md §0.1 | `GET /api/tickets`, `GET /api/staff/tickets`, `GET /api/admin/users` with no session | 401 for each | `server/tests/lab-03/authorization.api.test.ts` | |
| API-15 | API/Integration | AC-19 | Requester session calls `GET /api/staff/tickets` | 403 | `server/tests/lab-03/authorization.api.test.ts` | |
| API-16 | API/Integration | AC-25 | IT Staff session calls `GET /api/admin/users` | 403 | `server/tests/lab-03/authorization.api.test.ts` | |
| API-17 | API/Integration | AC-04, BR-23 | Requester session calls `POST /api/tickets/:id/notes` and `GET /api/tickets/:id/notes` | 403 for both; response body has no `body`/note content | `server/tests/lab-03/authorization.api.test.ts` | |
| API-18 | API/Integration | BR-28 | An Administrator deactivates a user with a currently-open session; that session calls any endpoint | 401 immediately, before the session's natural expiry | `server/tests/lab-03/authorization.api.test.ts` | |
| API-19 | API/Integration | AC-03, BR-03, BR-15 | `POST /api/tickets` with a `requesterId` field in the body set to a different user's id | 201; the created Ticket's `requesterId` is the authenticated session's user id, not the supplied value | `server/tests/lab-03/authorization.api.test.ts` | |

**staff-queue.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-20 | API/Integration | AC-12, BR-33 | `GET /api/staff/tickets` default query, 30+ seeded Tickets | 10 items, correct `page`/`totalCount`/`totalPages` | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-21 | API/Integration | AC-13, BR-32 | `GET /api/staff/tickets?search=<ticket-number-prefix>` | Only matching Tickets | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-22 | API/Integration | FR-09 | `GET /api/staff/tickets?status=OPEN` | Only `OPEN` Tickets | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-23 | API/Integration | FR-09 | `GET /api/staff/tickets?itPriority=HIGH` | Only `HIGH` IT-Priority Tickets | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-24 | API/Integration | FR-09 | `GET /api/staff/tickets?ownerId=unassigned` | Only Tickets with `ownerId: null` | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-25 | API/Integration | BR-32 | `GET /api/staff/tickets?sortBy=itPriority&sortDir=desc` then `asc` | HIGH-first then LOW-first ordering, id-descending tiebreaker on ties | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-26 | API/Integration | BR-33 | Invalid `sortBy`, `status`, or `itPriority` query value | 400 for each | `server/tests/lab-03/staff-queue.api.test.ts` | |
| API-27 | API/Integration | BR-33 | `pageSize=999` (clamps) vs. `pageSize=15` (not an allowed size) | First clamps to 50; second returns 400 | `server/tests/lab-03/staff-queue.api.test.ts` | |

**staff-ticket-detail.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-28 | API/Integration | FR-10 | `GET /api/staff/tickets/:id` | 200, Ticket representation (staff view) plus `attachments[]`, `comments[]`, `notes[]` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-29 | API/Integration | AC-16, BR-17 | Create a Ticket with `requestedPriority: HIGH`, then fetch it via staff detail | `itPriority: "HIGH"` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-30 | API/Integration | AC-14, BR-18 | `POST /api/staff/tickets/:id/owner` on an unassigned Ticket, `ownerId` = caller | 200, `ownerId` updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-31 | API/Integration | AC-15, BR-18 | `POST .../owner` reassigning a Ticket already owned by a different IT Staff user | 200, `ownerId` updated regardless of previous owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-32 | API/Integration | BR-16 | `POST .../owner` with `ownerId` referencing a Requester, or an inactive IT Staff user | 400 for each | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-33 | API/Integration | FR-12, BR-17 | `PATCH .../it-priority` valid value | 200, `itPriority` updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-34 | API/Integration | AC-18 | `PATCH .../status` `In Progress` → `Resolved` | 200, `status` updated | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-35 | API/Integration | AC-17, BR-19 | `PATCH .../status` `New` → `Closed` | 409, `"Status transition not permitted"` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-36 | API/Integration | AC-19, BR-19 | `PATCH .../status` called with a Requester session | 403 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |
| API-37 | API/Integration | api-spec.md §3 | `owner`/`it-priority`/`status` endpoints against a nonexistent Ticket id | 404 for each | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | |

**comments-notes.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-38 | API/Integration | AC-10, FR-07 | `POST /api/tickets/:id/comments` by the owning Requester | 201, Comment representation with the Requester's name/role | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-39 | API/Integration | FR-14 | `POST /api/tickets/:id/comments` by IT Staff on a Ticket they don't own | 201 (no ownership requirement for staff) | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-40 | API/Integration | BR-04 | `GET /api/tickets/:id/comments` called by the Requester, then by IT Staff, then by Administrator | Identical Comment list returned to all three | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-41 | API/Integration | AC-20, FR-15 | `POST /api/tickets/:id/notes` by IT Staff | 201, Note representation | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-42 | API/Integration | AC-20, BR-04 | Every Requester-reachable response for a Ticket that has Internal Notes (`GET /api/tickets/:id`, comments list) | None of them include note content anywhere in the body | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-43 | API/Integration | BR-21 | Comment/Note `body` empty or whitespace-only | 400 for each | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-44 | API/Integration | BR-21 | Comment/Note `body` at 2000 chars (passes) and 2001 chars (fails) | 201 then 400 | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-45 | API/Integration | AC-11, BR-24 | `POST /api/tickets/:id/resolve-indication` by the owning Requester on a `New` Ticket | 200, `requesterIndicatedResolvedAt` set | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-46 | API/Integration | AC-11 | Same request, then re-fetch the Ticket | `status` unchanged (still `New`) | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-47 | API/Integration | api-spec.md §2 | `POST .../resolve-indication` on a `Closed` or `Cancelled` Ticket | 404 for each | `server/tests/lab-03/comments-notes.api.test.ts` | |
| API-48 | API/Integration | BR-22 | `POST .../comments` with an `authorId` field in the body set to a different user | 201; the stored `authorId` is the session's user, the body field is ignored | `server/tests/lab-03/comments-notes.api.test.ts` | |

**users-admin.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-49 | API/Integration | FR-16 | `GET /api/admin/users` unfiltered | 200, all seeded users | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-50 | API/Integration | AC-21 | `GET /api/admin/users?search=<partial email>` | Only matching users | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-51 | API/Integration | FR-16 | `GET /api/admin/users?role=IT_STAFF` | Only IT Staff users | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-52 | API/Integration | FR-17, BR-30 | `POST /api/admin/users` valid body | 201, `mustChangePassword: true` | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-53 | API/Integration | AC-22, BR-14 | `POST /api/admin/users` email already in use | 409; no user created | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-54 | API/Integration | BR-07, BR-30 | `POST /api/admin/users` invalid `role`, or `initialPassword` failing BR-07 | 400 for each | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-55 | API/Integration | FR-18, BR-31 | `PATCH /api/admin/users/:id` changes name/email/role/isActive | 200, updated fields; password untouched | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-56 | API/Integration | BR-14 | `PATCH .../:id` to an email already used by another user | 409 | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-57 | API/Integration | AC-23, BR-25 | `PATCH .../:id` deactivating the caller's own account | 409, account remains active | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-58 | API/Integration | AC-24, BR-26 | `PATCH .../:id` deactivating the sole active Administrator (a different account than the caller) | 409, account remains active | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-59 | API/Integration | BR-26 | `PATCH .../:id` changing the sole active Administrator's role away from `ADMINISTRATOR` | 409 | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-60 | API/Integration | FR-19, BR-29 | `POST /api/admin/users/:id/password` valid new password | 200, `mustChangePassword: true` | `server/tests/lab-03/users-admin.api.test.ts` | |
| API-61 | API/Integration | AC-25 | Every `/api/admin/users...` endpoint called with an IT Staff or Requester session | 403 for each | `server/tests/lab-03/users-admin.api.test.ts` | |

**migration-regression.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-62 | API/Integration | AC-26 | Run the Lab 2 → Lab 3 migration against a seeded Lab 2 copy | Every `RequesterUser` row becomes a `User` row with the same id and role `REQUESTER`; every Ticket's `requesterId` still resolves to the same person | `server/tests/lab-03/migration-regression.api.test.ts` | |
| API-63 | API/Integration | AC-09, AC-26 | A migrated Requester logs in with the documented seed password, then calls `GET /api/tickets` | 200, returns exactly their pre-existing Lab 2 Tickets | `server/tests/lab-03/migration-regression.api.test.ts` | |
| API-64 | API/Integration | specification.md §10 | Full `server/tests/lab-02/*` suite executed against the migrated Lab 3 schema | Every Lab 2 test passes unmodified | `server/tests/lab-03/migration-regression.api.test.ts` | |

### 2.3 UI Component

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI Component | ui-spec.md §5.1 | Login submit | Busy style while pending; disabled against double-submit | `client/tests/lab-03/Login.test.tsx` | |
| UI-02 | UI Component | AC-05 | 401 response from the server | Generic invalid-credentials message renders above the fields | `client/tests/lab-03/Login.test.tsx` | |
| UI-03 | UI Component | AC-06 | 403 response from the server | Distinct inactive-account message renders | `client/tests/lab-03/Login.test.tsx` | |
| UI-04 | UI Component | AC-01, AC-02 | Successful login | Routes to Change Password if `mustChangePassword`, else to the role's home screen | `client/tests/lab-03/Login.test.tsx` | |
| UI-05 | UI Component | BR-07 | New-password field, keystroke by keystroke | Inline validation message updates live against the length/letter/digit rule | `client/tests/lab-03/ChangePassword.test.tsx` | |
| UI-06 | UI Component | ui-spec.md §5.2 | Confirm-password mismatch | Submit blocked client-side; no API request sent | `client/tests/lab-03/ChangePassword.test.tsx` | |
| UI-07 | UI Component | AC-02, AC-08 | Successful change | Routes directly into the role-appropriate home screen, no extra confirmation screen | `client/tests/lab-03/ChangePassword.test.tsx` | |
| UI-08 | UI Component | ui-spec.md §5.5 | Queue loading state | Skeleton rows/cards render while the GET is in flight | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-09 | UI Component | ui-spec.md §5.5 | Populated Queue, desktop | All 8 columns render with correctly mapped values | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-10 | UI Component | AC-12 | Empty vs. no-results states | Distinct copy/actions for "no Tickets at all" vs. "filters match nothing" | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-11 | UI Component | ui-spec.md §5.5 | Owner column, `ownerId: null` row | Renders the muted "Unassigned" chip, not a blank cell | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-12 | UI Component | AC-13, FR-09 | Filter controls change | Triggers a new query carrying the selected Status/IT Priority/Owner/search values | `client/tests/lab-03/StaffTicketQueue.test.tsx` | |
| UI-13 | UI Component | AC-14, ui-spec.md §5.6 | Unassigned Ticket's Operations panel | Renders a one-click Claim button; an assigned Ticket instead renders the Owner select | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-14 | UI Component | AC-17, BR-19 | Status select options, Ticket currently `New` | Only `Open` and `Cancelled` are offered; no other option exists in the DOM | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-15 | UI Component | ui-spec.md §5.6 | Selecting `Cancelled` or `Closed` | Confirmation dialog opens; the PATCH request is sent only after Confirm | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-16 | UI Component | ui-spec.md §3 | Switching between the Public Comments tab and Internal Notes tab | Correct panel content and compose box render for the active tab | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-17 | UI Component | ui-spec.md §5.6 | IT Priority vs. Requested Priority controls | IT Priority renders editable-field styling; Requested Priority beside it stays read-only-styled | `client/tests/lab-03/StaffTicketDetail.test.tsx` | |
| UI-18 | UI Component | FR-16 | User list render | Name/Email/Role badge/Status pill/Edit action per row | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-19 | UI Component | AC-21 | Search box input | Triggers a filtered query; results update | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-20 | UI Component | AC-22 | Create form, server returns 409 | Inline message renders beside the Email field; form values preserved | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-21 | UI Component | AC-23, BR-25 | The currently-authenticated Administrator's own row | Active toggle renders disabled with an explanatory inline message | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-22 | UI Component | AC-24, BR-26 | The sole active Administrator's row (viewed by a different Admin) | Active toggle renders disabled with an explanatory inline message | `client/tests/lab-03/UserManagement.test.tsx` | |
| UI-23 | UI Component | ui-spec.md §5.7 | "Set New Initial Password" action | Opens a separate sub-panel, distinct from the name/email/role/active edit form | `client/tests/lab-03/UserManagement.test.tsx` | |

### 2.4 UI Style

Every row asserts on the exact class names fixed in `ui-spec.md` §7 — none
are invented for this document.

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| STYLE-01 | UI Style | ui-spec.md §2, §7 | Role badge, app shell and User list | `.role-badge` present with the correct role text | `client/tests/lab-03/style/badges.style.test.tsx` | |
| STYLE-02 | UI Style | ui-spec.md §2, §7 | Status badge on a `Closed`/`Cancelled` Ticket | `.status-badge--terminal` modifier present; absent on non-terminal statuses | `client/tests/lab-03/style/badges.style.test.tsx` | |
| STYLE-03 | UI Style | ui-spec.md §2, §7 | IT Priority badge | `.priority-badge--it` present and rendered after the Requested Priority badge in DOM order | `client/tests/lab-03/style/badges.style.test.tsx` | |
| STYLE-04 | UI Style | ui-spec.md §3, §7 | Public Comments panel vs. Internal Notes panel | `.comment-panel--public` and `.comment-panel--internal` each present on their respective tab, with the fixed header copy | `client/tests/lab-03/style/comment-panels.style.test.tsx` | |
| STYLE-05 | UI Style | ui-spec.md §5.6, §7 | IT Staff Ticket Detail Operations panel | `.ticket-ops-panel`, `.owner-select`, `.status-select` all present | `client/tests/lab-03/style/ticket-ops.style.test.tsx` | |
| STYLE-06 | UI Style | ui-spec.md §5.6, §7 | Status-change confirmation | `.confirm-dialog` present when targeting `Cancelled`/`Closed` | `client/tests/lab-03/style/ticket-ops.style.test.tsx` | |
| STYLE-07 | UI Style | ui-spec.md §5.7, §7 | User Management list | `.user-table` present (desktop); `.user-card` present (mobile width) | `client/tests/lab-03/style/user-management.style.test.tsx` | |

### 2.5 Responsive

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| RESP-01 | Responsive | AC-27 | Ticket Queue at <768px | Stacked cards render, no table, no horizontal page scroll | `e2e/lab-03/responsive-visual.spec.ts` | |
| RESP-02 | Responsive | ui-spec.md §6 | Ticket Queue at ≥992px and 768–991px | Full 8-column table at both | `e2e/lab-03/responsive-visual.spec.ts` | |
| RESP-03 | Responsive | ui-spec.md §5.1, §5.2 | Login and Change Password at all three breakpoints | Centered-card layout remains legible, no overflow | `e2e/lab-03/responsive-visual.spec.ts` | |
| RESP-04 | Responsive | ui-spec.md §5.6 | IT Staff Ticket Detail Operations panel at <768px | Controls stack to one column, no horizontal scroll | `e2e/lab-03/responsive-visual.spec.ts` | |
| RESP-05 | Responsive | ui-spec.md §5.7 | Administrator user list at <768px | `.user-card` stacked layout replaces `.user-table` | `e2e/lab-03/responsive-visual.spec.ts` | |
| RESP-06 | Responsive | ui-spec.md §8, specification.md §10 | Screenshot capture | One screenshot at every path fixed in `ui-spec.md` §8, at every listed viewport | `e2e/lab-03/responsive-visual.spec.ts` | |

### 2.6 E2E

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-02, AC-08 | Login with a must-change-password seeded user | Forced into Change Password, then lands on the role's home screen after a valid change | `e2e/lab-03/authentication.spec.ts` | |
| E2E-02 | E2E | AC-05, AC-06 | Invalid login, then a correct-credentials inactive-account login | Distinct messages shown for each | `e2e/lab-03/authentication.spec.ts` | |
| E2E-03 | E2E | AC-07 | Logout, then direct navigation to a protected URL | Redirects to Login | `e2e/lab-03/authentication.spec.ts` | |
| E2E-04 | E2E | AC-26 | A migrated Lab 2 Requester logs in with the documented seed password | Their pre-existing Tickets are visible in My Tickets | `e2e/lab-03/authentication.spec.ts` | |
| E2E-05 | E2E | AC-12, AC-13 | IT Staff logs in, searches/filters/sorts/paginates the Queue, opens Ticket Detail | Result sets update correctly end-to-end through the real API | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-06 | E2E | AC-14, AC-16, AC-18 | Claim an unassigned Ticket, set IT Priority, move it New → Open → In Progress → Resolved | Each step succeeds and is reflected immediately in the UI | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-07 | E2E | AC-10, AC-20 | IT Staff posts a Public Comment and writes an Internal Note; a second browser context, logged in as the owning Requester, views the same Ticket | The Requester sees the Comment but the Internal Note never appears anywhere in their view | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-08 | E2E | AC-17 | Status select on a Ticket in a known status | The illegal targets for that status are never offered as options | `e2e/lab-03/staff-ticket-flow.spec.ts` | |
| E2E-09 | E2E | AC-08, FR-17 | Administrator creates a user | That user's first login is forced into Change Password | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-10 | E2E | AC-22 | Administrator edits a user to an email already in use | Inline 409 message shown; no navigation away from the form | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-11 | E2E | AC-23 | Administrator attempts to deactivate their own account | Toggle is disabled / the attempt is rejected; account stays active | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-12 | E2E | AC-24 | With exactly one active Administrator, attempt to deactivate that account | Rejected; system still has one active Administrator | `e2e/lab-03/user-administration.spec.ts` | |
| E2E-13 | E2E | AC-25 | A Requester navigates directly to the User Management URL | Forbidden state renders, not the screen | `e2e/lab-03/user-administration.spec.ts` | |

---

## 3. Acceptance-Criterion Traceability

Every AC-01 through AC-27 maps to at least one test below.

| AC | Tests |
|---|---|
| AC-01 | API-01, UI-04, E2E-01 |
| AC-02 | API-09, API-12, UI-04, E2E-01 |
| AC-03 | API-19 |
| AC-04 | API-17 |
| AC-05 | API-02, UI-02, E2E-02 |
| AC-06 | API-03, UI-03, E2E-02 |
| AC-07 | API-08, E2E-03 |
| AC-08 | API-09, API-60, UI-07, E2E-01, E2E-09 |
| AC-09 | API-19, API-63 |
| AC-10 | API-38, E2E-07 |
| AC-11 | API-45, API-46 |
| AC-12 | API-20, UI-10, E2E-05 |
| AC-13 | API-21, UI-12, E2E-05 |
| AC-14 | API-30, UI-13, E2E-06 |
| AC-15 | API-31 |
| AC-16 | API-29, E2E-06 |
| AC-17 | API-35, UI-14, E2E-08 |
| AC-18 | API-34, E2E-06 |
| AC-19 | API-15, API-36 |
| AC-20 | API-41, API-42, E2E-07 |
| AC-21 | API-50, UI-19 |
| AC-22 | API-53, UI-20, E2E-10 |
| AC-23 | API-57, UI-21, E2E-11 |
| AC-24 | API-58, API-59, UI-22, E2E-12 |
| AC-25 | API-16, API-61, E2E-13 |
| AC-26 | API-62, API-63, E2E-04 |
| AC-27 | RESP-01 |

---

## 4. Responsive and Visual Checklist

Checked at the three breakpoints fixed by `docs/lab-02/ui-spec.md` §8
(reused, ui-spec.md §6). Screenshot paths fixed in `ui-spec.md` §8;
`{viewport}` expands to `desktop`, `tablet`, or `mobile`.

| Screen | Desktop (≥992px) | Tablet (768–991px) | Mobile (<768px) | Screenshot path(s) | Verified |
|---|---|---|---|---|---|
| Login / Change Password | centered card | centered card, same layout | centered card, full-width | `authentication/{login,change-password}-{viewport}.png` | [ ] |
| App shell (Lab 3 additions) | user name + Role badge + Logout | same | hamburger collapse (reused) | covered within each screen's own screenshots | [ ] |
| IT Staff Ticket Queue | 8-column table | table, narrower columns | `.user-card`-style stacked cards, no horizontal scroll | `staff-queue/staff-queue-list-{viewport}.png` (+ loading/empty/no-results/failure, desktop only) | [ ] |
| IT Staff Ticket Detail | Operations panel beside read-only fields | 2-column | 1-column, Operations panel above Attachments | `staff-ticket-detail/staff-ticket-detail-loaded-{viewport}.png` (+ claim/status-confirm/comments/notes, desktop only) | [ ] |
| Administrator User Management | `.user-table` | `.user-table`, narrower | `.user-card` stacked | `user-management/user-management-list-{viewport}.png` (+ create/edit/validation, desktop only) | [ ] |

Non-viewport visual checks (asserted via `RESP-*`/`STYLE-*`, manually
reviewed against the screenshots above, per specification.md §10's
"visually verified against Playwright screenshots, not personal memory"):

- [ ] No clipped labels, overlapping messages, hidden buttons at any of the
      three breakpoints.
- [ ] Read-only vs. editable field styling matches `ui-spec.md` §5.6 at
      every breakpoint (IT Priority editable, Requested Priority
      read-only, side by side).
- [ ] Role/Status/IT-Priority badge rules (§2) — icon/label + colour,
      never colour alone.
- [ ] Public Comments vs. Internal Notes panels are visually distinguishable
      at a glance (§3), at every breakpoint.
- [ ] Focus-visible outline is visible on every new interactive control
      (Owner select, Status select, Role filter, Active toggle) reached
      via keyboard.

---

## 5. Test Commands

Same overall approach as Lab 2 (`docs/lab-02/tests.md` §5): a dedicated
`toktickit_test` database, migrated once in global setup, truncated
between tests.

### 5.1 Truncation between tests (updated table list)

```sql
TRUNCATE TABLE "InternalNote", "PublicComment", "Attachment", "Ticket",
"Session", "User", "RelatedSystem", "Category"
RESTART IDENTITY CASCADE;
```

### 5.2 Running each suite

```
cd server && npm test        # Unit + API/Integration (Vitest + Supertest)
cd client && npm test        # UI Component + UI Style (Vitest + RTL)
cd e2e && npx playwright test   # Responsive + E2E (Playwright)
```

The E2E/Responsive suite requires the server and client dev servers
running against a seeded database (`npm run prisma:seed`, producing the
distribution specification.md §7 describes) — not `toktickit_test`.

---

## 6. Final Results

Not yet run. This plan was written before the Lab 3 client/server
implementation, following the same spec-first order as
`specification.md` → `api-spec.md` → `ui-spec.md` → this document. Once
the test files above exist and the full suite (including the re-run Lab 2
suites) passes with zero skipped/todo tests, this section is replaced
with the actual command output for each run, and every row's `Final`
column above is filled in.

---

## 7. Known Limitations or Deferred Tests

- **Login rate limiting / account lockout is untested** — specification.md
  §11.8 documents that Lab 3 does not build this, so no test asserts
  lockout behavior after repeated failed logins; this is a deliberate
  scope boundary, not an oversight.
- **CSRF token behavior is untested directly** — specification.md §11.4
  relies on `SameSite=Lax` plus same-origin `fetch`, not a separate CSRF
  token, so there is no dedicated CSRF-token test; the cross-origin-cookie
  behavior itself is a browser guarantee, not application code this
  project owns to test.
- **Administrator's IT Staff-operation access is tested as fully
  editable** — matching the resolved reading in `ui-spec.md` §9 (the
  labsheet's "does not automatically need to" is read as permissive here).
  If that reading is revisited, the affected tests are API-30–36 and
  UI-13–17, all of which currently exercise both IT Staff and
  Administrator sessions identically against staff endpoints.

---

## 8. Resolved decisions

- Test file for migration/regression coverage
  (`migration-regression.api.test.ts`) is additional to the labsheet's six
  fixed server file names, following the same pattern Lab 2 used
  (`ticket-number.unit.test.ts`, `ticket-validation.unit.test.ts`) to add
  files beyond its own minimum — the labsheet fixes required paths, not an
  exhaustive list.
- Cross-role Internal Note visibility (API-42) is checked by inspecting
  every Requester-reachable response shape rather than adding a
  test per endpoint, since BR-04/BR-23 apply identically to every one of
  them and a per-endpoint repeat would not catch a different class of bug.
