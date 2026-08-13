# Lab 1 — Peer Review Record

**Author:** Chanat Dachkumhang — 67070503409 — GitHub: @Chanat-888
**Peer reviewer:** Jeerasak Phisawong — 67070503461 — GitHub: @ShitheadQuin

Repository under review (mine): https://github.com/Chanat-888/TokTickIT
Repository I reviewed (partner's): https://github.com/ShitheadQuin/Toktickit

---

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Base | Reviewer verdict |
|----|--------|------|------------------|
| [#5](https://github.com/Chanat-888/TokTickIT/pull/5) | feature/1-project-foundation | lab1-staging | Approved, after two inline comments and a fix commit |
| [#6](https://github.com/Chanat-888/TokTickIT/pull/6) | feature/2-health-check | lab1-staging | Approved, after two inline comments and a fix commit |
| [#7](https://github.com/Chanat-888/TokTickIT/pull/7) | feature/3-category-seed | main *(mis-targeted — see note)* | Approved |
| [#8](https://github.com/Chanat-888/TokTickIT/pull/8) | feature/3-category-seed | lab1-staging | Approved |
| [#9](https://github.com/Chanat-888/TokTickIT/pull/9) | feature/4-category-list | lab1-staging | Approved |
| [#10](https://github.com/Chanat-888/TokTickIT/pull/10) | lab1-staging *(Lab 1 release)* | main | Approved |

**Note on #7 and #8.** PR #7 was opened against `main` by mistake — GitHub
defaults the base branch to the repository default and I did not change it. It
was reviewed and merged before I noticed. I deliberately did not revert it: a
revert commit does not remove commits from a branch's ancestry, it only undoes
their effect, so the later release PR would have treated Issue 3 as already
merged, skipped re-applying it, and left `main` without the `Category` model
and with failing tests — with nothing in the diff to explain why. Instead I
opened PR #8 re-targeting the same commits onto `lab1-staging`. Both branches
now share those commits, so the release PR diffs cleanly to Issues 2 and 4.

### Reviewer comment I received

On PR #5, against `server/.env.example`, Jeerasak flagged a setup gap:

> "This connects using the toktickit role, but the README only shows how to
> create the toktickit database. Where is the toktickit role created? It seems
> like the README might be missing a CREATE ROLE step for anyone setting this up
> from scratch."

### How I responded

He was right — the README created the database but never created the
`toktickit` role that `.env.example` connects as, so a clean setup would have
failed on authentication. I fixed it in commit `18bd928`: added `CREATE ROLE`
before `CREATE DATABASE`, plus a note for anyone reusing an existing role.
Tracing it also surfaced a second gap he hadn't asked about — the README never
mentioned copying `client/.env.example` to `client/.env` — so I added that step
in the same commit.

He left a second inline comment on `client/src/App.tsx` confirming Bootstrap was
not merely installed but actually wired in and used (`container`, `btn
btn-success`). That one needed no action.

### A second cycle, on PR #6

He left two inline comments. On `client/src/api.ts` he asked whether the UI
would ever leave the loading state if the backend hung rather than refusing the
connection outright. It would not: `fetch` has no default timeout, and my
offline test had not caught it because a stopped server refuses immediately. I
added `AbortSignal.timeout(5000)` in commit `d80743c`, which surfaces through
the same `catch` as the Offline message, and replied on the thread explaining
why the original test missed it.

His second comment, on `client/src/App.tsx`, endorsed keeping the error message
generic rather than rendering the raw fetch error. I replied that the specific
error stays in the thrown `Error` while the UI shows the generic text, so
nothing internal leaks. He approved after both replies and I merged `f25aa38`.

---

## Pull Requests I reviewed for my partner

Partner's repository: https://github.com/ShitheadQuin/Toktickit

| PR | What I found | Verdict | His response |
|----|--------------|---------|--------------|
| [#5](https://github.com/ShitheadQuin/Toktickit/pull/5) | `Closes#1` written without a space, so GitHub linked no issue; `.env` rule missing from `client/.gitignore`; stock Vite README left in place | Approved, then re-approved after his fix commit | Fixed both files, merged `7b22fbd` |
| [#6](https://github.com/ShitheadQuin/Toktickit/pull/6) | No timeout on `fetch('/api/health')` — a hung backend leaves the UI on "Loading…" instead of reaching the error state | Approved | Added `AbortSignal.timeout(5000)` in `60a6952` |
| [#7](https://github.com/ShitheadQuin/Toktickit/pull/7) | Queried a missing seed command in `package.json`, then withdrew it — the seed resolves through `prisma.config.ts`'s `migrations.seed` under the Prisma 7 convention, so the documented `npx prisma db seed` works | Approved | Merged `933514b` |

The PR #6 finding is the same defect Jeerasak raised on my own PR #6, found
independently in both directions on the same day.

The full comment → fix → re-review cycle is documented below, using PR #5.

### My comment

I reviewed the full diff and confirmed the scaffold was sound: Bootstrap
imported in `main.tsx`, Vitest wired through `"test": "vitest run"`, both
`client/tests/lab-01/` and `server/tests/lab-01/` present, and `.env.example`
committed with no real `.env` leaked.

The substantive finding was outside the code. The PR body read `Closes#1`
without a space, so GitHub was not parsing it as a closing keyword — the
Development sidebar showed no linked issue, which meant merging the PR would
not have closed Issue #1 or moved the board card. I asked him to change it to
`Closes #1`. I also left two minor inline comments, on `client/.gitignore`
(missing a `.env` rule) and `client/README.md` (still the stock Vite starter
text).

### Partner's response

He pushed a fix commit adding the `.env` rule to `client/.gitignore` and
removing the stock Vite README. I re-reviewed after that commit, confirmed both
were resolved, and approved a second time. He then added the PR to his
*TokTickIT Individual Sprints* board, moved it to PR Review, and merged commit
`7b22fbd` into `lab1-staging`.

This was a full comment → fix → re-review cycle rather than a single pass.

### Withdrawing my own finding on PR #7

On PR #7 I first flagged that `server/package.json` had no seed command, which
would have made the README's seed step unrunnable. Checking `prisma.config.ts`
before he replied showed I was wrong: under the Prisma 7 convention the seed
resolves through `migrations.seed` there rather than through `package.json`. I
withdrew the comment in my review, stated why, and approved.
