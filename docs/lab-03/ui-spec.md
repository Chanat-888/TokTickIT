# Lab 3 UI Specification — Zen Green Theme

Sources of truth, in this order: `specification.md` and `api-spec.md`
(both merged and authoritative), then `docs/lab-02/ui-spec.md` (colour
tokens, typography/spacing scale, control states, button hierarchy,
accessibility rules, and responsive breakpoint are **reused unchanged**
per labsheet §7/§8.7 — none of them are re-decided here). This document
covers only what Lab 3 adds or changes: new screens, new badges, and the
Public-Comment/Internal-Note visual distinction.

No code and no `tests.md` content is included here. CSS class names fixed
in §7 are the ones `tests.md` must assert against.

---

## 1. Reused from Lab 2 (no changes)

- Colour tokens (`docs/lab-02/ui-spec.md` §1), including the Warning-token
  reservation rule.
- Typography/spacing scale and shared control geometry (§2).
- Control states — default/hover/focus/disabled/error (§3).
- Required-field marker and validation-message placement (§4).
- Button hierarchy (§5).
- Screen states pattern — initial/loading/validation/submitting/success/
  failure (§7), extended below (§4 of this document) with forbidden/not-
  found/conflict, which Lab 3 introduces.
- Responsive breakpoint: desktop table ↔ stacked cards below 768px, no
  horizontal page scroll (§8).
- Accessibility rules — labelled controls, keyboard operability, visible
  focus indicator, non-colour-only status indication (§9).

## 2. New badges

| Badge | Values | Style rule |
|---|---|---|
| Role | Requester / IT Staff / Administrator | Neutral pill, app-shell only (next to user name); never colour-coded to imply rank. |
| Current Status | New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled | Same pill shape as Lab 2's Requested-Priority badge (`docs/lab-02/ui-spec.md` §14); each value gets a distinct icon + label, not colour alone (§9 accessibility carry-over). Terminal states (Closed, Cancelled) render visually muted (lower-emphasis fill), matching the "removed attachment" muting pattern from Lab 2 §17. |
| IT Priority | Low / Medium / High | Same visual family as Requested Priority (`docs/lab-02/ui-spec.md` §14) so the two read as siblings, but IT Priority always sits to the *right* of Requested Priority wherever both appear, and is never rendered without Requested Priority also visible — prevents mistaking one for the other. |

## 3. Public Comments vs. Internal Notes — visual distinction

Required by specification.md §6: "clearly different in color and label."

- **Public Comments panel**: pale-green (`#EAF6EF`, the existing Success/
  Pale-green token) card background, header reads "Public Comments — 
  visible to the Requester", author name + role badge + timestamp above
  each entry.
- **Internal Notes panel**: warm-ivory (`#F1EFE6`, the existing Read-only-
  field token) card background with an amber-bordered header strip
  (Warning border token `#E0A458`) reading "Internal Notes — IT Staff and
  Administrator only, never shown to the Requester", same author/role/
  timestamp pattern.
- The two panels are always presented as separate tabs (not stacked
  sections) on IT Staff Ticket Detail, so a staff member cannot mistake
  which compose box they are typing into (specification.md §6). The
  Requester Ticket Detail screen has only the Public Comments tab — no
  Internal Notes tab exists in the Requester's UI at all, not merely
  hidden by role (defence in depth alongside the server check, BR-23).
- Both panels: newest entry at the bottom (chronological), compose box
  fixed below the list, Post button follows the Lab 2 busy-state pattern
  (disabled while pending). No edit/delete control on any entry (BR-20).

## 4. Screen states: adds forbidden / not-found / conflict

specification.md §6 requires forbidden, not-found, and conflict feedback
that Lab 2 did not need. Each follows the existing failure-state visual
language (`docs/lab-02/ui-spec.md` §7) with distinct copy:

| State | When | Copy pattern |
|---|---|---|
| Forbidden | 403 from any endpoint | "You don't have access to this." — no retry action, since retrying won't change the role. |
| Not found | 404 (unknown id, or a Requester-scoped resource not owned by the caller) | "This ticket isn't available." — identical wording regardless of which case, matching the existence-hiding behaviour on the server. |
| Conflict | 409 (illegal status transition, duplicate email, self-deactivation, last-Administrator) | Inline message at the point of the action (next to the Status control, next to the Email field, next to the Deactivate toggle) — never a page-level banner, since the user needs to see exactly which control caused it. |

