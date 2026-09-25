# TokTickIT — Working Notes

CPE 334 (Software Engineering in the Age of AI Agents) course project. A
service-desk ticketing app built incrementally, one lab/sprint at a time.
Read this before starting work in a new session.

## MANDATORY: GitHub workflow — read `docs/GitHub_Workflow_Guide.pdf` first

Course-issued guide (Thai/English). The PDF lives locally in `docs/` but is
**gitignored, not committed** (public repo, course material); if it is
missing, ask the user for it. Read the whole PDF at session start before any
git/GitHub action. A previous session got these wrong; do not.

- **Linking a PR to its Issue = the Development panel, not a keyword.**
  `Closes #N` in the PR body does NOT link when the base is `lab4-staging`
  (non-default branch); GitHub treats it as a plain mention. Right after
  `gh pr create`, open the PR in the browser (Claude in Chrome), sidebar →
  Development → gear → pick the Issue. Verify the sidebar says
  "Successfully merging this pull request may close these issues" followed
  by the Issue. "None yet" = not linked. (No API/CLI for this; use the
  browser.) Still write `Closes #N` in the body for readability.
- **Every PR, right after creating it**: link Issue (above), request
  reviewer `ShitheadQuin`, assign PR and Issue to Chanat-888, label `lab-4`.
