# TokTickIT — Working Notes

CPE 334 (Software Engineering in the Age of AI Agents) course project. A
service-desk ticketing app built incrementally, one lab/sprint at a time.
Read this before starting work in a new session.

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
- **Issue ↔ PR linking**: every PR description must reference the GitHub
  Issue it closes (`Closes #N` / `Fixes #N`), so the Issue auto-closes on
  merge and the link is traceable both directions — required for Part 1
  grading evidence (Kanban + linked PRs).
- **Every PR checklist** (do all, every time, right after `gh pr create`):
  request a reviewer (`gh pr edit N --add-reviewer ShitheadQuin`), assign
  the PR and its Issue to Chanat-888, and comment on the Issue linking the
  PR. `Closes #N` does NOT auto-link when the base is `lab4-staging`
  (non-default branch), so close the Issue manually after the reviewer
  merges. Only the final `lab4-staging` → `main` PR auto-closes via keyword.
- **Who merges**: the agent opens PRs but never clicks merge — merging is
  the reviewer's action, not the author's/agent's, matching normal
  author-doesn't-merge-own-PR practice. Wait for reviewer approval and let
  them merge (or explicit instruction to merge on their behalf after
  approval is recorded).
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