## 5. Screen-by-screen

### 5.1 Login

- Centered card on the page background, TokTickIT identity above the
  form (no app shell — unauthenticated).
- Fields: Email, Password (masked, no visibility toggle required).
- Primary button "Log In", busy state while pending (Lab 2 Submit
  pattern).
- Failure state: a single message above the fields, generic wording for
  bad credentials (BR-09) vs. the distinct inactive-account wording
  (BR-10) — both render in the same Error-token styling, differing only
  in copy, so a screenshot cannot itself prove which case occurred; that
  distinction is proven by the automated test's assertion on response
  status, not the visual.

### 5.2 Change Password

- Same centered-card layout as Login; replaces every other screen when
  `mustChangePassword` is true — the app shell's nav is not rendered
  until this screen is passed (specification.md BR-02).
- Fields: Current Password, New Password, Confirm New Password.
- Inline validation for BR-07 (length/letter/digit) rendered beside the
  New Password field as the user types, mirroring the Lab 2 field-level
  validation-message placement (`docs/lab-02/ui-spec.md` §4).
- Success: redirects straight into the application (no separate
  confirmation screen), landing on the role-appropriate home screen (§5.3).

### 5.3 Application shell

- Replaces the Lab 2 "Development Requester: [name], Change Requester"
  display with the authenticated user's name and Role badge (§2), plus a
  Logout action in the same header position.
- Nav links are filtered by role before render, not merely disabled:
  - Requester: My Tickets, Create Ticket.
  - IT Staff: Ticket Queue.
  - Administrator: Ticket Queue, User Management. (Per specification.md
    §4.3, Administrator does not automatically get IT Staff Ticket
    *operations* — the Queue link is visible so an Admin can inspect
    state, but claim/status/IT-Priority controls on Ticket Detail render
    read-only for an Administrator unless the approved authorization
    matrix in `api-spec.md` grants them; see §9 Open Question.)
- Mobile nav collapses the same way as Lab 2's app shell (hamburger below
  768px).

### 5.4 Requester Ticket Detail (additions only)

Layout is the Lab 2 Ticket Detail screen unchanged, with two additions
below the existing read-only fields and Attachments panel:

- Public Comments tab (§3) — the only comments/notes UI a Requester ever
  sees.
- "Problem Appears Resolved" button, secondary-button style (Lab 2 §5
  hierarchy), visible only while the Ticket's status is not `Closed` or
  `Cancelled`; once clicked, it becomes a disabled/checked state showing
  the timestamp it was recorded, rather than disappearing — so the
  Requester can see they already flagged it.

### 5.5 IT Staff Ticket Queue

- Search box, filter row (Status, IT Priority, Owner: mine/unassigned/
  all), sortable columns, pagination — same control geometry as Lab 2 My
  Tickets (`docs/lab-02/ui-spec.md` §13).
- Columns: Ticket No., Created Date, Summary, Category, Req. Priority, IT
  Priority, Status, Owner. Eight columns is the justified ceiling
  (specification.md §6) — adding Related System or Last Updated as a
  ninth column was considered and rejected as exceeding a scannable
  desktop row width; both remain visible on Ticket Detail instead.
- Owner column shows the owning user's name, or an "Unassigned" muted
  chip.
- Desktop: table. Below 768px: stacked cards, same collapse pattern as
  Lab 2 My Tickets, each card showing all eight fields in a fixed label/
  value layout.
- States: loading, empty (no Tickets exist at all — Administrator-only
  edge case since Requesters always have the seed data), no-results
  (filters/search active, zero matches, with a Clear Filters action),
  forbidden, failure (§4).

### 5.6 IT Staff Ticket Detail

- Extends the Lab 2 Ticket Detail layout: existing read-only Requester-
  submitted fields and Attachments panel stay exactly where they are.
- New "Operations" panel above the Attachments panel:
  - Owner control: a searchable select of active IT Staff/Administrator
    users, plus a one-click "Claim" button when unassigned (BR-18).
  - IT Priority control: same three-value control style as the Requested
    Priority display, but editable (editable-field styling per Lab 2 §1
    token table, vs. Requested Priority which stays read-only-styled).
  - Status control: a select limited to the Ticket's current legally-
    reachable targets only (specification.md §5 transition matrix) — 
    illegal targets are not shown as disabled options, they are absent,
    so the control can never be used to attempt a rejected transition.
    Selecting `Cancelled` or `Closed` opens a confirmation dialog
    (specification.md §5) before the request is sent.
