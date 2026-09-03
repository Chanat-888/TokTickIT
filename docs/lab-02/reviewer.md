# Peer Review — Lab 2

**Author:** Chanat Dachkumhang (Pan) — GitHub `@Chanat-888`, ID 67070503409
**Peer reviewer / partner:** Jeerasak Phisawong (Snooker) — GitHub `@ShitheadQuin`, ID 67070503461

Reviews are recorded as they happen, not reconstructed at the end.

---

## 1. Reviews I gave on my partner's PRs

| # | PR | Base | Date | Verdict |
|---|----|------|------|---------|
| 1 | [ShitheadQuin/Toktickit#19 — docs: add Lab 2 engineering contract (spec, api, ui, tests)](https://github.com/ShitheadQuin/Toktickit/pull/19) | `lab2-staging` | 2026-08-29 | Request changes → Approved → Merged |
| 2 | [ShitheadQuin/Toktickit#20 — feat: data model, migration and seed](https://github.com/ShitheadQuin/Toktickit/pull/20) | `lab2-staging` | 2026-08-30 | Request changes → Approved → Merged |
| 3 | [ShitheadQuin/Toktickit#21 — feat: add Requester context, selection screen, and app shell](https://github.com/ShitheadQuin/Toktickit/pull/21) | `lab2-staging` | 2026-08-31 | Request changes → Approved → Merged |
| 4 | [ShitheadQuin/Toktickit#23 — docs: add BR-26/27/28 and AC-28/29, attachment validation precedence, Last Updated column](https://github.com/ShitheadQuin/Toktickit/pull/23) | `lab2-staging` | 2026-09-01 | Request changes → Approved → Merged |
| 5 | [ShitheadQuin/Toktickit#22 — feature/13 create ticket and screen](https://github.com/ShitheadQuin/Toktickit/pull/22) | `lab2-staging` | 2026-09-01 | Request changes → Approved → Merged |
| 6 | [ShitheadQuin/Toktickit#25 — feature/14 my tickets list](https://github.com/ShitheadQuin/Toktickit/pull/25) | `lab2-staging` | 2026-09-02 | Request changes → Approved → Merged |
| 7 | [ShitheadQuin/Toktickit#27 — Revert "feature/15 requester ticket detail"](https://github.com/ShitheadQuin/Toktickit/pull/27) | `lab2-staging` | 2026-09-02 | Comment only — queried the PR body |
| 8 | [ShitheadQuin/Toktickit#28 — feature/15 requester ticket detail](https://github.com/ShitheadQuin/Toktickit/pull/28) | `lab2-staging` | 2026-09-02 | Request changes → Approved → Merged |
| 9 | [ShitheadQuin/Toktickit#29 — feature/16 attachment lifecycle](https://github.com/ShitheadQuin/Toktickit/pull/29) | `lab2-staging` | 2026-09-03 | Request changes → Approved → Merged |
| 10 | [ShitheadQuin/Toktickit#30 — feature/17 e2e, ui style and responsive evidence](https://github.com/ShitheadQuin/Toktickit/pull/30) | `lab2-staging` | 2026-09-03 | Request changes → Approved → Merged |

_PR #24 and PR #26 were merged without a review from me._

### PR #19 — review comments given

Scope reviewed: `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`,
`ai-use.md` (6 files, +839 lines). Checked against the Lab 2 labsheet.

**Blocking**

1. `api-spec.md` §7 justifies the `X-Requester-Id` header by saying download links sit in
   `<img>` / `<a>` tags. A browser cannot set a custom header from `<img src>` or `<a href>`,
   so `GET /api/attachments/:id/download` is unreachable from the UI described in
   `ui-spec.md` §15. Suggested fix: accept `requesterId` as a query parameter on download
   only, or fetch the file as a blob.
2. The Requester field is missing from Create Ticket. Labsheet §4.4 lists it as required, and
   Part 6 requires evidence that it is populated from the selected Development Requester and
   that the saved Ticket's `requesterId` matches. Add it to the `ui-spec.md` §8 field order
   and add an acceptance criterion.
3. `tests.md` STYLE-01 asserts "required CSS classes", but `ui-spec.md` names no classes.
   Labsheet §8.8 requires the check to compare against `ui-spec.md`. Add a class-naming table.

**Should fix**

4. `specification.md` §10 Definition of Done omits peer review and visual inspection, both
   required by labsheet §4.1.
5. Seed data is unspecified. Labsheet §5.3 requires 4 categories, 6+ related systems,
   4 active and 1 inactive Requester, and an idempotent seed.

**Minor**

- No FR covers `GET /api/categories` or `GET /api/related-systems`.
- `specification.md` §11 says the Ticket Number hides the database id, but the `api-spec.md`
  example pairs `id: 42` with `TKT-2026-000042`.

**Author response (2026-08-29):** Fixed all five items plus both minor points in a follow-up
commit. Download moved to a query parameter, Requester field and AC-27 added, CSS class table
added in `ui-spec.md` §18, Definition of Done updated, seed counts specified, FR-17 added,
§11 Ticket Number wording corrected.

**Re-review (2026-08-29):** Approved and merged into `lab2-staging`. Each change verified on the
branch before approval.

### PR #20 — review comments given

Scope reviewed: `server/prisma/schema.prisma`, `server/prisma/seed.ts`, and the migration
`20260829115154_add_lab2_ticketing_models` (3 files, +211 lines). Checked against the merged
`specification.md` §7 and §11 and labsheet §5.

**Blocking**

1. The migration creates no sequence for the Ticket Number. `specification.md` §11 says the
   number is generated from a database sequence, and §7 assigns the migration to this Issue.
   The migration contains only enums, tables, indexes and foreign keys. Either add
   `CREATE SEQUENCE` here, or state in the PR that Issue #12 adds it in a second migration.

**Minor**

2. The hot query is `WHERE requesterId = ? ORDER BY ticketDate DESC` (BR-10 default sort).
   A composite `@@index([requesterId, ticketDate])` serves that better than the two separate
   single-column indexes.
3. `RelatedSystem` has `createdAt` but no `updatedAt`, while `Requester` and `Ticket` have both.
   `specification.md` §7 says "timestamps" for it. Consistency point only.

**Verified as correct:** five models, both enums, `CurrentStatus` limited to `NEW`, FK relations
and unique constraints matching §7, soft-removal fields on `Attachment`, and an idempotent seed
with 4 Categories, 6 Related Systems, and 4 active + 1 inactive Requester per labsheet §5.3.
The datasource URL comes from `prisma.config.ts`, which is correct for Prisma 7.

**Author response (2026-08-30):** Added `CREATE SEQUENCE ticket_number_seq` in a second
migration (`20260830075952_fix_ticket_index_add_sequence`) as raw SQL, since Prisma has no
standalone sequence type; Issue #13 will read it via `nextval()`. Replaced the two single-column
`Ticket` indexes with `@@index([requesterId, ticketDate])`. Added `updatedAt` to `RelatedSystem`
with `@default(now())` so the seeded rows migrate without error. Left `Category` unchanged.

**Re-review (2026-08-30):** Approved and merged into `lab2-staging`. All three changes verified
on the branch. `Category` staying as-is is acceptable — it comes from Lab 1 and no Lab 2
behaviour reads its `updatedAt`.

### PR #21 — Requester context, selection screen, app shell

Scope reviewed: `RequesterContext.tsx`, `RequesterSelector.tsx`, `AppShell.tsx`, `App.tsx`,
`server/src/app.ts`, `theme.css` and the tests (14 files, +568 −100).

**Blocking**

1. No Zen Green styling anywhere. `index.css` had none of the §7 tokens and none of the class
   names from `ui-spec.md` §18; the Continue button was `.btn.btn-primary`. Labsheet §8.1
   requires responsive Zen Green styling, and STYLE-01 asserts the §18 classes.

**Should fix**

2. `AppShell` had no navigation. `ui-spec.md` §10 and labsheet §8 require My Tickets and Create
   Ticket links, active-page indication, and a collapsing mobile nav.

**Minor**

3. AC-02's check lived inline in Home. Once more routes existed it would need a shared route
   guard rather than a repeated check.

**Verified as correct:** `sessionStorage` per §7 with a try/catch fallback for private browsing,
loading/empty/error states matching AC-04 to AC-06, `isActive` filtering per BR-06, the labsheet
§8.1 explanatory text, and a keyboard-accessible labelled select.

**Author response (2026-08-31):** Added `theme.css` with the §7 tokens and the §18 classes,
imported in `App.tsx`; the selector and shell now use `btn-tt-primary`, `tt-field`,
`tt-alert-error` and `btn-tt-secondary`. For the nav, he moved the requirement into Issue #14
rather than building it here, since `/create-ticket` and `/my-tickets` do not exist yet.

**Re-review (2026-08-31):** Approved and merged. I verified `theme.css` is actually imported,
not just present, and opened Issue #14 to confirm it now carries the AppShell nav requirement
including the active-page indicator, the mobile nav and the `ui-spec.md` §10 reference.
Deferring to #14 is the right call. The route guard from item 3 arrived later as
`RequireRequester.tsx` in PR #22.

### PR #23 — attachment rules BR-26/27/28, Last Updated column

Scope reviewed: `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` (4 files, +54 −11).
Documentation only.

**Requested changes**

1. `DELETE /api/attachments/:id` did not mention the `updatedAt` bump. BR-28 covers both upload
   and soft removal, and the upload endpoint stated it, so the contract disagreed with itself.
   API-21 tests both actions.
2. The Last Updated column was added to the desktop table but not the mobile card or the sort
   control, while `api-spec.md` now accepted `sort=updatedAt` — an API value with no user path.

**Verified as correct:** BR-26 writes the file first and deletes it on a failed database write,
correctly limiting compensation to the upload rather than the Ticket per BR-19. BR-27's order
puts existence and ownership before the file checks, so a rejection cannot leak another
Requester's Ticket, and `api-spec.md` §5 repeats the same five steps. AC-28 and AC-29 both map
to tests.

**Author response (2026-09-01):** Both accepted. The `updatedAt` bump is now stated on DELETE as
well as upload. `ui-spec.md` §11 now names all five sort options with asc/desc and the BR-10
default, and states that every permitted API sort value is reachable from the UI. That made the
mobile card a real problem rather than a nit, so Last Updated became its own muted line rather
than a fourth item that would wrap and fail AC-25.

**Re-review (2026-09-01):** Approved and merged. Both verified.

### PR #22 — Create Ticket API and screen

Scope reviewed: `server/src/app.ts`, `ticket-helpers.ts`, `CreateTicket.tsx`,
`RequireRequester.tsx`, `theme.css` and the tests (11 files, +983 −5).

**Blocking**

1. The client ignored `error.fields`. Every non-2xx response, including a 400
   `VALIDATION_ERROR`, showed "Unable to reach the server", so a server-only rejection surfaced
   as a network error with nothing the user could act on.
2. `.btn-tt-tertiary` was used on the Remove button but defined nowhere, so it rendered
   unstyled. `ui-spec.md` §18 specifies it.

**Should fix**

3. Selected attachments were silently dropped on submit — validated, then never sent, with
   nothing on screen saying so.

**Minor**

4. Ticket Number and Ticket Date were missing from the form; `ui-spec.md` §8 puts them in the
   top read-only row with Requester.
5. No client-side five-attachment limit (labsheet §4.5).

**Verified as correct:** the sequence read sits inside the request path and `formatTicketNumber`
pads to six digits; the `requesterId` 400/404 split matches `api-spec.md`; field errors are
batched on the server; the picker applies type-then-size order per BR-27; values are preserved
on failure per AC-12; and `RequireRequester` is the shared guard I asked for in PR #21.

**Author response (2026-09-01):** All five addressed. The client now maps `error.fields` onto the
right fields with server errors taking precedence, guards JSON parsing so an HTML 500 is not
reported as a network failure, defines `.btn-tt-tertiary`, states the deferral on screen in two
places, adds Ticket Number and Ticket Date as read-only fields, and enforces the five-file limit
after the type and size checks so client and server agree on BR-27's order.

**Re-review (2026-09-01):** Approved and merged. Each verified in the code. I agreed with his
reasoning on item 3 — disabling the picker would have blocked the Part 6 screenshot until #16.

### PR #25 — My Tickets list

Scope reviewed: `ticket-list-helpers.ts`, `server/src/app.ts`, `MyTickets.tsx`, `AppShell.tsx`,
`theme.css`, `App.tsx` and the tests (16 files, +1,778 −47).

**Blocking**

1. Nothing rendered the Ticket Detail route. Every row's Open button linked to `/tickets/:id`
   but `App.tsx` had no such route, so the button was a dead end.

**Should fix**

2. `.tt-pagination` and `.tt-list-controls` were used but defined nowhere, while every other
   class introduced in the PR was defined. STYLE-01 asserts the §18 classes.

**Minor**

3. `pageSize` was hard-coded to 10 with a code comment, but I could not find the same statement
   in `ui-spec.md` §11.

**Verified as correct:** ownership is the first `where` clause so no path can leak another
Requester's rows; `matchesNothing` returns 200 with an empty array rather than dropping the
filter or erroring; `ticketNumber desc` is the tie-breaker and is skipped when it is the chosen
sort, avoiding the Prisma duplicate-field trap; `requestSeq` prevents a slow response from
overwriting a newer one; every filter and sort change resets to page 1; empty and no-results are
properly distinguished; the error state keeps the list rather than blanking it; both badges carry
their word; and the AppShell nav now has the active state, underline and collapsing mobile menu
that Issue #14 took on from the PR #21 review.

**Author response (2026-09-02):** Added `TicketDetailPlaceholder.tsx` and the `/tickets/:id`
route wrapped in `RequireRequester` and `AppShell`, deliberately fetching nothing so the real
screen stays with Issue #15. Defined both CSS classes, using `flex-wrap` on the pagination so
page numbers wrap instead of overflowing on a narrow screen.

**Re-review (2026-09-02):** Approved and merged. Both verified. My third point was stale —
`ui-spec.md` §11 already said page size is not a user control in Lab 2, and I withdrew it.

### PR #27 — revert of the first Ticket Detail attempt

I did not submit a review verdict here. The PR body described adding the Ticket Detail screen,
but the single commit was `Revert "feature/15 requester ticket detail (#26)"` at +23 −627,
deleting `RequesterTicketDetail.tsx` and restoring the placeholder. It also carried `Closes #15`,
which would have closed the Issue while removing the feature. I left a comment asking whether
the branch had been pushed by accident rather than approving or rejecting. The revert turned out
to be intentional; the work returned as PR #28.

### PR #28 — Requester Ticket Detail (read-only)

Scope reviewed: `server/src/app.ts`, `RequesterTicketDetail.tsx`, `App.tsx` and the tests
(7 files, +627 −23).

**Blocking**

1. Attachments came back unordered — the Prisma select had no `orderBy`, so row order was
   whatever Postgres returned. It would look stable in testing and shuffle after an update,
   which matters for the Part 8 screenshots.

**Should fix**

2. The active attachment row was missing the type icon and Remove button listed in
   `ui-spec.md` §15.

**Minor**

3. `formatBytes` uses 1024 while BR-15's 5 MB limit is enforced elsewhere — worth confirming the
   two agree so an accepted file never displays as over the limit.

**Verified as correct:** 403 for an unowned Ticket and 404 for a missing one per BR-22, with
`requesterId` stripped from the response so ownership never leaks; the non-numeric id path
returns 404 before any query; the Requester is re-checked for `isActive` per BR-06; the screen
renders nothing on 403 or 404 per UI-13; the download link already uses the query-parameter form
from `ui-spec.md` §15; removed attachments show the reason with no download link.

**Author response (2026-09-02):** Added `orderBy: { uploadedAt: 'asc' }`. Added the type icon;
kept Remove out on purpose, since this screen is read-only per `ui-spec.md` §14 and Remove
belongs to Issue #16, recorded in a code comment rather than by editing §15. Confirmed the byte
limit already matches `CreateTicket.tsx` and BR-15, and documented the agreement.

**Re-review (2026-09-02):** Approved and merged. All three verified; the icon renders with
`aria-hidden` so it stays decorative beside the filename.

### PR #29 — attachment lifecycle

Scope reviewed: `attachment-validation.ts`, `attachment-storage.ts`, `server/src/app.ts`,
`AttachmentSection.tsx`, `CreateTicket.tsx`, `theme.css` and the tests (14 files, +1,695 −93).

**Blocking**

1. `.btn-tt-destructive` was used on both Remove buttons but defined in no CSS file — I checked
   `theme.css`, `index.css` and `App.css`, and Bootstrap has no such class either, so the button
   rendered with no colour. The same applied to `.tt-attachment-section`, `.tt-attachment-list`,
   `.tt-attachment-row`, `.tt-attachment-divider` and `.tt-upload-error`. The divider mattered
   most: `ui-spec.md` §14 requires a visible separator, and a bare `<hr>` with no rule is the
   default hairline.

**Verified as correct:** BR-27's order is enforced without a wasted query, checking type and size
with a count of 0 first and only then loading the real count. BR-26 deletes the stored file when
the transaction fails and swallows `ENOENT` so the compensation cannot mask the original error.
BR-24's stored filename is a UUID with the extension derived from the MIME type, never from the
client's filename. Download treats missing and soft-removed identically as 404 while GET metadata
still returns removed rows, matching BR-16 exactly. Both upload and removal bump `updatedAt`
inside the same transaction per BR-28. BR-19's retry keeps the saved Ticket, and the client
picker mirrors the server's limits.

**Author response (2026-09-03):** Defined all the flagged classes in `theme.css`, plus
`.tt-attachment-remove-confirm` for the BR-17 reason prompt, which had the same problem. The
divider now renders as a real rule.

**Re-review (2026-09-03):** Approved and merged. Verified each class, including the base, hover,
focus and disabled states on `.btn-tt-destructive`. `.tt-upload-error` turned out to be unused,
so it needs no rule.

### PR #30 — E2E, UI style and responsive evidence

Scope reviewed: `playwright.config.ts`, `requester-ticket-flow.spec.ts`, `ui-style.spec.ts`,
`responsive.spec.ts`, `keyboard-nav.spec.ts`, `tests.md` (9 files, +511 −7).

**Blocking**

1. The busy-state test asserted no busy state. The test named for `.tt-busy` and the disabled
   attribute only waited for the Ticket Number. `tests.md` marked STYLE-01 Pass with "button
   states" in its description, so the plan claimed coverage that did not exist — exactly the kind
   of false traceability evidence Part 3 is graded on.

**Should fix**

2. `keyboard-nav.spec.ts` was not keyboard-driven where it mattered. `select.selectOption()` is a
   programmatic call, not a key press, and the following `ArrowDown` moved the selection again,
   so the submitted Requester need not have been the asserted one. AC-26 is about keyboard
   operability.

**Minor**

3. Every suite created Tickets and none cleaned up — six per run across RESP-01 and STYLE-02,
   which would fill the Part 7 My Tickets screenshots with fixture rows.

**Verified as correct:** `webServer` starts both dev servers with `reuseExistingServer` so the
suite runs against real Postgres rather than mocks; E2E-02 proves cross-Requester rejection
through both the list and a direct URL and checks the summary never renders; E2E-03 captures the
download href before removal and then asserts 404, which is the BR-16 evidence Part 8 needs; the
asterisk test reads `::after` rather than the text node; and the overflow check uses a sub-pixel
tolerance instead of an exact zero.

**Author response (2026-09-03):** The busy test now asserts `.tt-busy` and `toBeDisabled()`
immediately after `click()`, with `page.route()` delaying only the `POST /api/tickets` response
so the window is observable deterministically. `selectOption()` is gone — two `ArrowDown` presses
drive the choice, the value is read back, and the chosen Requester's name is asserted after
submission. Added `global-teardown.ts`, which deletes every Ticket and its Attachments carrying
the shared `E2E_MARK` prefix.

**Re-review (2026-09-03):** Approved and merged. All three verified. The teardown deletes
Attachments before Tickets so the foreign key holds, and matches on `E2E_MARK` only, so it cannot
touch rows a human created.

---

## 2. Reviews my partner gave on my PRs

| # | PR | Base | Date | Verdict |
|---|----|------|------|---------|
| 1 | [Chanat-888/TokTickIT#13 — docs: add Lab 2 sprint engineering specification](https://github.com/Chanat-888/TokTickIT/pull/13) | `lab2-staging` | 2026-08-29 | Approved → Merged |

### PR #13 — review comments received

**Thread 1 — BR-37 (transition to authentication in Lab 3)**

Jeerasak said BR-37 reads more like a design note than something testable, that no acceptance
criterion maps to it, and suggested moving it to §11 Assumptions and Decisions.

I disagreed and kept it as a business rule. Labsheet §4.3 lists "the transition to real
authentication in Lab 3" as a required business-rule area, so moving it to §11 would leave that
area uncovered. I agreed with his point that no AC should map to it, and committed to listing it
as intentionally untested in `tests.md`. That commitment is now honoured in `tests.md` §7.

**Thread 2 — BR-38 (Ticket Number generation)**

Jeerasak noted approvingly that BR-38 explains why `MAX(id)+1` is unsafe under concurrency, and
why insert-and-retry was chosen over a per-year Postgres sequence, rather than just stating the
rule.

I noted an implementation risk to watch: the retry path must not swallow unrelated database
errors, so only a unique-constraint violation on `ticketNumber` may trigger a retry.

_Approved and merged into `lab2-staging` after this exchange._
