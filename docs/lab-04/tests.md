# Lab 4 Test Plan

Sources of truth, in this order: `specification.md`, `api-spec.md`,
`ui-spec.md` (all authoritative). This document maps FR/BR/AC/UI rules onto
concrete tests. No code is included; test files are written phase by phase (TDD).
Every row's `Final` column is blank until its test file is written and
passes — a row moves to Pass only when its test exists and passes on its
feature branch, never earlier.

---

## 1. Test Strategy

Same six levels and tools as Lab 2/3 (`docs/lab-02/tests.md` §1): Unit
(Vitest), API/Integration (Vitest + Supertest against `toktickit_test`), UI
Component (Vitest + React Testing Library), UI Style (same, asserting only
`ui-spec.md` §6 class names), Responsive (Playwright), E2E (Playwright).

**ID scheme**: `UNIT-nn`, `API-nn`, `UI-nn`, `STYLE-nn`, `RESP-nn`,
`E2E-nn`, continuously numbered within this document.

**Files.** The handout fixes: server `actions-taken.api.test.ts`,
`ticket-workflow.api.test.ts`, `requester-dashboard.api.test.ts`,
`staff-dashboard.api.test.ts` (in `server/tests/lab-04/`); client
`StaffDashboard.test.tsx`, `RequesterDashboard.test.tsx`,
`ActionsTaken.test.tsx`, `TicketWorkflow.test.tsx` (in
`client/tests/lab-04/`); e2e `actions-taken-flow.spec.ts`,
`ticket-resolution.spec.ts`, `dashboards.spec.ts` (in `e2e/lab-04/`). Added
beyond the minimum: `server/tests/lab-04/action-validation.unit.test.ts`,
`server/tests/lab-04/status-rules.unit.test.ts`,
`server/tests/lab-04/status-filter.api.test.ts`,
`server/tests/lab-04/migration-regression.api.test.ts`,
`client/tests/lab-04/style/dashboard.style.test.tsx`,
`client/tests/lab-04/style/actions-taken.style.test.tsx`, and
`e2e/lab-04/responsive-visual.spec.ts`.

**Regression.** `server/tests/lab-0{1,2,3}/*`, `client/tests/lab-0{1,2,3}`
and `e2e/lab-0{1,2,3}/*` are re-run unmodified against Lab 4 code
(FR-12, AC-16); `migration-regression.api.test.ts` adds Lab 4-specific
checks on top, not a replacement.

**Concurrency tests are deterministic.** API-16/API-17 fire two requests
with the same `expectedUpdatedAt` via `Promise.all` and assert exactly one
200 and one 409 — the atomic conditional write (BR-17) makes this outcome
guaranteed, not timing-dependent.

**Database isolation.** Dedicated `toktickit_test` database, migrated once
in global setup, truncated between tests (same as Labs 2/3).

**Boundaries.** Every length limit (BR-05 2000, BR-06 2000, BR-07 500) gets
a test at its edge value (max passes, max+1 fails).

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-05 | Description/Result validator boundaries | empty/whitespace fails; 2000 passes; 2001 fails | `server/tests/lab-04/action-validation.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-06, AC-03 | Follow-up rule | `followUpRequired:true` + empty note fails; true + note passes; false + note → note dropped | `server/tests/lab-04/action-validation.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-07 | Attachment Notes limit | 500 passes; 501 fails; absent passes | `server/tests/lab-04/action-validation.unit.test.ts` | Pass |
| UNIT-04 | Unit | BR-15 | Status-transition legality (unchanged matrix) | every pair in specification.md §5 allowed; every other pair, incl. from Cancelled, rejected | `server/tests/lab-04/status-rules.unit.test.ts` | Pass |
| UNIT-05 | Unit | BR-27 | `status` list parser | `NEW,OPEN` → two values; single value unchanged; unknown token → error | `server/tests/lab-04/status-rules.unit.test.ts` | Pass |

### 2.2 API/Integration

