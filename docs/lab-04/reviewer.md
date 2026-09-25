# Peer Review: Lab 4

**Author:** Chanat Dachkumhang (GitHub: @Chanat-888)
**Reviewer:** Jeerasak Phisawong (GitHub: @ShitheadQuin)

Updated as PRs are opened, reviewed and merged during the sprint, not reconstructed at the end.
Per the course workflow guide, the reviewer merges each approved PR; the author replies to every comment.

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#68](https://github.com/Chanat-888/TokTickIT/pull/68) | feature/lab4-specs -> lab4-staging | Changes requested (3 comments), fixed in `54897de`, approved, merged by reviewer |
| [#69](https://github.com/Chanat-888/TokTickIT/pull/69) | feature/lab4-actions-foundation -> lab4-staging | Changes requested (3 comments), fixed in `4879995`, approved, squash-merged by reviewer |

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
