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


## PR #72 — Role dashboards (Issue #65)

**Reviewer decision:** Changes requested.

**Comments received and responses**

1. Lab 3 E2E-01 still waited for `/staff/tickets`, so it would time out now that every role lands on `/dashboard`; and the "two edited tests" wording in §11.17, AC-16 and the DoD no longer matched.
   **Response:** E2E-01 now waits for `/dashboard` and checks `.dashboard`; §11.17, AC-16 and the DoD now say four edited tests and name the two Playwright waits.
2. The Accounts card counts active users only, but its drill-down opened `/admin/users?role=<role>`, which lists inactive users too (BR-25: same condition as the metric).
   **Response:** the link is now `?role=<role>&isActive=true`. `GET /api/admin/users` accepts an optional `isActive` filter, User Management reads it and has an Account Status filter, and api-spec §3.1 and ui-spec §4.1 are updated.