**actions-taken.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01, BR-01, BR-03 | IT Staff `POST /api/tickets/:id/actions-taken` valid | 201; under correct Ticket; `performedById` = session user even if client sends another | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | AC-04, BR-02 | Staff B creates on a Ticket owned by Staff A | 201; Performed By = B; Ticket owner still A | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-03, BR-06 | Create with `followUpRequired:true`, no note | 400 field error on `followUpNote`; nothing written | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | BR-05, BR-07 | Create with empty/oversize description, result, attachmentNotes | 400 per field | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-05, BR-08 | Requester `POST` and `PATCH` Action Taken | 403 for both; nothing written | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-06, BR-11, BR-12 | Owning Requester `GET` list on Ticket with 3 actions | 200; 3 items, oldest first, all fields | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | BR-11 | Requester `GET` list on another Requester's Ticket | 404, same body as nonexistent Ticket | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | AC-07, BR-13 | Same `idempotencyKey` posted twice | second returns 200 with original; one row in DB | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | AC-15, BR-09, BR-10 | Staff B `PATCH` description/result of Staff A's action | 200; Performed By still A; `ticketId`/`createdAt` unchanged even if sent | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-10 | API | BR-14 | Create then update an Action Taken | parent `Ticket.updatedAt` unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-11 | API | api-spec.md §1 | `PATCH` with actionId of another Ticket; unknown Ticket | 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-12 | API | api-spec.md §0 | Any Action Taken endpoint with no session | 401 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |

**ticket-workflow.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-13 | API | AC-09, BR-15 | `New` → `Closed` | 409 "Status transition not permitted" | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-14 | API | AC-10, BR-16 | `In Progress` → `Resolved` on a Ticket with zero Actions Taken | 200 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-15 | API | BR-15, lab-03 AC-19 | Requester `PATCH` status/it-priority/owner directly | 403 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-16 | API | AC-08, BR-17 | Two status changes, same `expectedUpdatedAt`, fired concurrently | exactly one 200, one 409 with `current` Ticket | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-17 | API | BR-17, §11.15 | Same concurrent pair on owner and on it-priority endpoints | exactly one 200, one 409 each (proves conditional write on all three) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-18 | API | AC-17, BR-14 | Requester uploads Attachment, then staff status change with old `expectedUpdatedAt` | 409 + `current`; retry with `current.updatedAt` succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-19 | API | BR-17 | Same as API-18 after Requester resolve-indication | 409; retry succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-20 | API | BR-17 | Write with missing/malformed `expectedUpdatedAt` | 400 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-21 | API | BR-18, lab-03 BR-24 | Requester resolve-indication | Status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |

**status-filter.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-22 | API | AC-18, BR-27 | `GET /api/staff/tickets?status=NEW,OPEN` | only New and Open Tickets | `server/tests/lab-04/status-filter.api.test.ts` | Pass |
| API-23 | API | BR-27 | `GET /api/tickets?status=NEW,OPEN,IN_PROGRESS,REOPENED` as Requester | only that Requester's matching Tickets | `server/tests/lab-04/status-filter.api.test.ts` | Pass |
| API-24 | API | BR-27 | Single value and invalid list token | single unchanged; `NEW,BOGUS` → 400 | `server/tests/lab-04/status-filter.api.test.ts` | Pass |

**requester-dashboard.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-25 | API | AC-02, BR-19 | Requester A `GET /api/dashboard/requester`, `requesterId` query set to B | only A's data; parameter ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | |
| API-26 | API | BR-20 | Counts and lists vs. a direct DB query for seeded Requester | `myOpenTickets`, `waitingForRequester` equal DB counts; lists ≤5, ordered by `updatedAt` desc; resolved list only Resolved/Closed | `server/tests/lab-04/requester-dashboard.api.test.ts` | |
| API-27 | API | AC-13 | Requester with zero Tickets | 200; both counts 0; both lists `[]` | `server/tests/lab-04/requester-dashboard.api.test.ts` | |
| API-28 | API | api-spec.md §3 | Staff/Admin session calls requester dashboard; no session | 403; 401 | `server/tests/lab-04/requester-dashboard.api.test.ts` | |
| API-29 | API | BR-20 | Requester with 7 recently updated Tickets | list capped at 5 | `server/tests/lab-04/requester-dashboard.api.test.ts` | |