- **Project board** "TokTickIT Individual Sprints" (user project #1). Move
  the Issue's card EVERY time its state changes, no exceptions — do it in
  the same step as the triggering action, then tell the user:
  | Trigger | Move card to |
  |---|---|
  | Issue created | Backlog (auto) |
  | Requirements read and understood, before starting | Specified |
  | Feature branch created, work begins (only the Issue being worked) | Started |
  | PR opened AND linked via Development panel | PR Review |
  | Reviewer requests changes / tests fail; fixing on the same branch | Fixing |
  | Fixes pushed and replied on the threads | PR Review |
  | Reviewer merged (then close the Issue by hand) | Done |
  Command (run from the repo; issue number as $1, status name as $2):
  ```
  move_card() {
    local item opt
    item=$(gh project item-list 1 --owner Chanat-888 --limit 100 --format json --jq ".items[]|select(.content.number==$1)|.id")
    case "$2" in Backlog) opt=f75ad846;; Specified) opt=47fc9ee4;; Started) opt=98236657;;
      "PR Review") opt=db21eb3e;; Fixing) opt=fb21ca19;; Done) opt=9066ddcf;; esac
    gh project item-edit --id "$item" --project-id PVT_kwHOCwvtGc4BfkxK       --field-id PVTSSF_lAHOCwvtGc4BfkxKzhZ2tUY --single-select-option-id "$opt"
  }
  ```
  The project auto-adds new Issues to Backlog and moves closed ones to
  Done. Verify a move with `gh project item-list 1 --owner Chanat-888
  --format json` if unsure.
- **After the reviewer merges into `lab4-staging`**: close the Issue by
  hand (merge into a non-default branch doesn't close it) and make sure the
  card is Done.
- **Reviewer merges, never the author/agent.** After approval, the REVIEWER
  clicks "Merge pull request". Do not merge PRs.
- **Author duties**: reply to every review comment (what changed, or why
  not); push fixes to the same branch (PR updates itself, no new PR);
  resolve a conversation only after replying and actually fixing; never
  accept an approval and merge silently.
- **Docs-only work**: if the Issue's code is still in progress, put docs on
  the same feature branch/PR. If code is already merged, use a branch named
  `docs/<lab>-<topic>` (e.g. `docs/lab4-ai-use`) with its own PR, linked to
  its Issue, or say "no Issue" in one line in the PR description. Even tiny
  edits get a branch + PR; never push docs straight to `lab4-staging`.

## Current lab: Lab 4

Handout: `../SE+Lab+4.pdf` (one level up, in `D:\SoftwareEng`).

Lab 4 adds Actions Taken (child records under a Ticket), hardens the Ticket
status-transition/resolution rules, adds role dashboards (Requester, IT
Staff/Admin), and does final regression + polish across Labs 1–3.

Deliverables go in `docs/lab-04/` (`specification.md`, `ui-spec.md`,
`api-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md`), with test suites in
`server/tests/lab-04/`, `client/.../lab-04`, `e2e/lab-04/`, and screenshots
in `artifacts/lab-04/screenshots/`. Spec DD must exist **before** the
implementation PRs — the submission requires evidence of that ordering.

## Stack and layout

- `server/` — API, `server/prisma/schema.prisma` is the DB schema.
- `client/` — frontend (Zen Green design language, established Lab 2,
  extended Lab 3).
- `docs/lab-01/`, `docs/lab-02/`, `docs/lab-03/` — prior sprints' specs,
  read these first when a Lab 4 rule needs precedent.
- `e2e/`, `server/tests/`, `client/.../tests` — test suites per lab.

## Conventions already established (Lab 3) — extend, don't redefine

- **Auth**: session cookie (`sid`), not headers. Every endpoint except
  `/auth/login` requires a valid, non-expired, active-user session.
- **Error shapes**: `400` → `{ errors: [{ field, message }] }`; `401/403/
  404/409/500` → `{ error: string }`. See `docs/lab-03/api-spec.md` §0.
- **BR/FR/AC numbering restarts at 01 per lab** (Lab 4's spec has its own
  BR-01, not continuing Lab 3's count); cross-reference other labs' rules
  by full path (e.g. "lab-03 BR-19") when a Lab 4 rule depends on them.
- **Status transition matrix** (`docs/lab-03/specification.md` §5) already
  covers all 8 statuses; Lab 4 refines/documents it, doesn't redesign it
  unless the contract requires a change.
- **Branch flow** (Lab 2 §10.1 / Lab 3 §11.1, verbatim requirement — not
  just inferred from history): create `lab4-staging` off `main` now. Every
  GitHub Issue gets its own `feature/lab4-*` branch, cut from
  `lab4-staging`, entering `lab4-staging` via a peer-reviewed PR. Exactly
  **one** release PR merges `lab4-staging` → `main` at the end of the
  sprint. Never commit directly to `main` or `lab4-staging`.
- PR review is logged live in `docs/lab-04/reviewer.md` as PRs happen (not
  reconstructed after) — reviewer identity, PR links, comments given/
  received, responses, approvals.
- Prisma `Ticket.updatedAt` already exists and is the natural basis for the
  optimistic-concurrency / stale-update check Lab 4 requires — reuse it
  rather than adding a new version column unless the contract says
  otherwise.

## Plan (phases / GitHub Issues)

1. `feature/lab4-specs` — Spec DD + Test DD (`specification.md`,
   `ui-spec.md`, `api-spec.md`, `tests.md` planned table). Must land
   first; phase 6 only updates `tests.md` Final column/results.
2. `feature/lab4-actions-foundation` — Prisma migration + seed for
   `ActionTaken`, backend CRUD + authorization, API tests.
3. `feature/lab4-actions-ui` — Ticket Detail Actions Taken list/create/
   edit UI, component tests.
4. `feature/lab4-ticket-workflow` — confirmed transition matrix + atomic
   `expectedUpdatedAt` conflict handling on status/owner/it-priority (no
   resolution gate, per BR-16), workflow tests.
5. `feature/lab4-dashboards` — Requester + IT Staff dashboard API + UI,
   dashboard tests.
6. `feature/lab4-hardening` — full Labs 1–3 regression pass, a11y/
   responsive checklist, screenshots, README updates, `tests.md` final
   pass status.
7. `feature/lab4-reviewer`, `feature/lab4-ai-use` — `reviewer.md`,
   `ai-use.md`.

## Decisions already made for Lab 4

These were resolved in `specification.md` §11 — read that, not this list:
Resolved needs no Action Taken (BR-16), any active staff may edit (BR-10),
dashboard metrics fixed in BR-20/21, concurrency reuses `Ticket.updatedAt`
via an atomic conditional write (BR-17, §11.15).

## Submission format

One PDF, headings "Answer Part 1" through "Answer Part 9" in that exact
order (see handout §14 for the point breakdown per part).
