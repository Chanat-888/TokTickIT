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
| 2 | [Chanat-888/TokTickIT#14 — docs: add Lab 2 API spec, UI spec, test plan, and review record](https://github.com/Chanat-888/TokTickIT/pull/14) | `lab2-staging` | 2026-08-31 | Request changes → Merged (no approving review recorded) |
| 3 | [Chanat-888/TokTickIT#24 — feat(lab-02): database schema and seed](https://github.com/Chanat-888/TokTickIT/pull/24) | `lab2-staging` | 2026-08-31 | Request changes → Merged (no approving review recorded) |
| 4 | [Chanat-888/TokTickIT#25 — feat(lab-02): Zen Green theme and app shell](https://github.com/Chanat-888/TokTickIT/pull/25) | `lab2-staging` | 2026-08-31 | Approved → Merged |
| 5 | [Chanat-888/TokTickIT#26 — feat(lab-02): Development Requester context](https://github.com/Chanat-888/TokTickIT/pull/26) | `lab2-staging` | 2026-08-31 | Request changes → Approved → Merged |
| 6 | [Chanat-888/TokTickIT#27 — feat(lab-02): Create Ticket](https://github.com/Chanat-888/TokTickIT/pull/27) | `lab2-staging` | 2026-09-01 | Request changes → Merged (no approving review recorded) |
| 7 | [Chanat-888/TokTickIT#28 — feat(lab-02): My Tickets](https://github.com/Chanat-888/TokTickIT/pull/28) | `lab2-staging` | 2026-09-01 | Request changes → Approved → Merged |
| 8 | [Chanat-888/TokTickIT#29 — feat(lab-02): Ticket Detail](https://github.com/Chanat-888/TokTickIT/pull/29) | `lab2-staging` | 2026-09-01 | Request changes → Approved → Merged |
| 9 | [Chanat-888/TokTickIT#30 — feat(lab-02): Attachments](https://github.com/Chanat-888/TokTickIT/pull/30) | `lab2-staging` | 2026-09-02 | Request changes → Approved → Merged |
| 10 | [Chanat-888/TokTickIT#31 — test(lab-02): E2E tests, responsive tests, and screenshots](https://github.com/Chanat-888/TokTickIT/pull/31) | `lab2-staging` | 2026-09-02 | Request changes (×2) → Approved → Merged |
| 11 | [Chanat-888/TokTickIT#32 — docs(lab-02): README, seed fix, and AI usage log](https://github.com/Chanat-888/TokTickIT/pull/32) | `lab2-staging` | 2026-09-03 | Request changes → Approved → Merged |
| 12 | [Chanat-888/TokTickIT#33 — docs(lab-02): justify e2e/lab-02/screenshots path](https://github.com/Chanat-888/TokTickIT/pull/33) | `lab2-staging` | 2026-09-03 | Approved → Merged |

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

### PR #14 — review comments received

**Thread 1 — Idempotency-Key error message consistency**

Jeerasak confirmed two things were complete: AC traceability (all AC-01–27 in `tests.md` §3
map to at least one test, and `specification.md` still has exactly 27 ACs) and the CSS class
names (all 16 `STYLE-*` rows in `tests.md` §2.4 match the `ui-spec.md` §19 table one by one,
with nothing missing or extra). He then flagged one inconsistency: `tests.md` API-58/59 expect
the message `"Missing or invalid idempotency key"`, but that message wasn't written in
`api-spec.md`, even though the `X-Requester-Id` row right above it included its exact message
— asking whether the Idempotency-Key row could follow the same pattern. He also noted that
`tests.md` said the message had been added to the field-validation 400 table, but
`api-spec.md` line 327 only had the condition, not the message, so the two docs disagreed.

I replied (2026-08-31): fixed in `2ab2155` — moved the Idempotency-Key 400 into the Responses
table in `api-spec.md` §4, right under the `X-Requester-Id` row, with the exact message
`"Missing or invalid idempotency key"`, so it now follows the same pattern he pointed at. I
removed it from the field-validation table below it, since `Idempotency-Key` is a header, not
a request-body field, and added a short note saying both header 400s are checked before any
body field. I also corrected `tests.md` §8 OQ-TEST-1, which had said the message was added to
the field-validation table — it now points at the response row, so `api-spec.md` and
`tests.md` agree.

_No further review followed the fix. `reviewDecision` on the PR stayed `CHANGES_REQUESTED`,
and it was merged by `ShitheadQuin` with no approving review on record._

### PR #24 — review comments received

**Thread 1 — Dana Lim's zero-ticket status in the seed**

Jeerasak asked, both in the formal review and as a duplicated inline comment on
`server/prisma/seed.ts`: "Dana is active but isn't included in `ticketPlan`, so she ends up as
another active requester with zero tickets. Is that intentional for the dropdown/selector
tests, or should `ticketPlan` include her too?" In the same review he also noted, approvingly,
that spacing each ticket's `createdAt` by 29 hours was "a good catch fixing this before it
became a hidden test bug," since it makes sure every timestamp is distinct and the tickets can
be sorted correctly.

I replied inline (2026-08-31): intentional. `specification.md` §7 sets the seed minimum at
four active Requesters, and the ~25/~5/0 ticket split is defined over three of them — Dana is
the fourth, so she has no tickets by construction. Priya is the one AC-13 uses for the empty
state; Dana is there so the selector dropdown has a fourth option and doesn't look thin. Adding
her to `ticketPlan` would leave only two zero-ticket-free Requesters and change the documented
distribution, so I kept it as is, and added a comment above `REQUESTERS` in `e15894f` so this
is clear in the code.

_`reviewDecision` stayed `CHANGES_REQUESTED` — my reply is recorded as a `COMMENTED` review,
not an approval — and the PR was merged by `ShitheadQuin` with no approving review on record._

### PR #25 — review comments received

**Thread 1 — Change Requester button wiring**

Jeerasak approved outright, noting that the classes in `components.css` all mapped exactly to
the §19 table with nothing out of scope leaking in, and that the `theme.css` tokens matched
§1/§2 value for value. He also called out `<NavLink to="/tickets" end>` as "good catch —
without it My Tickets would stay highlighted on /tickets/new and /tickets/:id too." His one
open question, left inline on `AppShell.tsx`: "No onClick wired yet — confirming this is
deferred to Issue #17 along with the real Requester name, not an oversight here?"

I replied inline (2026-08-31): deferred to #17, not an oversight. `ui-spec.md` §10 defines the
button as clearing the stored selection and routing back to the selector, but the
`sessionStorage` context doesn't exist until #17, so wiring an `onClick` now would either do
nothing or need rewriting; the Requester name next to it is a placeholder for the same reason,
and both become real in the same commit.

_Approved and merged into `lab2-staging`. The approval was given before my reply — the open
question was resolved afterward, ahead of merge._

### PR #26 — review comments received

**Thread 1 — plain `fetch` on `GET /api/requesters`**

Jeerasak confirmed as a PR comment: "§0.1 explicitly excludes GET /api/requesters from the
X-Requester-Id requirement since it's the endpoint that runs before a Requester is chosen.
Plain fetch is correct here."

**Thread 2 — sessionStorage parsing**

Jeerasak, also as a PR comment: "Good defensive touch — validating the parsed shape with
isSelectedRequester and catching JSON.parse failures means corrupted or hand-edited
sessionStorage just falls back to 'nothing selected' instead of crashing the app on load."

**Thread 3 — `/api/categories` 500 message drift (the blocking item)**

In the formal review, Jeerasak flagged: "the `/api/categories` 500 handler still returns
`{ error: "Unable to load categories" }`, but `api-spec.md` §12 OQ-5 decided that endpoint
should use the generic `"Unexpected server error"` message — same as `/api/requesters` right
below it, which does it correctly. Pre-existing drift, not something this PR introduced, but
worth a quick follow-up fix so the two reference-data endpoints match their own spec."

I replied as a PR comment (2026-08-31): "Good catch, fixed in `f601b93`. `/api/categories` now
returns the generic 'Unexpected server error' on 500, matching `/api/requesters` and
`api-spec.md` §12 OQ-5. Nothing else in the handler changed."

_Request changes → Approved → Merged into `lab2-staging`. The approval was recorded before I
posted the fix; the fix landed before merge._

### PR #27 — review comments received

**Thread 1 — idempotency replay vs. body validation ordering**

Jeerasak confirmed, checking the code rather than just the description: the idempotency replay
check runs before `validateTicketInput(req.body)`, so a malformed replay body doesn't get
validated again, and the attachment checks are in the right order — 400 → 404 → 409 → 415 →
413 — matching `api-spec.md` §12 OQ-9. He also left an inline comment praising the
`err.meta.target` handling: "Good handling here. Using Prisma's `err.meta.target` to tell a
`ticketNumber` collision from a `(requesterId, idempotencyKey)` collision makes sense. One
should retry with a new ticket number, while the other means the same request already won the
race, so we should re-fetch it and return 200."

**Thread 2 — multer file size limit (inline, `server/src/app.ts`)**

Jeerasak: "There's no `limits.fileSize` set here, so a file bigger than 5MB gets fully loaded
into memory before the manual size check runs. Would it be worth adding a higher `fileSize`
limit in multer too, like 10–20MB, so oversized files get rejected before using too much
memory?"

I replied inline (2026-09-01): fixed in `67fb3eb` — added `limits.fileSize: 20MB` to the multer
instance, a coarse guard well above the real 5MB business limit, so anything over 20MB is
rejected by multer before being fully buffered into memory. Anything between 5MB and 20MB
still passes multer and hits the existing manual 413 check. `handleAttachmentUpload`'s error
branch was already a catch-all, so `LIMIT_FILE_SIZE` routes through the same 400 response as
any other malformed-upload error — no new branch needed there.

_`reviewDecision` stayed `CHANGES_REQUESTED`, and the PR was merged by `ShitheadQuin` with no
approving review on record._

### PR #28 — review comments received

**Thread 1 — Priority sort via enum order (inline, praise)**

Jeerasak: "Nice detail here: `requestedPriority` sorts correctly without needing a separate
sort-weight column. The `Priority` enum is `LOW, MEDIUM, HIGH`, and Postgres sorts enums in
that order, so `desc` puts HIGH first as required by `ui-spec.md` OQ-2. Using the enum order
keeps it simple."

**Thread 2 — pageSize tie-break rounding (inline)**

Jeerasak: "On a tie, like `pageSize=15` being equally close to 10 and 20, `reduce` keeps the
first one, so it clamps to 10. Is that the intended behavior, or should ties round up to 20?
OQ-8 only says 'nearest allowed value,' so it might be worth adding a quick note to make the
tie-break clear."

I replied inline (2026-09-01): round-down is the intended behavior, not an accident of
`reduce`'s iteration order. Fixed in `82890cd` — added a comment explaining it: OQ-8 only says
"nearest allowed value," so on an exact tie either direction is defensible, and I picked
round-down and documented it rather than leaving it implicit.

His formal review also noted, in passing, that the multer `fileSize` limit from the PR #27
review is present here too.

_Request changes → Approved → Merged into `lab2-staging`._

### PR #29 — review comments received

**Thread 1 — missing test for a malformed `:id`**

Jeerasak, inline on `ticket-detail.api.test.ts`: "The PR mentions that a malformed `:id`
should return 404, but there's no test covering it. Might be worth adding a quick
`GET /api/tickets/abc` → expect 404 test so a future change doesn't accidentally turn it into
a 400."

I replied inline (2026-09-01): added in `86376ce` — `GET /api/tickets/abc` now asserts 404
with the same `{ error: "Not found" }` body as the other not-found cases in this file, so a
future change to a 400 would break the test.

**Thread 2 — response-body comparison (inline, praise)**

Jeerasak: "Really like this one — instead of just checking that both cases return 404, it
compares the response bodies too. That proves the two cases are actually indistinguishable,
which is a stronger check for BR-10/BR-36 than just checking the status code."

**Thread 3 — 404 vs. 400 for a non-numeric id (inline, `app.ts`)**

Jeerasak: "Confirmed against `api-spec.md` §6 — it only defines 200, 403, 404, and 500
responses. So returning 404 for a non-numeric ID matches the spec instead of adding a 400 that
isn't defined. Good catch flagging it though, since 400 would be an easy assumption."

I replied inline: "Confirmed, thanks for checking."

_Request changes → Approved → Merged into `lab2-staging`. All three threads verified before
approval._

### PR #30 — review comments received

**Thread 1 — download uses a query-parameter `requesterId`, not a blob URL**

Jeerasak, as a PR comment: he had considered the blob/object-URL approach, but kept the query
parameter because the download route needs to work as a plain `<a href>` without requiring
JavaScript to fetch the file first and build a blob URL; the parameter is only allowed on this
one route through `allowQueryFallback`, with every other route still requiring the
`X-Requester-Id` header. He agreed putting the requester id in the URL has downsides —
browser history and server logs — but said the requester context is already only a temporary
stand-in for real authentication for this lab, so he kept the direct-link behaviour required by
BR-35 rather than moving to a client-side blob flow; Lab 3 will replace the requester mechanism
with real session authentication anyway.

**Thread 2 — the "Unavailable" pre-check doesn't fully close the race window**

Same PR comment: Jeerasak agreed the pre-check doesn't fully remove the race — an attachment
could still be removed after the metadata request succeeds but before the browser follows the
download URL. He said the pre-check mainly catches the normal case of an attachment already
removed since the page loaded, so the user doesn't immediately land on a 404 page, but it
can't guarantee the file still exists at the exact moment of navigation; he considered it worth
keeping for the common case without treating it as a complete fix.

I replied to both threads as a single PR comment (2026-09-02): "Makes sense, thanks for the
explanation — agreed on both."

**Thread 3 — `getAttachment` can't distinguish a 404 from a network/500 error (the blocking
item, formal review)**

Jeerasak's `CHANGES_REQUESTED` review: "Agreed on this one. Right now getAttachment throws for
any non-OK response, which means the caller can't tell the difference between a
missing/removed attachment and something like a 500 or a network failure. Treating all of
those as 'Unavailable' isn't correct. I'll change the error handling so the caller can
distinguish the expected attachment-not-available case from other failures. That way a 404 can
show the Unavailable state, while a server error or network problem can be handled as an
actual error instead of making it look like the attachment was removed."

I replied (2026-09-02): "Fixed in `97fe385`. Added `AttachmentNotFoundError`, thrown by
`getAttachment` specifically on a 404, mirroring `NotFoundError`'s existing pattern. The
Unavailable message and row-disable now only fire on that error or on `meta.isRemoved`; any
other failure (network, 500) falls through to the real download URL instead of being mistaken
for a removal."

He also noted a smaller item in his first comment: API-58/59 were moved into
`create-ticket.api.test.ts` because they test `POST /api/tickets` validation rather than the
attachment endpoint itself.

_Request changes → Approved → Merged into `lab2-staging`._

### PR #31 — review comments received

**Thread 1 — no test isolation, dev DB grows every run (the main blocker)**

Jeerasak's first `CHANGES_REQUESTED` review raised three points. Point 1, the blocker: E2E-01
creates a real ticket in the dev DB on every run with nothing removing it; reading the initial
total instead of hardcoding 25 avoids the assertion failing, but the DB still grows by one
ticket per run until manually re-seeded — which is also why the suite needs
`fullyParallel: false` and why the 26 screenshots depend on whatever DB state existed when
captured. He asked whether a `globalSetup` could reset/re-seed the DB before each run. Point 2:
whether RESP-01–07 are screenshot evidence only or use `toHaveScreenshot`, and if evidence
only, what actual assertions determine pass/fail. Point 3: E2E-01–08 + RESP-01–07 gives 15 test
IDs, but 22 tests are reported — he assumed the responsive cases are parameterised across
viewports and asked me to confirm.

I replied as a PR comment (2026-09-02): fixed in `3267817` — added a Playwright `globalSetup`
that truncates `Ticket`/`Attachment` and re-seeds before every run, so the dev DB starts from
the exact 25/5/0 shape every time instead of growing by one ticket per run; E2E-04's `>=25`
workaround is reverted back to an exact 25 now that it's guaranteed. On point 2: screenshot
evidence only — RESP-01..07 are the real assertions (visibility, collapsed nav, no horizontal
scroll, column presence, etc.), and the §4 checklist's screenshots are separate capture steps
with no pixel-diff assertion, matching `tests.md` §7's stated limitation. On point 3: confirmed
— 8 E2E + 7 RESP = 15 named `test()` blocks, but the screenshot checklist is captured across 7
more `test()` blocks grouped by screen rather than one per screenshot (e.g. one test capturing
8 My Tickets screenshots), so 15 + 7 = 22.

**Thread 2 — verifying `globalSetup` is safe and confirming the fix commit landed**

Jeerasak's second `CHANGES_REQUESTED` review asked me to verify, before merging: that
`globalSetup` truncates the dev DB and not something he'd mind losing, that the connection
string it uses is the dev one, and that it's actually wired via `globalSetup` in the Playwright
config rather than a same-named unused file. He also asked me to confirm `3267817` was really
on `feature/lab2-e2e-visual` with the commit count moved from 1 to 2, since his fetch still
showed the stale single-commit page.

I replied (2026-09-02): confirmed both. `globalSetup.ts` uses `server/.env`'s `DATABASE_URL`
(the dev DB) via `npx prisma db execute --stdin --schema prisma/schema.prisma` run with `cwd`
set to `server/` — never `toktickit_test` — and it's wired in `playwright.config.ts` via
`globalSetup: "./global-setup.ts"`, not just a same-named file sitting unused. On the commit:
`origin/feature/lab2-e2e-visual` is at `3267817`, on top of `34c476f` (the original PR commit)
— two commits total — and I suggested a hard refresh, since `git fetch` on my end showed it
was definitely pushed.

_Request changes (×2) → Approved → Merged into `lab2-staging`._

### PR #32 — review comments received

**Thread 1 — the seed log fix may be undone by PR #31's `globalSetup` (blocking)**

Jeerasak's `CHANGES_REQUESTED` review raised two points and a minor note. Point 1: the closing
log had changed from `prisma.ticket.count()` to `ticketPlan.length` because the raw count
picked up tickets the E2E suite created against the same dev DB — true when written, but PR
#31's `globalSetup` truncates `Ticket`/`Attachment` and re-seeds before every run, so once that
lands the dev DB has no foreign tickets and the raw count is correct again. He also argued the
two numbers aren't equally useful: `prisma.ticket.count()` is a real query that can disagree
with reality if a create silently fails, while `ticketPlan.length` is an in-memory array length
that "will print 30 whether or not a single row was written." He asked whether the log could
revert to the raw count, or better, assert the count equals `ticketPlan.length` and fail loudly
on mismatch. Point 2: since both this PR and #31 target `lab2-staging` and touch dev-DB seed
behaviour, which should merge first — if #31 lands after this one, the README's seeding
section could describe behaviour `globalSetup` has since changed. Minor: the README's worked
`.env.test` example uses the `postgres` role — worth double-checking there's no real password
in it since the repo is public.

I replied as a PR comment (2026-09-03): point 1 fixed in `1e8e474` — the log now prints both
the seed's own plan size (still the 30/25-5-0 anchor for the breakdown) and a real
`prisma.ticket.count()`, with a `console.error` if they disagree, so a silent create failure
now shows up as a mismatch instead of being masked by a value that can't disagree with itself;
confirmed the mismatch warning fires as expected on my machine right now — plan 30, DB 33,
from leftover tickets from earlier E2E runs against the same dev DB, which the warning message
itself says is not necessarily a problem. Point 2: no ordering hazard — #31 was already merged
into `lab2-staging` before this branch existed, so `globalSetup`'s truncate-and-reseed
behaviour was already in place when I wrote the seed fix. Minor: confirmed `server/.env.test`
was never committed (`git log --all` shows no history for it) — the README's
`postgres`/`toktickit` example is documentation only, not a real credential, and matches the
actual local file on this machine.

**Thread 2 — non-blocking follow-up: warn only when `count < plan`**

In his `APPROVED` review, Jeerasak first walked back point 2 above: "On point 2, you're right
and I was wrong: I'd assumed #31 was still pending, but it was already merged into
`lab2-staging` before this branch existed, so `globalSetup` was in place when you wrote the
seed fix. No ordering decision needed." He called the `1e8e474` fix for point 1 "better than
what I proposed," and settled point 3 by thanking me for checking `git log --all` rather than
just the working tree. He then raised one further, explicitly non-blocking point: the mismatch
warning fires on every healthy run right now (plan 30, DB 33) because `globalSetup` truncates
before a run but nothing cleans up after, so `count > plan` is expected while `count < plan` is
the case that actually signals something is wrong — "a warning that fires on every healthy run
is one people stop reading." He suggested warning only on `count < plan`, "worth a one-line
change whenever you next touch `seed.ts`," and closed with "Nice work on this one — merging."

_No reply to Thread 2 is on record for this PR — it arrived inside the approval itself._

_Request changes → Approved → Merged into `lab2-staging`._

### PR #33 — review comments received

Jeerasak's only review was `APPROVED` with the single word "Approving." `gh api
repos/Chanat-888/TokTickIT/pulls/33/comments` returned an empty array, and no other PR
comments were left.

_Approved with no substantive comments, and merged into `lab2-staging`._
