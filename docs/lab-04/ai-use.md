# Lab 4 — AI Use

**LLM / agent used:** Claude (Anthropic), via Claude Code (terminal agent)
for file edits, running tests, browser-driven UI checks, and git/GitHub
operations. Lab 4 ran as two long-lived Claude Code windows in
`D:\SoftwareEng` — one that carried the sprint from the engineering
contract (#61) through Ticket workflow (#64), and a second that picked up
from Actions Taken UI (#63) through the release prep (#66/#67). Prompts
below are drawn from both windows, verified against their transcripts, not
reconstructed from memory.

---

## Prompt 1

**Actual Prompt Text:**
> add move issue to pr review when ever you open pr and for other thing
> like start, fixing, specified too

**What the agent did:** Turned board-card discipline into a hard rule
instead of something done ad hoc. Added a trigger table to `CLAUDE.md`
(Requirements read → Specified, Branch created → Started, PR opened and
linked → PR Review, Changes requested → Fixing, Fixes pushed → PR Review,
Reviewer merged → Done) and wrote the `move_card` shell function that
looks up a project item by issue number and sets its status field by ID,
then ran it immediately on Issue #62 to prove it worked.

**My Reflection:**
This is the rule that made the rest of the sprint's board tracking
consistent — before this, card moves were something I had to remember to
ask for. Turning it into a table plus a runnable command in `CLAUDE.md`
meant every later session (including this one) just follows it without
being told again.

---

## Prompt 2

**Actual Prompt Text:**
> check pr and fix

**What the agent did:** Read the three review comments on PR #69
(Actions Taken foundation) via the GitHub API, moved card #62 to Fixing,
fixed all three (a seed-data gap versus spec §7, an untyped
`idempotencyKey`, and a 2.8 MB course PDF that had been committed by
mistake), pushed the fixes as `4879995`, replied on every thread, and
re-requested review — moving the card back to PR Review only after that.

**My Reflection:**
A three-word prompt was enough because the workflow rules were already
written down — the agent knew to move the card, fix every comment (not
just the code ones), and reply before re-requesting review, without me
spelling out each step again.

---

## Prompt 3

**Actual Prompt Text:**
> stop first i thought 69 is merged wait until it merge and i say so

**What the agent did:** Had already created the `feature/lab4-ticket-workflow`
branch, moved card #64 to Started, and posted a "Started" comment on
Issue #64 — all before confirming PR #69 had actually merged. Stopped
immediately, reported exactly which three things it had done and that
none touched code yet, and asked whether to roll them back or leave them
in place until the merge was confirmed, rather than guessing.

**My Reflection:**
I caught this because the agent moved ahead of an actual merge
confirmation, and I liked that it didn't get defensive or try to justify
it — it just listed precisely what state existed and let me decide.
Waiting for an explicit "continue" before touching #64 again was the
right call.

---

## Prompt 4

**Actual Prompt Text:**
> if he merge now pdf will merge too right?

**What the agent did:** Explained the actual git mechanics rather than
giving a yes/no: the PDF-add commit and the PDF-remove commit were both
on the branch, so a normal merge leaves no PDF in the working tree of
`lab4-staging`, but the PDF stays reachable in history either way unless
the branch is squash-merged or history is rewritten. Laid out three real
options (leave it, ask for a squash merge, or force-push to rewrite
history) with the trade-offs of each, and left the choice to the user
instead of picking one.

**My Reflection:**
This is the kind of question I ask because I don't fully trust my own
mental model of git merges, and getting the actual mechanics explained
(not just reassurance) let me make an informed call — squash-merge,
which is what the reviewer ended up doing.

---

## Prompt 5

**Actual Prompt Text:**
> we do 64 before 63?

**What the agent did:** Owned that it had switched the plan's stated
order (#62, #63, #64, #65 in `CLAUDE.md`) to #62, #64, #63 without
flagging the change first. Explained the actual dependency (#63 needs
#62's API, which was already merged; #64 is mostly backend and only
needs #62), named the real risk (both issues touch
`StaffTicketDetail.tsx` and `client/src/api.ts`, so starting #63 before
#64 merges risks a conflict), and offered two concrete options instead of
just proceeding.

**My Reflection:**
I want to know when the agent deviates from an agreed plan, even for a
sensible reason — this answer told me both what changed and why, which
let me approve continuing rather than discovering it later from the PR
history.

---

## Prompt 6

**Actual Prompt Text:**
> oh yeah and you forgot to link pr with issue, how to make this not
> happen?

**What the agent did:** Diagnosed the two actual causes (the Chrome
extension used for the Development-panel link had dropped, and the card
had already been moved to PR Review before the link existed) instead of
just apologizing, then built a check that can't be silently skipped:
`pr_linked <pr#>`, a GraphQL query against the PR's `CONNECTED_EVENT`
timeline that must print the issue number before the card can move.
Wrote both the new gate and the failure mode into `CLAUDE.md` and pushed
it as a commit on the open PR's branch.

**My Reflection:**
This turned one missed step into a rule that checks itself instead of
relying on the agent remembering — it's the single most useful outcome
of the whole sprint's workflow tooling, and every PR from #70 onward
actually got linked because of it.

---

## Prompt 7

**Actual Prompt Text:**
> you can assign pr detail with code? i done it before in terminal

**What the agent did:** Took the hint seriously and searched for a
GraphQL mutation that does what the Development-panel gear does, found
`addCloseIssueReferences`, worked out its actual input shape (one
`issueId`, a list of `pullRequestIds`) by trial, and used it to link PR
#70 to Issue #64 — then verified with `pr_linked 70`, which printed
`[64]`. Replaced the browser-dependent linking step in `CLAUDE.md` with
the `link_pr`/`pr_linked` shell functions used for the rest of the
sprint.

**My Reflection:**
I remembered doing this by hand once before and suspected it wasn't
Chrome-extension-only; pointing that out saved the workflow from
depending on a flaky browser connection for the rest of the sprint. Every
PR after this one linked cleanly and automatically.

---

## Prompt 8

**Actual Prompt Text:**
> did you reply when revier comment?

**What the agent did:** Checked all three merged PRs (#68, #69, #70) and
found that inline review comments had been answered, but the reviewer's
separate approval notes had been left unanswered. Replied to all three
approval notes immediately, named the still-open item from the #70 note
(a `§11.16-17` citation that only #70 fixed), and stated the rule going
forward: an approval note is still a review comment, and silence under it
doesn't count as a reply.

**My Reflection:**
Easy thing to miss because an "Approved" verdict feels like the
conversation is over, but the course guide grades on replying to every
comment, approval notes included. Asking caught a real gap before it
became a pattern.