- Public Comments tab and Internal Notes tab (§3) below the Operations
  panel.
- Read-only vs. editable field styling follows the Lab 2 token rule
  throughout (`docs/lab-02/ui-spec.md` §1): Requester-submitted fields
  keep the read-only warm-ivory treatment; Owner/IT-Priority/Status keep
  the editable white/bordered treatment.

### 5.7 Administrator User Management

- One screen, three modes: list (default), create (modal/panel), edit
  (modal/panel) — no separate routed pages, keeping the screen "small"
  per specification.md §3.
- List: Name, Email, Role badge (§2), Status (Active/Inactive pill,
  reusing the muted-terminal styling from §2's Status badge for
  Inactive), Edit action. Search box above the list; optional Role
  filter as a select beside it.
- Create/Edit panel fields: Name, Email, Role (select), Active toggle;
  Create adds an Initial Password field; Edit instead shows a separate
  "Set New Initial Password" button that opens a small confirm-style
  sub-panel (BR-31 — editing never shares a form with password-setting).
- Self-deactivation and last-Administrator protection (BR-25/BR-26)
  render as a disabled Active toggle with an inline explanatory message,
  not merely a rejected request after the fact — though the server check
  is authoritative (specification.md §10) and the disabled toggle is UI
  convenience only.
- States: loading, empty (no users — cannot actually occur given seed
  data, included for completeness), no-results (search/filter, zero
  matches), validation, success (toast/inline confirmation on save),
  forbidden, conflict (§4), failure.

## 6. Responsive and accessibility

Same as Lab 2 (`docs/lab-02/ui-spec.md` §8–§9), applied to every new
screen in §5: no screen introduces a control geometry, breakpoint, or
accessibility pattern not already fixed there.

## 7. CSS class-naming table (new classes only)

Classes already defined in `docs/lab-02/ui-spec.md` §19 are reused
unchanged wherever a Lab 3 screen presents the same kind of element
(buttons, inputs, badges-as-pills, table/card collapse, state banners).
New classes, for elements Lab 2 did not have:

| Class | Element |
|---|---|
| `.role-badge` | Role pill (App shell, User Management list) |
| `.status-badge--terminal` | Closed/Cancelled Status badge modifier (muted fill) |
| `.priority-badge--it` | IT Priority pill (positioned right of Requested Priority) |
| `.comment-panel--public` | Public Comments card |
| `.comment-panel--internal` | Internal Notes card |
| `.comment-entry` | One comment/note row (author, role badge, timestamp, body) |
| `.ticket-ops-panel` | IT Staff Operations panel (Owner/IT Priority/Status controls) |
| `.owner-select` | Owner assignment control |
| `.status-select` | Status transition control |
| `.confirm-dialog` | Shared confirmation dialog (status → Cancelled/Closed, attachment removal continues to reuse Lab 2's existing confirmation pattern) |
| `.user-table` / `.user-card` | Administrator user list, desktop/mobile |
| `.user-form-panel` | Create/Edit user panel |
| `.password-reset-subpanel` | "Set New Initial Password" sub-panel |

## 8. Screenshot paths

Following the Lab 2 convention (`docs/lab-02/ui-spec.md` §18) and
specification.md §7's repository structure:
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`,
one desktop + tablet + mobile capture per required screen state listed in
§4 and §5 above.

## 9. Open questions / resolved decisions

- **Resolved** — Administrator's Ticket Queue/Detail access is
  **view-only** unless specification.md's authorization matrix
  (`api-spec.md` §3) is extended: the labsheet (§4.3) says an
  Administrator "does not automatically need to perform IT Staff Ticket
  operations," and `api-spec.md` §3 lists `IT_STAFF, ADMINISTRATOR` as
  allowed roles for the operational endpoints — so in practice an
  Administrator *can* claim/set-priority/change-status via the API. This
  UI spec renders those controls editable for an Administrator too,
  matching `api-spec.md` exactly, rather than inventing a UI-only
  restriction `api-spec.md` does not impose. Flagged here because the
  labsheet's own wording ("does not automatically need to") reads as
  permissive, not prohibitive, and this is the reading this project
  takes.