**staff-dashboard.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-30 | API | AC-11, BR-21 | 2 unassigned + 1 owned non-terminal Tickets for caller | `unassigned` counts, `myAssigned` = 1; terminal-status Tickets excluded | `server/tests/lab-04/staff-dashboard.api.test.ts` | |
| API-31 | API | BR-21, BR-23 | `byStatus` | all 8 keys present, zeros included, equals DB group counts | `server/tests/lab-04/staff-dashboard.api.test.ts` | |
| API-32 | API | AC-12 | Staff user with zero owned Tickets and zero actions | `myAssigned:0`, `myRecentActionsTaken:[]` | `server/tests/lab-04/staff-dashboard.api.test.ts` | |
| API-33 | API | BR-21 | `myRecentActionsTaken` | only caller's actions, newest first, ≤5, includes `ticketNumber` | `server/tests/lab-04/staff-dashboard.api.test.ts` | |
| API-34 | API | AC-14, BR-22 | Administrator vs. IT Staff response | Admin has `accounts` with active-user counts by role; IT Staff `accounts: null` | `server/tests/lab-04/staff-dashboard.api.test.ts` | |
| API-35 | API | api-spec.md §3 | Requester/no session calls staff dashboard | 403; 401 | `server/tests/lab-04/staff-dashboard.api.test.ts` | |

**migration-regression.api.test.ts**

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-36 | Migration | specification.md §7 | Apply Lab 4 migration on a copy of the Lab 3 DB | row counts of every pre-existing table unchanged; legacy Tickets have empty Actions Taken list | `server/tests/lab-04/migration-regression.api.test.ts` | Pass |
| API-37 | Migration | §5.3 of handout | Run seed twice | identical row counts; ≥1 Ticket with 0, 1, and 2+ actions; one Ticket whose owner ≠ action performer | `server/tests/lab-04/migration-regression.api.test.ts` | Pass |
| API-38 | Regression | AC-16 | Lab 1-3 server suites | pass unmodified | `server/tests/lab-0{1,2,3}/*` | |
| API-39 | Performance-smoke | BR-23 | Both dashboard endpoints on seeded DB, 20 sequential calls | each responds under 500 ms | `server/tests/lab-04/migration-regression.api.test.ts` | |

### 2.3 UI Component

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI | ui-spec.md §4.3 | Staff Actions Taken tab renders list | rows oldest first with description, result, performer, timestamp | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-02 | UI | BR-06 | Toggle Follow-Up Required | Follow-up Note field appears only when checked; empty submit shows field message; API not called | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-03 | UI | FR-14 | Submit busy state / double click | button disabled while pending; one API call | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-04 | UI | ui-spec.md §4.3 | Edit row inline, Cancel | fields prefilled; Cancel restores read view without API call | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-05 | UI | BR-11, AC-06 | Requester view | list shown; no Create form, no Edit control | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-06 | UI | ui-spec.md §4.3 | Empty tab; API failure | "No actions recorded yet."; safe error with entered form values preserved | `client/tests/lab-04/ActionsTaken.test.tsx` | |
| UI-07 | UI | ui-spec.md §3, BR-17 | Status write returns 409 | `.ticket-conflict-banner` next to Operations panel; Refresh re-fetches and re-enables controls | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-08 | UI | lab-03 ui-spec §5.6 | Status control options | only legal targets from current status listed; Cancelled/Closed open confirm dialog | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-09 | UI | FR-13 | Status/owner write sends `expectedUpdatedAt` from last fetch; success refreshes summary status | request body includes it; header status updates | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-10 | UI | ui-spec.md §4.1 | Staff dashboard renders cards and lists from API | Unassigned, My Assigned, By Status chips, Recently Updated, My Recent Actions Taken | `client/tests/lab-04/StaffDashboard.test.tsx` | |
| UI-11 | UI | AC-12, BR-23 | Zero-state, loading, forbidden, failure | cards show 0 (not hidden); list empty text; skeleton while loading; forbidden/failure copy | `client/tests/lab-04/StaffDashboard.test.tsx` | |
| UI-12 | UI | BR-25, api-spec.md §3.1 | Count card drill-down links | each link's href/query equals the api-spec.md §3.1 table | `client/tests/lab-04/StaffDashboard.test.tsx` | |
| UI-13 | UI | AC-14 | Accounts card | shown for Administrator only | `client/tests/lab-04/StaffDashboard.test.tsx` | |
| UI-14 | UI | ui-spec.md §4.2 | Requester dashboard cards, lists, drill-down, states | counts, both lists, links to My Tickets with status query, empty state for zero Tickets | `client/tests/lab-04/RequesterDashboard.test.tsx` | |
| UI-15 | UI | ui-spec.md §4 | Nav and landing | Dashboard nav entry active; landing screen per role after login | `client/tests/lab-04/StaffDashboard.test.tsx` | |

