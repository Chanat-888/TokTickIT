# Peer Review: Lab 4

**Author:** Chanat Dachkumhang (GitHub: @Chanat-888)
**Reviewer:** Jeerasak Phisawong (GitHub: @ShitheadQuin)

Updated as PRs are opened, reviewed and merged during the sprint, not reconstructed at the end.
Per the course workflow guide, the reviewer merges each approved PR; the author replies to every comment.

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#68](https://github.com/Chanat-888/TokTickIT/pull/68) | feature/lab4-specs -> lab4-staging | Changes requested (3 comments), fixed in `54897de`, approved, merged by reviewer |
| [#69](https://github.com/Chanat-888/TokTickIT/pull/69) | feature/lab4-actions-foundation -> lab4-staging | Changes requested (3 comments), fixed in `4879995`, approved, squash-merged by reviewer |
| [#70](https://github.com/Chanat-888/TokTickIT/pull/70) | feature/lab4-ticket-workflow -> lab4-staging | Changes requested (3 comments), fixed in `2503c88`, approved, merged by reviewer |
| [#71](https://github.com/Chanat-888/TokTickIT/pull/71) | feature/lab4-actions-ui -> lab4-staging | Changes requested (2 comments), fixed in `7d072ec`, approved, merged by reviewer |
| [#72](https://github.com/Chanat-888/TokTickIT/pull/72) | feature/lab4-dashboards -> lab4-staging | Changes requested (2 comments), fixed in `c00ba24`, approved, merged by reviewer |
| [#73](https://github.com/Chanat-888/TokTickIT/pull/73) | feature/lab4-hardening -> lab4-staging | Approved (non-blocking note), merged by reviewer |

## PR #68 — Sprint 4 engineering contract (Issue #61)

Docs-only PR: `specification.md`, `ui-spec.md`, `api-spec.md`, `CLAUDE.md`.

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

## PR #69 — Actions Taken foundation (Issue #62)

Migration, seed, validation, three endpoints, and the first Lab 4 tests.

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

## PR #70 — Ticket workflow (Issue #64)

Atomic stale-write protection (BR-17), status list filter (BR-27), the updatedAt fix, and the conflict banner.

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


## PR #71 — Actions Taken UI (Issue #63)

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

## PR #72 — Role dashboards (Issue #65)

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. Lab 3 E2E-01 still waited for `/staff/tickets`, so it would time out now that every role lands on `/dashboard`; and the "two edited tests" wording in §11.17, AC-16 and the DoD no longer matched.
   **Response:** E2E-01 now waits for `/dashboard` and checks `.dashboard`; §11.17, AC-16 and the DoD now say four edited tests and name the two Playwright waits.
2. The Accounts card counts active users only, but its drill-down opened `/admin/users?role=<role>`, which lists inactive users too (BR-25: same condition as the metric).
   **Response:** the link is now `?role=<role>&isActive=true`. `GET /api/admin/users` accepts an optional `isActive` filter, User Management reads it and has an Account Status filter, and api-spec §3.1 and ui-spec §4.1 are updated.

Approved and merged into `lab4-staging` by the reviewer.

## PR #73 — Final hardening and regression (Issue #66)

Full Labs 1-3 regression pass, responsive/a11y checks, screenshots, README updates, `tests.md` final pass status.

**Reviewer decision:** Approved (non-blocking note only).

**Approval note:** the dashboard screenshots show tickets created by the e2e runs ("Lab 4 screenshot ticket",
"E2E-07…"); if the report needs clean data, re-take them on a fresh seed before the final PDF.
**Response:** non-blocking, so merged as-is; carried forward as a to-do for the submission PDF assembly step
(Issue #67).

Approved and merged into `lab4-staging` by the reviewer.
