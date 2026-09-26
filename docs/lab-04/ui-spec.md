# Lab 4 UI Specification — Zen Green Theme

Sources of truth, in this order: `specification.md` and `api-spec.md`
(both merged and authoritative), then `docs/lab-02/ui-spec.md` (colour
tokens, typography/spacing scale, control states, button hierarchy,
accessibility rules, responsive breakpoint) and `docs/lab-03/ui-spec.md`
(role badge, status/IT-priority badges, forbidden/not-found/conflict
states, tabbed Public Comments/Internal Notes pattern) — all **reused
unchanged** per labsheet §7. This document covers only what Lab 4 adds or
changes: dashboards, the Actions Taken panel, and the new concurrency-
conflict copy.

No code and no `tests.md` content is included here. CSS class names fixed
in §6 are the ones `tests.md` must assert against.

---

## 1. Reused from Labs 2-3 (no changes)

- Colour tokens, typography/spacing, control states, validation-message
  placement, button hierarchy (`docs/lab-02/ui-spec.md` §1-§5).
- Screen-states pattern — initial/loading/validation/submitting/success/
  failure/forbidden/not-found/conflict (`docs/lab-02/ui-spec.md` §7,
  extended by `docs/lab-03/ui-spec.md` §4), extended again below (§3) with
  one new conflict copy variant.
- Responsive breakpoint and accessibility rules
  (`docs/lab-02/ui-spec.md` §8-§9).
- Role badge, Status badge, IT-Priority badge (`docs/lab-03/ui-spec.md`
  §2).
- Application shell and role-filtered navigation (`docs/lab-03/ui-spec.md`
  §5.3) — Lab 4 only adds a "Dashboard" nav entry (§4 below).
- IT Staff Ticket Detail Operations panel (Owner/IT Priority/Status
  controls) and Public Comments/Internal Notes tabs
  (`docs/lab-03/ui-spec.md` §5.6) — Lab 4 adds one more tab (§4.3) and the
  conflict-copy addition (§3), nothing else changes.
- Requester Ticket Detail layout (`docs/lab-03/ui-spec.md` §5.4) — Lab 4
  adds the read-only Actions Taken tab (§4.3), nothing else changes.

## 2. New indicator: Follow-Up Required

Not a new colour token — reuses the existing Warning token
(`docs/lab-02/ui-spec.md` §1) already reserved for non-decorative warning
use, applied here for the first time to a small inline chip:

| Element | Style |
|---|---|
| Follow-up chip | Amber-bordered small pill, text "Follow-up needed", shown on an Action Taken row only when `followUpRequired` is true (§0.2 of `api-spec.md`). Absent (not greyed-out) when false — a missing chip is the "no follow-up" state, avoiding a redundant "no follow-up" chip on every other row. |

## 3. Screen states: one new conflict copy variant

`docs/lab-03/ui-spec.md` §4 already defines the Conflict state's visual
language (inline message at the point of the action, never a page banner).
Lab 4 adds one new copy variant for the same visual pattern:

| State | When | Copy pattern |
|---|---|---|
| Conflict — stale ticket write | 409 from a status/owner/IT-priority write whose `expectedUpdatedAt` no longer matches (BR-17) | Inline message next to the Operations panel: "This ticket was changed by someone else." with a "Refresh" inline action button that re-fetches the Ticket and re-enables the controls — distinct from lab-03's "Status transition not permitted" copy (different cause, different recovery action: refresh vs. pick a different target status). |

## 4. Screen-by-screen

### 4.1 IT Staff / Administrator Dashboard

- New nav entry "Dashboard", first item after the app identity, active-
  page indication follows the existing shell pattern
  (`docs/lab-03/ui-spec.md` §5.3). This is also the landing screen after
  login for IT Staff/Administrator roles.