### 2.4 UI Style

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| STYLE-01 | Style | ui-spec.md §6 | Metric card classes | `.dashboard-grid`, `.metric-card`, `.metric-card__value`, `.metric-card__link` present; `0` value still rendered | `client/tests/lab-04/style/dashboard.style.test.tsx` | |
| STYLE-02 | Style | ui-spec.md §5.2 | List panel | `.list-panel`, `.list-panel__row` present; rows are keyboard-focusable | `client/tests/lab-04/style/dashboard.style.test.tsx` | |
| STYLE-03 | Style | ui-spec.md §2 | Follow-up chip | present only when `followUpRequired`; has text label, not colour alone | `client/tests/lab-04/style/actions-taken.style.test.tsx` | |
| STYLE-04 | Style | ui-spec.md §4.3 | Actions Taken form | required asterisks, labels above controls, validation message adjacent to field, edit-icon `aria-label` | `client/tests/lab-04/style/actions-taken.style.test.tsx` | |

### 2.5 Responsive

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| RESP-01 | Responsive | ui-spec.md §5.1 | Staff dashboard at 1280/800/375 px | row of cards → 2 per row → single column; no horizontal scroll; screenshots to `artifacts/lab-04/screenshots/staff-dashboard/` | `e2e/lab-04/responsive-visual.spec.ts` | |
| RESP-02 | Responsive | ui-spec.md §4.2 | Requester dashboard, same three widths | same rules; screenshots to `requester-dashboard/` | `e2e/lab-04/responsive-visual.spec.ts` | |
| RESP-03 | Responsive | ui-spec.md §4.3 | Actions Taken tab (list, create, edit, empty) at three widths | no clipping/overlap; screenshots to `actions-taken/` | `e2e/lab-04/responsive-visual.spec.ts` | |
| RESP-04 | Responsive | ui-spec.md §3 | Conflict banner state at three widths | visible, not overlapping controls; screenshots to `ticket-workflow/` | `e2e/lab-04/responsive-visual.spec.ts` | |

