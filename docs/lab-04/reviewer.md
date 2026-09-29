# Peer Review: Lab 4

**Author:** Chanat Dachkumhang (GitHub: @Chanat-888)
**Reviewer:** Jeerasak Phisawong (GitHub: @ShitheadQuin)

We each keep our own copy of the repository (`Chanat-888/TokTickIT` and `ShitheadQuin/Toktickit`)
and review each other's Pull Requests for every Lab 4 Issue.

Updated as PRs are opened, reviewed and merged during the sprint, not reconstructed at the end.
Per the course workflow guide, the reviewer merges each approved PR; the author replies to every comment.

## Reviews I gave on my partner's PRs

Pull Requests Jeerasak authored and I reviewed, all targeting his `lab4-staging`:

| PR | Branch | My verdict |
|----|--------|------------|
| [#66](https://github.com/ShitheadQuin/Toktickit/pull/66) | feature/59-lab4-spec | Approved (one non-blocking note on the api-spec check-ordering), merged into lab4-staging |
| [#67](https://github.com/ShitheadQuin/Toktickit/pull/67) | feature/60-actions-api | Approved (one non-blocking finding, a `TICKET_CLOSED` race), fix deferred and delivered in #69, merged into lab4-staging |
| [#68](https://github.com/ShitheadQuin/Toktickit/pull/68) | feature/61-actions-ui | Approved (two non-blocking findings, an assignee-select gap and a dialog accessibility gap), fixes deferred and delivered in #69 and #71, merged into lab4-staging |
| [#69](https://github.com/ShitheadQuin/Toktickit/pull/69) | feature/62-workflow | Approved with no changes requested, merged into lab4-staging |
| [#70](https://github.com/ShitheadQuin/Toktickit/pull/70) | feature/63-dashboards | Approved with no changes requested, merged into lab4-staging |
| [#71](https://github.com/ShitheadQuin/Toktickit/pull/71) | feature/64-hardening | Approved with no changes requested, merged into lab4-staging |

Jeerasak's repository numbers its own business rules and tests independently of mine. Every
reference below is to **his** `specification.md` / `api-spec.md` / `ui-spec.md` / `tests.md`, not to
this repository's.

### Sprint 4 engineering contract, [ShitheadQuin/Toktickit#66](https://github.com/ShitheadQuin/Toktickit/pull/66)

Docs-only PR (+983/-0) — reviewed the four areas the PR description flagged (§11 transition matrix,
BR-16 resolution gate, BR-26 dashboard calculations, §6 authorization matrix) plus overall cross-doc
consistency.

**My review (approved, one non-blocking note):** All four flagged areas were internally consistent
across `specification.md`, `api-spec.md`, `ui-spec.md` and `tests.md` — the transition matrix covers
all 8 statuses exactly once as a "to" state, the resolution gate wording matches everywhere it's
cited, every dashboard drill-down link in the JSON examples matches the BR-26 table, and the
authorization matrix matches BR-03/BR-22/FR-06. One note: `api-spec.md` §1's check ordering put
`NOT_TICKET_OWNER` (403) after `409 STALE_UPDATE`, so a non-owner sending a stale version would learn
the Ticket changed before being told they weren't authorized for that specific action — worth fixing
during implementation, not blocking the contract.

**Jeerasak's response:** None needed at the time; the ordering was corrected during implementation
in #69 (ownership is now checked before the version, credited there as "PR #66's review note").

**My approval:** Approved and merged into `lab4-staging`.

### Actions Taken foundation: migration, seed, API and authorization, [ShitheadQuin/Toktickit#67](https://github.com/ShitheadQuin/Toktickit/pull/67)

+1442/-31 — migration, rollback script, `action-rules.ts`, `routes/actions.ts`, seed.

**My review (approved, one non-blocking finding):** Validation and business rules matched the #66
contract throughout (BR-05 through BR-12, BR-19, BR-20), and the migration/rollback are
additive-only with tables dropped before the enum they depend on. One real finding: in both
`POST /staff/tickets/:id/actions` and `PATCH /staff/actions/:id`, the `TICKET_CLOSED` check read the
Ticket's status from a snapshot taken before the write, while only the Action's own `version` was
re-checked atomically inside the transaction — so a Ticket closed by a concurrent request between the
check and the commit could still get an Action written to it, which BR-10 says shouldn't happen.
Narrow race window, not something a single-request test like API-08 would catch, and not blocking for
a lab PR.

**Jeerasak's response:** Agreed the check was right, deferred the fix to #62 (now #69) since that
Issue already restructures how Ticket-status writes run in transactions. Fixed there with
`writeActionIfTicketOpen`, which re-verifies the Ticket's status atomically inside the same
transaction as the Action write via a conditional `updateMany` that also takes a row lock, with a
test closing the Ticket between the check and the write.

**My approval:** Approved and merged into `lab4-staging`. Verified the fix landed as described when
reviewing #69.

### Actions Taken UI, [ShitheadQuin/Toktickit#68](https://github.com/ShitheadQuin/Toktickit/pull/68)

+1346/-9 — `ActionsTaken.tsx` (620 lines), badges, theme, and the two Ticket Detail page integrations.

**My review (approved, two non-blocking findings):** Client-side validation mirrored the server's
BR-06/07/08 rules exactly, the `clientRequestId`-per-form-open plus a `submitting` ref guard correctly
blocked double-submit duplicates, and the status `<select>` options came from the same transition
table the server enforces. Two findings: (1) in create mode, the assignee `<select>` defaults to the
signed-in user's id, but the "keep the stored assignee selectable even if missing from the list"
fallback only fired in edit mode — once Administrators could reach this page, an Administrator
creating an Action would see a mismatch between what's visually selected and what's actually
submitted. (2) The Cancel-Action confirm dialog was hand-rolled with no focus trap or Escape
handling, though the same gap already existed in Lab 3's own status-confirm dialog, so not a
regression this PR introduced.

**Jeerasak's response:** Agreed with both. (1) deferred to #62 (now #69), which opens the page to
Administrators and adds Administrators to the assignable list — the same create-mode fallback edit
mode already had, with a UI test for an Administrator opening Add Action. (2) `ui-spec.md` §13
already promised focus trapping and Escape, so this was a gap against the spec even though Lab 3 had
the same gap; fixed for every confirm dialog (Cancel Action, Cancel/Reopen Ticket, and a third site he
pointed out I'd missed — the Requester's "Problem Appears Resolved" confirmation) in #64 (now #71),
with a keyboard-navigation test.

**My approval:** Approved and merged into `lab4-staging`. Verified both fixes landed as described
when reviewing #69 and #71.

### Ticket workflow: resolution gate, stale updates, status history and Administrator access, [ShitheadQuin/Toktickit#69](https://github.com/ShitheadQuin/Toktickit/pull/69)

+1119/-192 — `staff-tickets.ts`, new `resolution-gate.ts`, `actions.ts` changes, client status-control
and history wiring.

**My review (approved, no changes requested):** This PR closed all three outstanding findings from
#66-#68 (see above) — verified each fix directly against the diff rather than taking the PR
description's word for it. New logic also checked out on its own: the resolution gate is pure,
correctly ignores Cancelled Actions, and is recounted inside the same `Serializable` transaction as
the status write, so an Action added at the same instant can't slip past it; claim/reassign/
priority/status all now atomically re-check `expectedVersion` via `updateMany` row-count; status
history rows are written in the same transaction as every status-changing write, including a claim;
and the minute-precision fix for the Action-date lower bound is a legitimate bug catch from the E2E
run, with a unit test at the boundary.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab4-staging`.

### Role dashboards, [ShitheadQuin/Toktickit#70](https://github.com/ShitheadQuin/Toktickit/pull/70)

+1708/-60 — `dashboard-queries.ts`, `routes/dashboard.ts`, the `statusGroup=active` filter on both
list endpoints, and the client Dashboard page plus URL-synced filters on My Tickets and the Queue.

**My review (approved, no changes requested):** Specifically traced whether `statusGroup=active` is
actually applied as a `WHERE` filter on both list endpoints, not just parsed for the conflict check —
confirmed both build `{ currentStatus: { in: ACTIVE_STATUSES } }` from the same constant the
dashboard's own counts use, so a card's count and the list its link opens are guaranteed to agree
structurally. `byStatus` is correctly unfiltered (all 8 statuses, zeros included) while the
active-only figures are correctly filtered; the description truncation for My Open Actions lands at
exactly 120 characters; and the client's URL-param sync replaces history entries rather than pushing,
so Back isn't flooded.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab4-staging`.

### Final hardening and regression, [ShitheadQuin/Toktickit#71](https://github.com/ShitheadQuin/Toktickit/pull/71)

+954/-122 — new shared `ConfirmDialog` component, not-found page, and the focus-return-to-Add-Action
fix.

**My review (approved, no changes requested):** `ConfirmDialog` directly resolved the accessibility
gap noted on #68: focus starts on "Go back" (not the destructive action), Tab/Shift+Tab wrapping is
computed from the dialog's own button list each keypress, Escape maps to cancel, and the opener
regains focus on unmount — all verified against the component, not just the PR description. It's used
consistently at all three call sites Jeerasak listed in his #68 reply. The focus-return-to-Add-Action
fix is a real concurrency fix, not cosmetic: the old `setTimeout(..., 0)` raced against React's
re-render bringing the button back into the DOM; the replacement (a ref flag checked in a
dependency-less `useEffect`) correctly waits for the button to exist first.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab4-staging`.

## Reviews my partner gave on my PRs

Pull Requests I authored on `Chanat-888/TokTickIT` and Jeerasak reviewed, all targeting my
`lab4-staging`:

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#68](https://github.com/Chanat-888/TokTickIT/pull/68) | feature/lab4-specs -> lab4-staging | Changes requested (3 comments), fixed in `54897de`, approved, merged by reviewer |
| [#69](https://github.com/Chanat-888/TokTickIT/pull/69) | feature/lab4-actions-foundation -> lab4-staging | Changes requested (3 comments), fixed in `4879995`, approved, squash-merged by reviewer |
| [#70](https://github.com/Chanat-888/TokTickIT/pull/70) | feature/lab4-ticket-workflow -> lab4-staging | Changes requested (3 comments), fixed in `2503c88`, approved, merged by reviewer |
| [#71](https://github.com/Chanat-888/TokTickIT/pull/71) | feature/lab4-actions-ui -> lab4-staging | Changes requested (2 comments), fixed in `7d072ec`, approved, merged by reviewer |
| [#72](https://github.com/Chanat-888/TokTickIT/pull/72) | feature/lab4-dashboards -> lab4-staging | Changes requested (2 comments), fixed in `c00ba24`, approved, merged by reviewer |
| [#73](https://github.com/Chanat-888/TokTickIT/pull/73) | feature/lab4-hardening -> lab4-staging | Approved (non-blocking note), merged by reviewer |
| [#74](https://github.com/Chanat-888/TokTickIT/pull/74) | feature/lab4-reviewer -> lab4-staging | Approved (non-blocking note), fixed in `1803fdb`; follow-up comment asking for this file's two-section layout, fixed in `d983118`/`8dd6d74`/`d19c639`; approved, merged by reviewer |
| [#75](https://github.com/Chanat-888/TokTickIT/pull/75) | feature/lab4-ai-use -> lab4-staging | Changes requested (3 comments), fixed in `77907f2`, approved, merged by reviewer |
| [#76](https://github.com/Chanat-888/TokTickIT/pull/76) | feature/lab4-screenshots -> lab4-staging | Approved with no changes requested, merged by reviewer |
| [#77](https://github.com/Chanat-888/TokTickIT/pull/77) | lab4-staging -> main | Changes requested (fixed the #74/#76 gaps above), fixed in `e445b9c`, approved, merged by reviewer |
| [#79](https://github.com/Chanat-888/TokTickIT/pull/79) | feature/lab4-claim-race -> lab4-staging | Review pending |

### PR #68 — Sprint 4 engineering contract (Issue #61)

Docs-only PR: `specification.md`, `ui-spec.md`, `api-spec.md`, `CLAUDE.md`.

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. `specification.md` BR-14 said `Ticket.updatedAt` changes only on the Ticket's own fields, but lab-02 BR-39
   (attachment upload/removal) and the Requester's resolve-indication also change it, so a Requester upload
   could cause a staff 409.
   **Response:** BR-14 now names every write that bumps `updatedAt`; lab-02 BR-39 is left unchanged to avoid
   regressions and the extra 409 is documented as a recoverable false positive (§11.6). Added AC-17.
2. `api-spec.md` §2 checked `expectedUpdatedAt` then wrote later, so two requests could both pass the check;
   asked for one conditional `updateMany`.
   **Response:** accepted. All three Ticket write endpoints must use one atomic conditional write (BR-17,
   §11.15); the concurrency tests fire concurrent same-token pairs and expect exactly one 200 and one 409.
3. `CLAUDE.md` phase 4 said "resolution gate" (contradicts BR-16), and no phase created `tests.md`.
   **Response:** phase 4 renamed; `tests.md` moved into phase 1 and added to this PR.

**Approval (non-blocking note):** reviewer asked to reword §11.15 because the status endpoint checks only
the current status, not `updatedAt`. **Response:** reworded in the #62 branch.
Approved and merged into `lab4-staging` by the reviewer.

### PR #69 — Actions Taken foundation (Issue #62)

Migration, seed, validation, three endpoints, and the first Lab 4 tests.

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. `seed.ts`: spec §7 says seeded actions span assigned and unassigned Tickets, but unassigned Tickets always had
   zero actions and only one Ticket had several.
   **Response:** kept §7 and changed the seed: four unassigned Tickets get one triage action (staff may act without
   owning a Ticket, BR-08); the seed test asserts actions on owned and unowned Tickets.
2. `app.ts`: `idempotencyKey` must be a UUID, but api-spec §1 said `string` and listed no matching 400.
   **Response:** api-spec §1 now says UUID and lists the 400 case (same format as lab-02 BR-11).
3. The 2.8 MB course PDF (commit `d03f768`) should not be in a public repo, and belongs in its own docs PR.
   **Response:** untracked and gitignored (kept on the local disk only); the reviewer squash-merged so the PDF
   never appears in `lab4-staging` history. The CLAUDE.md rules stayed on this branch because the course guide
   keeps docs for in-progress work on the same feature branch.

Approved and squash-merged into `lab4-staging` by the reviewer.

### PR #70 — Ticket workflow (Issue #64)

Atomic stale-write protection (BR-17), status list filter (BR-27), the updatedAt fix, and the conflict banner.

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. BR-27 and api-spec §0.4 said a single status value behaves "exactly as before", but the Requester list now
   accepts `status=RESOLVED` (400 -> 200).
   **Response:** both now name that one exception.
2. AC-16 and the Definition of Done said Lab 1-3 tests pass "unmodified", but two Lab 2/3 tests were edited.
   **Response:** both now point at the two superseded contracts in §11.17.
3. Nothing proved that attachment *removal* changes `updatedAt`.
   **Response:** added a removal test (strictly increasing `updatedAt`, then a stale write gets 409).

**Approval note:** BR-27 cited "§11.16-17" but only §11.17 covers the status filter. **Response:** fixed in the
Actions Taken UI branch (#63) because #70 was already merged.

Approved and merged into `lab4-staging` by the reviewer.


### PR #71 — Actions Taken UI (Issue #63)

Ticket Detail Actions Taken list/create/inline-edit UI, Requester read-only view.

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. ui-spec §4.3 said the Create form sits above the list with a pencil icon for Edit and a paperclip icon for
   Attachment Notes; this PR rendered the form below the list and used text instead of icons, while also editing
   §4.3 to match the code.
   **Response:** fixed in the code, not the spec. The Create form now renders above the list, Edit shows a pencil
   icon (plus the visible word "Edit" and an aria-label, never icon-only), and Attachment Notes show a paperclip
   icon. STYLE-05 asserts the order and icons; ui-spec §4.3 records the icon-plus-text choice.
2. On a lost-response retry, a 200 (idempotent replay) returned the original row and cleared the form, silently
   discarding the user's edited text with no message.
   **Response:** the client now distinguishes 200 from 201 — on 200 the form keeps the text, the saved row shows
   in the list, and a notice reads "This action was already saved and is shown in the list. Your latest text was
   not applied; it is still in the form." The idempotency key also rotates so the next submit is a deliberate new
   action. UI-20 covers all three steps; ui-spec §4.3 documents the behaviour.

Approved and merged into `lab4-staging` by the reviewer.

### PR #72 — Role dashboards (Issue #65)

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. Lab 3 E2E-01 still waited for `/staff/tickets`, so it would time out now that every role lands on `/dashboard`; and the "two edited tests" wording in §11.17, AC-16 and the DoD no longer matched.
   **Response:** E2E-01 now waits for `/dashboard` and checks `.dashboard`; §11.17, AC-16 and the DoD now say four edited tests and name the two Playwright waits.
2. The Accounts card counts active users only, but its drill-down opened `/admin/users?role=<role>`, which lists inactive users too (BR-25: same condition as the metric).
   **Response:** the link is now `?role=<role>&isActive=true`. `GET /api/admin/users` accepts an optional `isActive` filter, User Management reads it and has an Account Status filter, and api-spec §3.1 and ui-spec §4.1 are updated.

Approved and merged into `lab4-staging` by the reviewer.

### PR #73 — Final hardening and regression (Issue #66)

Full Labs 1-3 regression pass, responsive/a11y checks, screenshots, README updates, `tests.md` final pass status.

**Reviewer decision:** Approved (non-blocking note only).

**Approval note:** the dashboard screenshots show tickets created by the e2e runs ("Lab 4 screenshot ticket",
"E2E-07…"); if the report needs clean data, re-take them on a fresh seed before the final PDF.
**Response:** non-blocking, so merged as-is; carried forward as a to-do for the submission PDF assembly step
(Issue #67).

Approved and merged into `lab4-staging` by the reviewer.

### PR #75 — ai-use.md (Issue #67)

Adds `docs/lab-04/ai-use.md`: 8 real prompts drawn from both Lab 4 Claude Code windows, verified against
their session transcripts.

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. The header named Claude and Claude Code but not the specific model, though the PR's commit trailer said
   Claude Sonnet 5.
   **Response:** confirmed both windows used Claude Sonnet 5 (checked the `Co-Authored-By` trailer on every
   Lab 4 commit) and named it explicitly in the header.
2. All 8 prompts covered the board/GitHub workflow; none covered the Sprint 4 spec work or the coding/test
   work, though the handout's Part 4 asks for a reflection on both the specification agent and the coding
   agent.
   **Response:** added a closing "My Reflection: Specification Agent and Coding Agent Use" section covering
   both.
3. Prompt 8 said the `§11.16-17` citation was one "only #70 fixed", but the actual fix landed on the #63
   branch after #70 had already merged.
   **Response:** reworded to say where the fix actually landed.

All three fixed in `77907f2`.

**My approval:** Approved and merged into `lab4-staging` by the reviewer (`e8d27c2`).

### PR #74 — reviewer.md finalization (Issue #67)

Fills gaps in this file itself: a missing PR #71 entry, PR #72's missing closing line, and the PR #73 entry.

**Reviewer decision:** Approved, one non-blocking note.

**Approval note:** the #71 section had no `**Reviewer decision:**` line, unlike #72 and #73.
**Response:** added in `1803fdb`.

**Follow-up comment (after approval):** asked this file to follow the same two-section layout as
`docs/lab-03/ai-use.md` — both "Reviews I gave on my partner's PRs" and "Reviews my partner gave on my
PRs" — since only the latter existed here; also noted the missing `**Reviewer decision:**` line was on
#68, #69 and #70 too, not only #71.
**Response:** added the "Reviews I gave on my partner's PRs" section in `d983118`, with a summary table
and a per-PR write-up for `ShitheadQuin/Toktickit#66`-`#71` (PR link, my actual review findings pulled
from the GitHub API, Jeerasak's real reply, and my approval), and demoted the existing per-PR headings to
nest under both sections consistently. Added the missing `**Reviewer decision:**` lines to #68-#70 in
`8dd6d74`. Added the #74 and #75 write-ups (this section and the one above) in `d19c639` once both PRs
were settled, per the reviewer's request.

Approved and merged into `lab4-staging` by the reviewer.

### PR #76 — re-take screenshots on a fresh seed (Issue #67)

Re-takes the dashboard/actions-taken/ticket-workflow screenshots flagged in PR #73's approval note: the
previous set showed leftover e2e-run tickets ("Lab 4 screenshot ticket", "E2E-07…") in the "Recently
Updated" lists. Ran `e2e/lab-04/responsive-visual.spec.ts` in isolation so the fresh reseed wasn't
polluted by ticket-creating specs from other spec files running first.

**Reviewer decision:** Approved, one non-blocking note.

**Approval note:** verified the new screenshots against the seed (By Status totals 30, Unassigned 22,
Accounts 4/3/1 all matched) and confirmed this closed the PR #73 note. Flagged that this file would need
a #76 entry before the release PR.
**Response:** this entry, added on the release PR (#77) after the reviewer flagged the gap there.

Approved and merged into `lab4-staging` by the reviewer.

### PR #77 — Release integration to main (Issue #67)

The single release PR merging `lab4-staging` into `main` at the end of the sprint (§11.1's
"exactly one release PR" requirement).

**Reviewer decision:** Changes requested — two gaps in this file (the #74 row/closing line
inconsistency, and the missing #76 row/section, both noted above).

**Response:** fixed in `e445b9c`.

**Approval note:** "Both fixed. This PR is exactly lab4-staging, main has no extra commits, and it
merges cleanly. After merge, please record the final test run from main in tests.md §6, and add this
PR (#77) to reviewer.md." Approved and merged into `main` by the reviewer.

**Post-merge follow-up:** ran the full suite against `main` per the approval note
(`server` 275/275, `client` 112/112, seed run twice — idempotent). Playwright initially came back
58/59: `e2e/lab-04/ticket-resolution.spec.ts` E2E-03 failed deterministically (3/3 runs on a fresh
seed each time). Traced it to a genuine race in `StaffTicketDetail.tsx` — Owner/IT-Priority/Status
all share `ticket.updatedAt` as their BR-17 concurrency token, but each control only disabled itself
during its own save, so a write in flight from one could invalidate the token the others were about
to send. Filed as [Issue #78](https://github.com/Chanat-888/TokTickIT/issues/78), fixed in
[PR #79](https://github.com/Chanat-888/TokTickIT/pull/79). Recorded the final `main` result in
`tests.md` §6.

### PR #79 — Fix Owner/IT-Priority/Status write race on shared updatedAt token (Issue #78)

Found while running the post-#77 full-suite pass against `main` (see above), not during normal
feature-branch development — hence its own Issue (#78) rather than reopening #67.

Gates all three controls on a shared `anyTicketWriteInFlight = ownerSaving || itPrioritySaving ||
statusSaving` instead of each checking only its own saving flag.

**Verification:** `client` typecheck clean; `e2e` Playwright 59/59 (was 58/59); `server`/`client`
suites unaffected (275/275, 112/112).

**Reviewer decision:** Review pending.