- Metric-card row (§5): Unassigned, My Assigned, plus one card per
  `TicketStatus` value from `byStatus` — rendered as a single "By Status"
  card group (one row of smaller count chips inside one card) rather than
  eight separate top-level cards, keeping the row scannable
  (specification.md handout's own "keep them concise" instruction).
- Below the metric row, two side-by-side list panels (stacked on
  tablet/mobile): "Recently Updated" (Tickets) and "My Recent Actions
  Taken" — same list-panel component (§5.2), each row clickable straight
  to its own Ticket Detail (§3.1 of `api-spec.md` — these are not count
  drill-downs).
- Administrator caller only: one additional small "Accounts" card showing
  three counts (Requester / IT Staff / Administrator), same metric-card
  component as the others, each count's drill-down opens User Management
  pre-filtered by that role (`?role=<role>`, reusing the existing optional
  role filter from `docs/lab-03/ui-spec.md` §5.7).
- States: loading (skeleton cards), empty (all counts legitimately 0 and
  both lists empty — e.g. a brand-new IT Staff account, BR-23 zero-state),
  forbidden, failure (§3 / `docs/lab-02/ui-spec.md` §7).

### 4.2 Requester Dashboard

- Replaces "My Tickets" as the Requester's landing screen after login;
  "My Tickets" remains in the nav unchanged (handout §8.2 — dashboard must
  not duplicate, only summarize and link to, the full list).
- Metric-card row: My Open Tickets, Waiting for Requester (§5).
- Two list panels: "Recently Updated" and "Recently Resolved", same
  list-panel component as §4.1, each row linking to that Ticket's
  Requester Ticket Detail.
- States: loading, empty (zero Tickets — a genuinely new Requester
  account), failure. No forbidden state is reachable here (the endpoint is
  Requester-only and self-scoped, §0 of `api-spec.md`).

### 4.3 Actions Taken panel (Ticket Detail)

- **IT Staff/Administrator Ticket Detail**: one new tab, "Actions Taken
  (N)" (count badge, same pattern as an existing tab count if any),
  positioned after Internal Notes.
  - List: each row shows Description, Result, a meta line ("<performer
    name> · <relative/absolute timestamp>"), the Follow-up chip (§2) when
    applicable, and Attachment Notes as a small paperclip icon + text when
    present. Oldest first (BR-12), consistent with the Comments/Notes
    ordering already established.
  - Each row has an Edit action (pencil icon, `aria-label="Edit this
    action"`) that turns the row into the same field set as Create (§4.3
    below), inline — no navigation, no modal — Cancel reverts to the
    read view without saving.
  - A persistent Create form sits above the list: Description (textarea),
    Result (textarea), Follow-Up Required (checkbox), Follow-up Note
    (textarea, only rendered when the checkbox is checked — progressive
    disclosure, BR-06), Attachment Notes (single-line input), Submit
    (busy-state pattern from `docs/lab-02/ui-spec.md` §7).
  - Validation messages render beside each field (BR-05/BR-06/BR-07),
    matching the existing field-level placement rule.
- **Requester Ticket Detail**: the same row rendering, read-only — no
  Create form, no Edit action, per BR-11. The Requester screen has no tab
  bar (it only ever had the Public Comments panel), so Actions Taken is a
  section titled "Actions Taken" between Attachments and Public Comments
  rather than a tab.
- **Component and states**: one shared `ActionsTakenPanel` serves both
  screens (`canEdit` on for staff). The tab label is "Actions Taken (N)"
  once loaded (plain "Actions Taken" while loading or after a failed
  load). A failed list load shows "Couldn't load actions taken." with a
  "Try again" button; a failed save shows "Couldn't save this action. Your
  entries are kept — please try again." and keeps every entered value.
  Create keeps one `idempotencyKey` per form until a save succeeds, so a
  retry after a network failure cannot create a duplicate (BR-13, FR-14);
  the submit button shows "Saving…", is disabled, and ignores repeat clicks
  while a request is in flight. Only one row is edited at a time.
  If a save is retried after its response was lost and the server answers
  200 instead of 201 (it had already saved and returned the original row,
  ignoring the new text, BR-13), the form is not cleared: the saved row
  appears in the list, the user's text stays in the form, a notice says
  "This action was already saved and is shown in the list. Your latest text
  was not applied; it is still in the form.", and the next submit uses a
  new idempotencyKey so it is a deliberate new action.
- **Icons**: the Edit control shows a pencil (✎, decorative) plus the
  visible word "Edit" and `aria-label="Edit this action"`, so it is never
  icon-only; Attachment Notes on a row are prefixed with a paperclip (📎,
  decorative) and the label "Attachment notes". The Create form renders
  above the list.
- The staff section heading is now "Comments, Notes and Actions Taken"
  (was "Public Comments and Internal Notes") because it holds three tabs.
- Empty state (zero Actions Taken on this Ticket, either role): "No
  actions recorded yet." text inside the tab, no illustration needed
  (matches the plain-text empty-state style already used elsewhere).

## 5. New component: metric card and list panel

### 5.1 Metric card

- White surface, existing card token (`docs/lab-02/ui-spec.md` §1: white
  background, subtle border, restrained shadow).
- Layout: small caption label at top ("Unassigned"), large bold number
  below, optional small "View all" text link (Secondary green,
  `docs/lab-02/ui-spec.md` §1) bottom-right.
- The whole card is clickable when a drill-down exists (§3.1 of
  `api-spec.md`) — cursor pointer, same focus-visible outline as any other
  interactive control (`docs/lab-02/ui-spec.md` §9).
- Always renders the number, including `0` — a card is never hidden or
  replaced by an empty-state message; only its linked list (§5.2) gets an
  empty state.
- Responsive: desktop row of cards (wraps at the container edge, not a
  forced fixed count), tablet 2-per-row, mobile single column — same
  breakpoint values as every other grid in this app
  (`docs/lab-02/ui-spec.md` §8).

### 5.2 List panel (Recently Updated / Recently Resolved / My Recent Actions Taken)

- Card container, header row ("Recently Updated"), up to 5 rows.
- Each row: primary text (Ticket Summary, or an Action Taken's
  Description truncated to one line), a small Status badge (for Ticket
  rows only, reusing `docs/lab-03/ui-spec.md` §2), and a trailing
  timestamp — entire row clickable, same focus/hover treatment as a table
  row elsewhere in the app.
- Empty state: single line of muted text inside the card body ("No recent
  activity yet." / "No actions recorded yet.") — never an empty white
  box with no explanation.

## 6. CSS class-naming table (new classes only)

Classes already defined in `docs/lab-02/ui-spec.md` §19 and
`docs/lab-03/ui-spec.md` §7 are reused unchanged wherever a Lab 4 screen
presents the same kind of element. New classes:

| Class | Element |
|---|---|
| `.dashboard-grid` | Metric-card row container (§5.1) |
| `.metric-card` | One metric card |
| `.metric-card__value` | The large number inside a metric card |
| `.metric-card__link` | "View all" drill-down link inside a metric card |
| `.status-breakdown` | The "By Status" card's internal chip group (§4.1) |
| `.list-panel` | Recently Updated / Recently Resolved / My Recent Actions Taken container (§5.2) |
| `.list-panel__row` | One clickable row inside a list panel |
| `.actions-taken-panel` | Actions Taken tab content area (§4.3) |
| `.action-taken-entry` | One Action Taken row (read view) |
| `.action-taken-entry__followup` | Follow-up chip (§2) |
| `.action-taken-form` | Create/Edit Action Taken form |
| `.ticket-conflict-banner` | Inline stale-write conflict message + Refresh action (§3) |

## 7. Screenshot paths

Following the Lab 2/3 convention (`docs/lab-02/ui-spec.md` §18) and
specification.md's repository structure. The handout's minimum structure
(§12) lists three folders; a fourth, `ticket-workflow/`, is added here for
the new concurrency-conflict evidence (§3), which doesn't fit under
Actions Taken or either dashboard — the same kind of documented addition
`docs/lab-03/ui-spec.md` §8 made for `requester-ticket-detail/`:

`artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow}/`,
one desktop + tablet + mobile capture per required screen state listed in
§3 and §4 above.

## 8. Open questions / resolved decisions

- **Resolved** — the IT Staff/Administrator Dashboard is the post-login
  landing screen for those roles, and the Requester Dashboard is the
  post-login landing screen for Requesters, replacing the Ticket Queue/My
  Tickets in that specific role (both remain reachable from the nav). The
  handout doesn't say explicitly what the landing screen should be after
  adding a dashboard, but the mockups (handout §8.1/§8.2, "Welcome back")
  read as a landing/home screen, not an optional extra tab — this project
  takes that reading rather than leaving the dashboard as a nav item
  nobody lands on by default.
