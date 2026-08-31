# Lab 2 UI Specification — Zen Green Theme

Sources of truth, in this order: `specification.md` and `api-spec.md`
(both merged and authoritative — nothing below contradicts or re-decides
anything fixed there), then the Lab 2 labsheet §7 (Zen Green Theme token
table) and §8 (Required Application Navigation, including §8.7 Responsive
Requirements). Where none of those fix a detail this document needs
(typography, spacing, exact hex values, CSS class names), this document
makes the decision — that is its job, per labsheet §17/Appendix C ("the
final `ui-spec.md` must explicitly document the chosen color tokens,
typography, spacing..."). Genuine ambiguities this document cannot resolve
on its own are listed in §20 rather than invented.

No code and no `tests.md` content is included here. CSS class names fixed
in §19 are the ones `tests.md` must assert against — they are not to be
renamed or reinvented later.

---

## 1. Colour tokens

Fixed by labsheet §7 (verbatim values — not re-decided here):

| Token | Value | Intended use |
|---|---|---|
| Primary green | `#006B3C` | App header background, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Active tabs, focus accents, links, hover states |
| Pale green | `#EAF6EF` | Selected state, success emphasis, subtle section backgrounds |
| Page background | `#F5F7F6` | Behind all screen content |
| Surface / cards | white, subtle border, restrained shadow | Panels, table/card surfaces, modal-like confirmation dialogs |
| Text | dark charcoal-green, not pure black | Body text, labels, headings |
| Editable field | white background, clear neutral border | Inputs the Requester can change |
| Read-only field | soft gray-green or warm ivory shading | System-generated/fixed values (BR-04, AC-27) |
| Error | dark red text and border | Field-level validation failures (BR-19, AC-04) |
| Warning | amber callout or badge, never ordinary decoration | Genuine warnings only (e.g. BR-20 attachment-upload failure banner) |
| Success | green confirmation, never colour-only | Ticket-created confirmation (AC-01), attachment-removed confirmation |

The labsheet fixes the token *names and roles*; it does not fix literal
hex values for Text, Editable/Read-only borders, Error, Warning, or
Success. This document fixes those (needed for implementation and for
`tests.md` colour assertions):

| Token | Hex |
|---|---|
| Text (charcoal-green) | `#1C2B23` |
| Text, muted/secondary | `#4B5A54` |
| Editable field border | `#C9D2CE` |
| Editable field border, focused | Secondary green `#0B7A46` |
| Read-only field background | `#F1EFE6` (warm ivory) |
| Read-only field border | `#DAD6C8` |
| Error text/border | `#B3261E` |
| Warning text | `#8A5300` |
| Warning background | `#FCEFDC` |
| Warning border | `#E0A458` |
| Success text | Secondary green `#0B7A46` |
| Success background | Pale green `#EAF6EF` |

**Reservation rule**: Warning tokens (`#8A5300` / `#FCEFDC` / `#E0A458`)
are used only where something has genuinely gone wrong but is not fatal
(the attachment-upload-failed banner under BR-20/AC-08). They are never
used for ordinary badges, hints, or decoration — labsheet §7 states this
explicitly for the Warning token, and it rules out using amber for the
Requested Priority "MEDIUM" badge (see §15).

---

## 2. Typography and spacing scale

Not fixed by any authoritative document; fixed here.

**Font family**: system font stack —
`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (no
external font load required).

**Type scale**:

| Role | Size | Weight | Used for |
|---|---|---|---|
| `h1` | 1.5rem (24px) | 600 | Screen titles ("Create Ticket", "My Tickets") |
| `h2` | 1.25rem (20px) | 600 | Section headings (Attachments panel, filter group) |
| `h3` | 1rem (16px) | 600 | Field-group headings |
| body | 0.875rem (14px) | 400 | Field values, table cells, paragraph text |
| label | 0.8125rem (13px) | 600 | Field labels (component rule, labsheet §8.3) |
| small/meta | 0.75rem (12px) | 400 | Timestamps, file size, helper text |

**Spacing scale** (4px base unit): `xs=4px`, `sm=8px`, `md=12px`,
`lg=16px`, `xl=24px`, `2xl=32px`, `3xl=48px`.

**Shared control geometry**: all text inputs, selects, and buttons share
one control height of 40px (component rule, labsheet §8.3: "Inputs use
one consistent height"); border-radius 6px on inputs and buttons, 999px
(full pill) on badges; multiline Description uses the same 40px minimum
but grows taller and is resizable only vertically, never causing the
surrounding layout to reflow horizontally (labsheet §8.3).

---

## 3. Control states

Every form control (text input, select, textarea) has exactly these
states, styled from the tokens in §1:

| State | Background | Border | Text | Notes |
|---|---|---|---|---|
| Editable | white | Editable field border `#C9D2CE` | Text `#1C2B23` | Default state for a control the Requester can change |
| Read-only | Read-only field bg `#F1EFE6` | Read-only field border `#DAD6C8` | Text `#1C2B23` | Ticket Number, Ticket Date, Requester, Current Status — never editable (BR-04, BR-02, AC-27) |
| Invalid | white (unchanged) | Error `#B3261E`, 2px | Text unchanged | Border only changes; the message (§4) carries the explanation, not colour alone |
| Disabled | `#EEF0EF` | Editable field border, no focus ring | Text `#4B5A54` (muted) | `disabled` attribute set; cannot be focused or activated (labsheet §8.3) |
| Focused | unchanged from Editable/Read-only | unchanged | unchanged | Adds a 2px Secondary-green (`#0B7A46`) outline, 2px offset, visible only via `:focus-visible` so mouse clicks don't show it but keyboard Tab does (AC-25) |

CSS classes for these states are fixed in §19 (`field__control--readonly`,
`field__control--invalid`, `field__control--disabled`).

---

## 4. Required-field marker and validation-message placement

- A required field's label is followed by a red asterisk
  (`<span class="field__required-marker">*</span>`, coloured with the
  Error token) immediately after the label text, never inside the control
  itself (labsheet §8.3: "the asterisk does not replace the validation
  message").
- Required on Create Ticket: Category, Related System, Summary,
  Requested Priority, Description (BR-15, BR-16, BR-17, BR-18 — all
  required per api-spec.md §4). Attachments are optional (FR-02 allows
  "up to 5", not a minimum of 1).
- A field's validation message renders in a `<p class="field__message
  field__message--error">` directly below that field's control, never
  only as a single banner at the top of the form (labsheet §8.3;
  specification.md §6: "validation messages render beside their field,
  never only at the top"; AC-04).
- Message text: field name + rule violated (e.g. "Summary is required",
  "Description must be at least 10 characters"). Exact wording is not
  fixed by api-spec.md beyond field + rule (api-spec.md §4 worked
  example); this document's illustrative strings are non-binding — see
  §20 Resolved decisions (OQ-UI-1).
- A field with a message also gets `aria-invalid="true"` and
  `aria-describedby` pointing at the message element's `id`, so screen
  readers announce the message when the field receives focus.
- On any 400, already-entered field values and selected attachments are
  preserved exactly as typed/selected (BR-19, AC-04, AC-23) — the form
  never clears on a validation failure, whether the failure is
  client-side or server-side.

---

## 5. Button hierarchy

| Tier | Use | Style |
|---|---|---|
| Primary | The one main action per screen: Submit (Create Ticket), Continue (Requester Selection), Create Ticket (My Tickets toolbar) | Solid Primary green `#006B3C` background, white text |
| Secondary | Supporting actions that are still affirmative: Change Requester, Add Attachment, Clear Filters, Cancel (on the Requester Selection screen) | White background, Secondary green `#0B7A46` border and text |
| Tertiary | Low-emphasis inline actions: Preview, Download, pagination Previous/Next, sortable column headers | No border/background; Secondary green text; underline or background tint on hover/focus only |
| Destructive | Remove (attachment soft-removal) | White background, Error `#B3261E` border and text; confirmation step required before the action fires (BR-34) |
| Disabled | Any of the above tiers while its precondition isn't met (e.g. Continue with nothing selected, Submit mid-request is *busy*, not disabled-plain — see below) | 60% opacity, `#EEF0EF` background regardless of tier, `cursor: not-allowed`, `aria-disabled="true"`; never activates on click or Enter (labsheet §8.3) |
| Busy | Submit while the create-ticket request is in flight (BR-13, AC-06) | Same tier styling as Primary but with a spinner icon before the label, label text changes to "Submitting…", `disabled` attribute set, `aria-busy="true"` |

Every button always shows visible text; an icon may accompany the text
but never replaces it, and any icon-only control (e.g. a small "✕" chip
remove in the attachment picker) additionally carries an
`aria-label` and a native `title` tooltip (labsheet §8.3).

---

## 6. Attachment selection and error presentation (pre-upload)

This covers the client-side picker used both on Create Ticket and on
Ticket Detail's "Add Attachment" action, before any request is sent.

- A dashed-border dropzone plus a secondary "Add Files" button, either of
  which opens the native file picker (`accept=".jpg,.jpeg,.png,.webp,.pdf"`,
  matching BR-26).
- Each selected file appears as a chip below the dropzone:
  filename, size, a small file-type icon, and a "✕" remove control
  (`aria-label="Remove {filename}"`).
- **Client-side, pre-request checks**, each file independently:
  - Size > 5 MB → chip renders with Error-token border/text, message
    "File exceeds 5 MB", and is excluded from the submit payload (BR-27,
    AC-18 — "a client-side error is shown and no upload request is
    sent" for that file).
  - Type not JPG/JPEG/PNG/WEBP/PDF → chip renders with Error styling,
    message "Unsupported file type", excluded from the payload (BR-26,
    AC-19 — client blocks first; if a request is somehow still sent
    with a bad type, the server enforces 415, api-spec.md §7).
  - More than 5 chips selected at once, or adding would push the
    Ticket's active count over 5 → the newest addition is rejected
    client-side with a banner above the dropzone: "Up to 5 attachments
    allowed" (BR-28, BR-29, AC-16, AC-17); this is a client-side
    convenience only — the server's 409 checks (api-spec.md §7) are
    authoritative and still run on submit.
- A chip that fails a client-side check is visibly distinct (Error
  border, message beneath the chip) but stays selectable for removal —
  it is never silently dropped without explanation.
- Because BR-30 makes the server's validation atomic per batch, this
  screen never partially submits — it only ever submits the files that
  passed every client-side check, and if the server subsequently rejects
  the whole batch (409/415/413), the failure is shown as described in
  §7/§17, with all originally-selected chips (valid and invalid) still
  present so the Requester can fix and retry.

---

## 7. Screen states: initial, loading, validation, submitting, success, failure

A shared state model, reused (with the modifier classes in §19) across
every screen that fetches or submits data:

| State | Meaning | Typical rendering |
|---|---|---|
| Initial | First paint, nothing fetched yet or a clean unsubmitted form | Empty/default form values, or a skeleton placeholder for lists |
| Loading | A GET is in flight | Skeleton rows (My Tickets, Ticket Detail) or a centred spinner + "Loading…" text (Requester Selection) |
| Validation | Client-side or server-side (400) rejection of submitted input | Field-level messages per §4; form values retained (BR-19) |
| Submitting | A mutating request (POST/DELETE) is in flight | Primary button shows Busy style (§5); form controls remain interactive except Submit itself |
| Success | The mutation succeeded | Success-token confirmation panel/banner, non-colour-reinforced with a checkmark icon and explicit text (labsheet §7: "no reliance on color alone") |
| Failure | The mutation or fetch failed (network error, 5xx, or an error not covered by field-level 400s) | A `.state-banner--error` panel with a safe, generic message and a Retry action where applicable; entered form values retained (AC-23) |

Per-screen application:

- **Requester Selection**: Loading (fetching `/api/requesters`) → Loaded
  (dropdown populated) | Empty (zero active Requesters, labsheet §8.1) |
  Failure (API unreachable, labsheet §8.1). No Validation/Submitting
  state — selecting and clicking Continue only writes to
  `sessionStorage` (BR-07), it does not call the API.
- **Create Ticket**: Initial → (client Validation on blur/submit attempt)
  → Submitting (BR-13, AC-06) → Success (AC-01) showing the generated
  Ticket Number and a "View Ticket" link, or Failure. A successful Ticket
  creation whose attachment upload failed is a distinct sub-state of
  Success: the Ticket Number confirmation still renders, plus a
  Warning-token banner ("Some attachments couldn't be uploaded — add them
  from Ticket Detail") linking to Ticket Detail, per BR-20/AC-08. The
  ordinary "Add Attachment" control on Ticket Detail is the retry
  mechanism — no separate "Retry" button is introduced, since BR-20 only
  requires a retry *option* to exist there, not a dedicated affordance.
- **My Tickets**: Loading (skeleton table/cards) → Loaded, further split
  into Empty (BR-25, AC-13) or No-results (BR-25, AC-14) or a populated
  list, or Failure (safe error banner with Retry).
- **Ticket Detail**: Loading → Loaded (read-only header + attachments) or
  Failure, where a 404 (BR-36, AC-03) renders as a "not found" panel
  indistinguishable in wording whether the Ticket doesn't exist or
  belongs to someone else, with a "Back to My Tickets" link — never a
  raw error dump.
- **Attachment actions** (add/remove) on Ticket Detail: Submitting (busy
  Add/Remove button) → Success (list updates in place) or Failure (an
  inline Error-token message near the Attachments panel, per the 409/415/
  413/404 cases in api-spec.md §7/§10).

---

## 8. Responsive layout rules

Fixed by labsheet §8.7 (reproduced, not altered):

| Viewport | Range | Required behavior |
|---|---|---|
| Desktop | ≥ 992px | Multi-column layout as specified per screen; content centred with a sensible max width |
| Tablet | 768–991px | Two-column layout where practical; Summary and Description receive enough width |
| Mobile | < 768px | Fields stack vertically; buttons remain touch-friendly (min 40px tap target); no horizontal page scrolling |
| All sizes | — | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

Applied per screen:

- **Application shell**: desktop/tablet show the full horizontal nav
  (My Tickets, Create Ticket, Requester name, Change Requester); mobile
  collapses the nav into a hamburger toggle that opens a stacked menu
  (labsheet §8: "responsive mobile navigation").
- **Create Ticket**: desktop — two-column grid (system-generated fields
  and classification fields side by side per labsheet §8.2's example
  arrangement); tablet — two-column where practical, Summary/Description
  each take a full-width row regardless of column count; mobile — one
  column, every field full width, Attachments below the main fields at
  every breakpoint (specification.md §6).
- **My Tickets**: desktop — data table (§13); tablet — same table,
  narrower columns, Category may abbreviate; mobile (< 768px) — table
  is replaced entirely by stacked cards, never a horizontally-scrollable
  table (specification.md Assumption 10; AC-24).
- **Ticket Detail**: desktop/tablet — header fields in a responsive grid
  (2 columns tablet, up to 4 columns desktop); mobile — header fields
  stack one per row; the Attachments panel is always full-width below
  the header at every breakpoint.

---

## 9. Accessibility

- Every form control has a `<label>` associated via `for`/`id` — never a
  placeholder used as the only label.
- Every icon-only control (attachment chip's "✕", sortable column-header
  sort arrows, mobile nav hamburger) has both an `aria-label` and a
  native `title` tooltip (labsheet §8.3).
- Keyboard focus order follows visual order on every screen; the
  Development Requester dropdown and Continue button are reachable and
  operable via Tab/Enter with the visible focus outline from §3 (AC-25).
- Focus is never trapped; a confirmation step (attachment removal, §5
  Destructive tier) is reachable and dismissible via keyboard (Esc
  closes it, focus returns to the control that opened it).
- Badges (§15) and states (§7) never rely on colour alone: every badge
  pairs colour with an icon and a text label; every state banner pairs
  colour with an icon (✓ success, ⚠ warning/failure, ℹ info) and explicit
  text.
- Live regions: the validation-message region and the state-banner
  region are both `aria-live="polite"`, so a message appearing after
  Submit is announced without moving focus away from the field.

---

## 10. Application shell and active navigation

Structure (top to bottom): a fixed header bar containing, left to right:

1. TokTickIT identity (icon + wordmark), Primary-green background,
   white text — labsheet §7/§8.
2. Primary nav: "My Tickets" and "Create Ticket" links.
3. Current Requester name (read-only text) with an adjacent
   "Change Requester" secondary-tier button.

The active nav link is indicated two ways, never colour alone: a
Secondary-green underline/bottom-border **and** `aria-current="page"`
(non-colour indication per specification.md §6/labsheet §8's
"clear active-page indication").

"Change Requester" clears the stored selection (BR-07/BR-08) and routes
back to the Development Requester Selection screen; no confirmation step
is required since it discards no server data, only the client-side
context.

Below 768px, the primary nav and Requester display collapse into a
hamburger toggle; opening it reveals the same three items stacked
full-width.

---

## 11. Development Requester Selection screen

Required elements (labsheet §8.1), each with its state:

- TokTickIT title and the fixed explanatory text (labsheet §8.1's
  suggested copy, used verbatim): "Select a Development Requester to test
  requester-specific ticket behavior. This is not a login screen.
  Authentication and role-based access will be introduced in Lab 3."
  (BR-03, BR-37).
- Development Requester dropdown, populated from `GET /api/requesters`
  (only active Requesters — BR-05, AC-26).
- Continue button (Primary tier), disabled until a Requester is selected;
  on click, writes the selection to `sessionStorage` (BR-07) and
  navigates to My Tickets.
- **Loading**: spinner + "Loading Requesters…" while the request is in
  flight.
- **Empty**: if the active-Requesters list comes back empty, the
  dropdown is replaced with a message ("No active Development Requesters
  are available.") and Continue stays disabled — there is nothing to
  select.
- **Failure**: if the request fails, a `.state-banner--error` message
  ("Couldn't load Development Requesters.") with a Retry button replaces
  the dropdown area.
- All controls keyboard-accessible (Tab to dropdown, Space/Arrow keys to
  choose, Tab to Continue, Enter to submit) with the visible focus
  indicator from §3 (AC-25).

After selection, per specification.md §6/labsheet §8.1: the application
shell displays the Requester's name, a Change Requester action becomes
available, and My Tickets/Ticket Detail data is (re)fetched fresh — no
data from a previous Requester is retained (BR-08, AC-22).

---

## 12. Create Ticket screen layout

Field order (top to bottom), following labsheet §8.2's example
arrangement and specification.md §6:

1. **System-generated / read-only row** (Read-only field styling, §3):
   Ticket Number ("Generated after creation" placeholder text before
   submit), Ticket Date (today's date, display-only), Requester (the
   selected Development Requester's name — AC-27; the client cannot
   change this, matching BR-04).
2. **Classification fields**, grouped together: Category (select,
   populated from `GET /api/categories`), Related System (select,
   populated from `GET /api/related-systems`), Requested Priority
   (select, `LOW`/`MEDIUM`/`HIGH`, pre-selected `MEDIUM` per BR-18).
3. **Summary** (single-line input, required, full width) and
   **Description** (multiline textarea, required, full width, tallest
   control on the screen) — both given the most width on the screen, per
   specification.md §6.
4. **Attachments** section (§6 above), below the main fields.
5. **Actions row**: Submit (Primary, busy state per §5/BR-13) and Cancel
   (Secondary, returns to My Tickets without saving — no confirmation
   needed since nothing has been persisted yet).

Field-by-field editable/read-only classification (ties directly to §3):

| Field | Editable? | Why |
|---|---|---|
| Ticket Number | Read-only | System-generated on success (BR-01) |
| Ticket Date | Read-only | `createdAt`, system-generated |
| Requester | Read-only | Fixed to the selected Development Requester (BR-04, AC-27) |
| Category | Editable | Requester-selected (FR-02) |
| Related System | Editable | Requester-selected (FR-02) |
| Requested Priority | Editable | Requester-selected, defaults `MEDIUM` (BR-18) |
| Summary | Editable | Requester-entered (BR-15) |
| Description | Editable | Requester-entered (BR-16) |
| Attachments | Editable | Requester-selected (FR-02, BR-26–BR-30) |
| Current Status | Not shown | Always `NEW` at creation (BR-02); showing a fixed constant field adds no information the Requester needs before submission — it appears on Ticket Detail instead (§16) |

Neither **IT Priority** nor **Ticket Owner** appears anywhere on this
screen, even though the labsheet's illustrative mockup (Figure 1, page 2)
shows both — specification.md §3/§11 excludes them for Lab 2 since
nothing in this sprint sets or owns either field.

---

## 13. My Tickets screen

### 13.1 Toolbar

Top row, left to right: search box (placeholder "Search by ticket number
or summary…", BR-21/FR-05), Category/Requested Priority/Current Status
filter selects (FR-06/BR-22, each defaulting to "All \_\_\_"), a page-size
select (`.ticket-toolbar__page-size`, §19; options 10/20/50, default 10
per BR-24 — see §20 OQ-UI-3), a Secondary-tier "Clear Filters" button,
and a Primary-tier "Create Ticket" button that routes to Create Ticket.

"Clear Filters" is present in the toolbar at all times but disabled
(§3/§5 Disabled styling) whenever no search/filter is currently applied;
it is additionally always present and enabled inside the No-results
panel itself (§15), since AC-14 requires it reachable from that state
specifically.

### 13.2 Desktop columns

Seven columns, each justified against a specific FR/BR (the labsheet's
example list — Ticket Number, Summary, Category, Current Status, Last
Updated — is explicitly "not a complete mandatory column list," §8.4):

| Column | Sortable? | Justification |
|---|---|---|
| Ticket No. | no | Primary identifier; also the field `search` prefix-matches (BR-21) |
| Created Date | yes (default, desc) | Default sort field (BR-23) |
| Summary | yes | Sortable field (FR-07, BR-23); also substring-searchable (BR-21) |
| Category | no (filterable only) | Filterable field (FR-06, BR-22) — shown so the Requester can see what a Category filter is matching |
| Requested Priority | yes | Sortable and filterable field (FR-06, FR-07); rendered as a badge (§15) |
| Current Status | yes | Sortable and filterable field (FR-06, FR-07); rendered as a badge (§15) |
| Last Updated | no | Required by BR-39 ("this is the value the My Tickets 'Last Updated' column displays") |

A sortable column header shows a tertiary-tier clickable label with a
small ▲/▼ glyph indicating current direction; clicking toggles
`sortDir` for that `sortBy` (api-spec.md §5). Only one column sorts at a
time — clicking a different sortable header switches `sortBy` and resets
`sortDir` to that column's default: `desc` for Created Date (BR-23),
`asc` for Summary, `desc` for Requested Priority, and `desc` for Current
Status — see §20 (OQ-UI-2) for the reasoning behind each.

Neither **IT Priority** nor **Ticket Owner** columns appear, though both
are visible in the labsheet's illustrative My Tickets mockup (page 11) —
excluded per specification.md §3/§11.

### 13.3 Mobile card representation (< 768px)

Each Ticket renders as one card, stacked vertically (specification.md
Assumption 10; AC-24), with no horizontally-scrollable table:

- Card header row: Ticket Number (left) and the Requested Priority badge
  (right).
- Card title: Summary (wraps, never truncated to unreadable).
- Secondary row: Category name and the Current Status badge.
- Footer row: Created Date and Last Updated, each with a small-text
  label so the two dates aren't confused.

A tap anywhere on the card (except its badges) opens Ticket Detail, same
as a desktop row click.

### 13.4 Sort control on mobile

Since there are no clickable column headers on a card layout, mobile
adds a single "Sort by" select in the toolbar (values: Created Date,
Summary, Requested Priority, Current Status, each with an asc/desc
sub-choice) that drives the same `sortBy`/`sortDir` query parameters as
the desktop column headers (api-spec.md §5). This is a UI-only
convenience; it introduces no new API behavior.

### 13.5 Pagination

Bottom of the list: "Showing {start}–{end} of {totalCount}" text, then
Previous / numbered page buttons / Next (tertiary tier), matching
`page`/`totalPages` from the API response (api-spec.md §5). The current
page button is visually distinct (Primary-green filled) and carries
`aria-current="page"`. A page-size select (`.ticket-toolbar__page-size`,
§19) sits in the toolbar (§13.1) alongside the filters, offering 10
(default, BR-24), 20, and 50; changing it resets to page 1 and refetches
— see §20 (OQ-UI-3) for why this control exists.

---

## 14. Priority and status badge rules

Every badge is a pill (`border-radius: 999px`), and pairs colour with an
icon glyph and a text label — never colour alone (specification.md §6:
"distinct, non-color-only indicators"). No badge ever uses the Warning
(amber) token as decoration, since labsheet §7 reserves that token for
genuine warnings only (§1).

### 14.1 Requested Priority (`badge--priority-*`)

| Value | Icon | Background | Border | Text | Label |
|---|---|---|---|---|---|
| `LOW` | ↓ | Pale green `#EAF6EF` | Secondary green `#0B7A46` | Secondary green | "Low" |
| `MEDIUM` | – | white | Secondary green `#0B7A46`, 1px | Secondary green | "Medium" |
| `HIGH` | ↑ | white | Error `#B3261E`, 2px | Error `#B3261E` | "High" |

`LOW` is filled, `MEDIUM` is outlined (thin border, white fill), `HIGH`
is outlined with a heavier border and the Error colour — so the three
remain distinguishable even in grayscale (icon + fill/border weight),
satisfying the non-colour-only rule independently of the colour choice.
`HIGH` deliberately reuses the Error token for urgency; it is never
mistaken for a field-validation error because it only ever appears as a
pill inside a table cell/card/detail header, never directly beneath a
form control (§4).

### 14.2 Current Status (`badge--status-*`)

Lab 2's `TicketStatus` enum holds only `NEW` (specification.md §7), so
only one status badge is defined this sprint:

| Value | Icon | Background | Border | Text | Label |
|---|---|---|---|---|---|
| `NEW` | ● | Pale green `#EAF6EF` | Secondary green `#0B7A46` | Secondary green | "New" |

The status badge uses a filled dot icon (as opposed to the priority
badges' directional arrows/dash) so the two badge families remain
visually distinguishable from each other, not just internally. When Lab
3 adds further `TicketStatus` values (specification.md §7 "Schema
evolution for Lab 3"), this table extends with new rows; nothing in this
document depends on the enum staying single-valued.

Neither table includes **IT Priority**, since that field does not exist
in Lab 2's data model at all (specification.md §3/§11).

---

## 15. Empty-list versus no-results presentation (BR-25)

Both render as a centred panel inside the list area (table/cards and
pagination are hidden while either is shown), but differ in copy, icon,
and action — never distinguished by colour alone:

| | Empty (AC-13) | No-results (AC-14) |
|---|---|---|
| Trigger | Requester owns zero Tickets | Requester owns Tickets, but the current search/filter matches none |
| Icon | A neutral "inbox" glyph | A neutral "search" glyph |
| Heading | "No tickets yet" | "No tickets match your search" |
| Body text | "Create your first ticket to get started." | "Try adjusting or clearing your filters." |
| Action | Primary "Create Ticket" button | Secondary "Clear Filters" button (also present, enabled, in the toolbar per §13.1) |
| Toolbar | Search/filter controls are hidden — filtering an empty set is meaningless | Search/filter controls stay visible above the panel, so the Requester can adjust them directly |

---

## 16. Ticket Detail read-only layout (FR-08)

Two visually separated panels, top to bottom (specification.md §6:
"read-only header fields grouped separately from the Attachments
panel"):

### 16.1 Header panel

All fields read-only (§3 Read-only styling), grouped in a responsive
grid (§8): Ticket Number, Created Date, Category, Related System,
Requested Priority (badge, §14), Current Status (badge, §14), Summary,
Description (full width, wraps). A "← Back to My Tickets" tertiary link
sits above the panel.

Neither **IT Priority** nor **Ticket Owner** appears, despite both being
shown on the labsheet's illustrative Ticket Detail mockup (Figure 1) —
excluded per specification.md §3/§11. Likewise, no Public Comments,
Internal Notes, Actions Taken, or status-transition controls are
present (specification.md §3 Excluded).

### 16.2 Attachments panel

Section heading "Attachments ({count} active)", an "Add Attachment"
secondary button (opens the picker from §6), then the attachment list
(§17).

A failed 404 fetch of the Ticket itself (BR-36 — not found, or owned by
someone else, worded identically) replaces both panels with the
not-found failure state described in §7, not a partial/broken render of
either panel.

---

## 17. Attachment states (active, uploading, invalid, removed, unavailable)

Rendered as a list of rows inside the Attachments panel (§16.2), each row
carrying: a file-type icon, filename, size, upload date, and
state-specific actions/styling:

| State | Trigger | Styling | Actions shown |
|---|---|---|---|
| Active | `isRemoved: false` | Default surface styling, full-opacity text | Preview (tertiary — opens the download URL in a new tab per BR-35), Download (tertiary), Remove (destructive, §5) |
| Uploading | A just-selected file mid-`POST` request | Same row, with an inline progress spinner in place of the actions, muted text | none (actions disabled until the request resolves) |
| Invalid (client-side) | A file rejected by §6's pre-upload checks | Error-token border, message beneath the row | Remove-from-selection only (it was never sent to the server) |
| Removed | `isRemoved: true` | Muted/reduced-opacity text, no background change, a small "Removed" label with the removal date and reason (if any) shown inline | none — no Preview/Download/Remove controls, per specification.md §6 ("removed attachments show the same metadata with no action controls, visually muted") and BR-32 |
| Unavailable | A Preview/Download click resolves to 404 (the file became removed between page load and the click, or any other fetch failure) | The row itself is unaffected; a transient inline error ("This attachment is no longer available.") appears near the clicked action and clears after a few seconds or on next successful action | Preview/Download disabled after the failure until the list is refreshed |

Removing an Attachment requires the explicit confirmation step from §5's
Destructive tier (BR-34): clicking Remove opens a small confirmation
panel with an optional "Reason" text field (≤200 chars, live character
count, BR-34) and Confirm/Cancel buttons; only Confirm calls
`DELETE .../attachments/:attachmentId`.

---

## 18. Screenshot paths

Under `artifacts/lab-02/screenshots/`, using the three subfolders fixed
by the labsheet's required repository structure
(`create-ticket/`, `my-tickets/`, `ticket-detail/` — no additional
top-level folder is introduced). The Development Requester Selection
screen's evidence is grouped under `create-ticket/`, since the labsheet's
submission-evidence table bundles it with Create Ticket evidence (Part 6
in labsheet §14).

| Screen | State | Viewport(s) | Path |
|---|---|---|---|
| Requester Selection | loading | desktop | `create-ticket/requester-select-loading-desktop.png` |
| Requester Selection | loaded (dropdown) | desktop | `create-ticket/requester-select-loaded-desktop.png` |
| Requester Selection | empty | desktop | `create-ticket/requester-select-empty-desktop.png` |
| Requester Selection | failure | desktop | `create-ticket/requester-select-failure-desktop.png` |
| Create Ticket | initial | desktop, tablet, mobile | `create-ticket/create-ticket-initial-{viewport}.png` |
| Create Ticket | validation failure | desktop | `create-ticket/create-ticket-validation-desktop.png` |
| Create Ticket | submitting (busy) | desktop | `create-ticket/create-ticket-submitting-desktop.png` |
| Create Ticket | success | desktop | `create-ticket/create-ticket-success-desktop.png` |
| Create Ticket | API/network failure | desktop | `create-ticket/create-ticket-api-failure-desktop.png` |
| Create Ticket | invalid attachment selected | desktop | `create-ticket/create-ticket-invalid-attachment-desktop.png` |
| My Tickets | loading | desktop | `my-tickets/my-tickets-loading-desktop.png` |
| My Tickets | populated list | desktop, tablet, mobile | `my-tickets/my-tickets-list-{viewport}.png` |
| My Tickets | empty state | desktop | `my-tickets/my-tickets-empty-desktop.png` |
| My Tickets | no-results state | desktop | `my-tickets/my-tickets-no-results-desktop.png` |
| My Tickets | failure state | desktop | `my-tickets/my-tickets-failure-desktop.png` |
| My Tickets | Requester A → B switch (before/after) | desktop | `my-tickets/my-tickets-requester-switch-before-desktop.png`, `my-tickets/my-tickets-requester-switch-after-desktop.png` |
| Ticket Detail | loaded, active attachments | desktop, tablet, mobile | `ticket-detail/ticket-detail-loaded-{viewport}.png` |
| Ticket Detail | removed attachment shown | desktop | `ticket-detail/ticket-detail-removed-attachment-desktop.png` |
| Ticket Detail | remove-confirmation panel | desktop | `ticket-detail/ticket-detail-remove-confirm-desktop.png` |
| Ticket Detail | not-found (cross-Requester/404) | desktop | `ticket-detail/ticket-detail-not-found-desktop.png` |

`{viewport}` expands to `desktop`, `tablet`, or `mobile` per §8's ranges.

---

## 19. CSS class-naming table

These are the fixed class names `tests.md` asserts against. All classes
are plain (no CSS-Modules hashing) so Playwright/RTL selectors stay
stable.

| Group | Class | Applies to / modifier meaning |
|---|---|---|
| Shell | `.app-shell` | Root shell container |
| Shell | `.app-shell__header` | Top header bar |
| Shell | `.app-shell__nav` | Nav link group |
| Shell | `.app-shell__nav-link` | Each nav link |
| Shell | `.app-shell__nav-link--active` | The active-page nav link (§10) |
| Shell | `.app-shell__requester` | Current-Requester name display |
| Shell | `.app-shell__change-requester-btn` | Change Requester button |
| Shell | `.app-shell__mobile-toggle` | Hamburger toggle (< 768px) |
| Requester Selection | `.requester-select` | Screen root |
| Requester Selection | `.requester-select__dropdown` | The dropdown control |
| Requester Selection | `.requester-select__continue-btn` | Continue button |
| Form field | `.field` | Field wrapper (label + control + message) |
| Form field | `.field__label` | `<label>` element |
| Form field | `.field__required-marker` | The red asterisk |
| Form field | `.field__control` | The input/select/textarea itself |
| Form field | `.field__control--readonly` | Read-only state (§3) |
| Form field | `.field__control--invalid` | Invalid state (§3) |
| Form field | `.field__control--disabled` | Disabled state (§3) |
| Form field | `.field__message` | Validation message text |
| Form field | `.field__message--error` | Error-styled message (only variant this sprint) |
| Button | `.btn` | Base button class |
| Button | `.btn--primary` / `.btn--secondary` / `.btn--tertiary` / `.btn--destructive` | Hierarchy tier (§5) |
| Button | `.btn--busy` | Busy/in-flight state (§5) |
| Button | `.btn__spinner` | Spinner element inside a busy button |
| Attachment picker | `.attachment-picker` | Picker root (Create Ticket + Ticket Detail Add) |
| Attachment picker | `.attachment-picker__dropzone` | Drag-drop area |
| Attachment picker | `.attachment-picker__chip` | One selected-file chip |
| Attachment picker | `.attachment-picker__chip--invalid` | Chip that failed a client-side check (§6) |
| Attachment picker | `.attachment-picker__chip-remove` | The chip's "✕" control |
| Attachment picker | `.attachment-picker__error` | Batch-level error banner (>5 files / cap reached) |
| Attachment list | `.attachment-list` | List root (Ticket Detail Attachments panel) |
| Attachment list | `.attachment-item` | One row |
| Attachment list | `.attachment-item--active` / `.attachment-item--uploading` / `.attachment-item--removed` / `.attachment-item--unavailable` | Row state (§17) |
| Attachment list | `.attachment-item__name` | Filename text |
| Attachment list | `.attachment-item__meta` | Size/date/removal-reason text |
| Attachment list | `.attachment-item__preview-btn` / `.attachment-item__download-btn` / `.attachment-item__remove-btn` | Row actions |
| Attachment list | `.attachment-remove-confirm` | Removal confirmation panel (BR-34) |
| State banner | `.state-banner` | Generic state container (§7) |
| State banner | `.state-banner--loading` / `.state-banner--empty` / `.state-banner--no-results` / `.state-banner--error` / `.state-banner--success` / `.state-banner--warning` | State modifier |
| Badge | `.badge` | Base badge pill |
| Badge | `.badge--priority-low` / `.badge--priority-medium` / `.badge--priority-high` | Requested Priority (§15.1) |
| Badge | `.badge--status-new` | Current Status (§15.2) |
| My Tickets | `.ticket-toolbar` | Search + filters + actions row |
| My Tickets | `.ticket-toolbar__search` | Search input |
| My Tickets | `.ticket-toolbar__filter` | Each filter select |
| My Tickets | `.ticket-toolbar__clear-filters-btn` | Clear Filters button |
| My Tickets | `.ticket-toolbar__page-size` | Page-size select (10/20/50, §13.5) |
| My Tickets | `.ticket-table` | Desktop/tablet table root |
| My Tickets | `.ticket-table__header--sortable` | A clickable, sortable header cell |
| My Tickets | `.ticket-table__sort-icon` | The ▲/▼ glyph |
| My Tickets | `.ticket-card` | Mobile card root (< 768px) |
| My Tickets | `.ticket-card__priority-badge` / `.ticket-card__status-badge` | Badge slot inside a card |
| My Tickets | `.pagination` | Pagination root |
| My Tickets | `.pagination__page-btn` | Each numbered page button |
| My Tickets | `.pagination__page-btn--active` | Current page |
| My Tickets | `.pagination__prev` / `.pagination__next` | Prev/Next controls |
| Ticket Detail | `.ticket-detail` | Screen root |
| Ticket Detail | `.ticket-detail__back-link` | "Back to My Tickets" link |
| Ticket Detail | `.ticket-detail__header` | Header panel (§16.1) |
| Ticket Detail | `.ticket-detail__attachments` | Attachments panel (§16.2) |

---

## 20. Resolved decisions

Genuine silences in specification.md/api-spec.md that this document
could not resolve on its own were tracked here as open questions; each
has since been settled, with the answer and reason recorded below.

- **OQ-UI-1**: The literal wording of client- and server-displayed
  validation messages beyond "field + rule violated" — api-spec.md §4
  fixes only that a `field` and a `message` exist per invalid field, not
  the exact `message` string. **Decision:** unchanged; the example
  strings used throughout this document (e.g. "Summary is required")
  remain illustrative, not binding. **Reason:** exact message strings
  are an implementation detail.
- **OQ-UI-2**: The default `sortDir` for `summary`, `requestedPriority`,
  and `status` when a Requester picks one of them as `sortBy` for the
  first time — BR-23 fixes only the default sort (`createdAt`
  descending) and the id-descending tiebreaker. **Decision:** ascending
  for Summary; descending for Requested Priority; descending for Current
  Status (§13.2). **Reason:** a Requester sorting by priority expects
  HIGH first, and the same most-attention-first convention is applied to
  status.
- **OQ-UI-3**: Whether a page-size selector control is required in the
  UI at all — BR-24 fixes the API's allowed page sizes (10/20/50) but
  nothing in specification.md or the labsheet requires the *UI* to
  expose changing it. **Decision:** add a page-size selector to the My
  Tickets toolbar with options 10, 20, 50 (§13.1, §13.5). **Reason:** the
  API supports all three, and without a UI control that capability
  cannot be exercised or screenshotted.
