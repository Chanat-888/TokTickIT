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