### 2.6 End-to-End

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-04, AC-15 | Staff A logs in, adds an Action Taken; Staff B edits it | appears in list; performer stays A after B's edit | `e2e/lab-04/actions-taken-flow.spec.ts` | |
| E2E-02 | E2E | AC-03, AC-06 | Invalid follow-up shows field message; Requester then sees all actions read-only | message shown; no edit controls for Requester | `e2e/lab-04/actions-taken-flow.spec.ts` | |
| E2E-03 | E2E | AC-09, AC-10, BR-18 | Requester marks "appears resolved" (status unchanged); staff moves Ticket to Resolved | status changes only after staff action | `e2e/lab-04/ticket-resolution.spec.ts` | |
| E2E-04 | E2E | AC-08, AC-17 | Two staff sessions on one Ticket; second submits stale status change | conflict banner; Refresh then retry succeeds | `e2e/lab-04/ticket-resolution.spec.ts` | |
| E2E-05 | E2E | AC-11, BR-25 | Staff dashboard count card click | Queue opens pre-filtered with matching count | `e2e/lab-04/dashboards.spec.ts` | |
| E2E-06 | E2E | AC-02, AC-13 | Requester dashboard values match DB; Requester with zero Tickets shows zeros | metrics equal DB query; empty states | `e2e/lab-04/dashboards.spec.ts` | |
| E2E-07 | E2E | AC-16, FR-12 | Representative regression: login, My Tickets, Ticket Detail, attachment, public comment, internal note, admin user management | all still work | `e2e/lab-04/dashboards.spec.ts` | |

---

## 3. Acceptance-Criterion Traceability

| AC | Planned tests |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | API-25, E2E-06 |
| AC-03 | UNIT-02, API-03, UI-02, E2E-02 |
| AC-04 | API-02, E2E-01 |
| AC-05 | API-05 |
| AC-06 | API-06, UI-05, E2E-02 |
| AC-07 | API-08 |
| AC-08 | API-16, API-17, E2E-04 |
| AC-09 | UNIT-04, API-13, E2E-03 |
| AC-10 | API-14, E2E-03 |
| AC-11 | API-30, E2E-05 |
| AC-12 | API-32, UI-11 |
| AC-13 | API-27, UI-14, E2E-06 |
| AC-14 | API-34, UI-13 |
| AC-15 | API-09, E2E-01 |
| AC-16 | API-38, E2E-07 |
| AC-17 | API-18, API-19, E2E-04 |
| AC-18 | UNIT-05, API-22, API-23, API-24 |

Every AC above has at least one planned test. Business rules covered
beyond ACs: BR-05/06/07 (UNIT-01..03, API-03/04), BR-10 (API-09), BR-14
(API-10, API-18), BR-20/21/23 (API-26, API-31, API-33, API-39), BR-25
(UI-12, E2E-05).

## 4. Responsive and Visual Checklist

Completed per screen at desktop/tablet/mobile before the PDF is assembled
(Part 9). Each item is checked against `ui-spec.md`, not memory.

- [ ] Zen Green tokens used; no new colour introduced (Follow-up chip uses the existing Warning token only)
- [ ] Editable vs. read-only fields visually distinct (Actions Taken create/edit vs. Requester read view)
- [ ] Validation messages adjacent to their field
- [ ] Visible keyboard focus on cards, list rows, Edit action, Refresh action
- [ ] Non-colour status cues (badge text/icon, "Follow-up needed" label)
- [ ] No clipped labels, overlapping controls, or horizontal page scroll
- [ ] Metric cards show `0`, never disappear
- [ ] Loading, empty, forbidden, conflict, safe-failure states each captured
- [ ] Screenshot folders: `staff-dashboard/`, `requester-dashboard/`, `actions-taken/`, `ticket-workflow/`

## 5. Test Commands

```
cd server && npm test                          # unit + API + migration/regression (Vitest/Supertest, toktickit_test)
cd client && npm test                          # UI component + style (Vitest/RTL)
cd server && npm run prisma:seed && npm run prisma:seed
cd e2e && npx playwright test                  # responsive + E2E (dev servers, reseeded dev DB)
```

## 6. Final Results

To be filled from a run on `main` after the release PR merges: per-suite
pass counts, total, and the run date. Left blank until then.

## 7. Known Limitations or Deferred Tests

- Concurrency is proven at the API level with a deterministic
  same-`expectedUpdatedAt` pair (API-16/17), not by load testing;
  production-scale concurrency is out of scope (handout §4.2).
- Performance-smoke (API-39) is a coarse threshold on the seeded dataset,
  not a benchmark.
- Colour-contrast is checked by the visual checklist, not an automated
  contrast tool.
