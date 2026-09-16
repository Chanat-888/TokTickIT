# Lab 3 — AI Use

**LLM / agent used:** Claude (Anthropic), via Claude Code (terminal agent)
for file edits, running tests, and git/GitHub operations. Unlike Lab 2,
Lab 3 regularly ran multiple Claude Code windows concurrently against the
same repo — one doing feature work, sometimes another reviewing PRs on
Snooker's behalf (tracked separately in `docs/lab-03/reviewer.md`, not
this file). Handoff documents (written to the OS temp directory, not the
repo) were the mechanism for passing an in-progress session to a fresh
window; several prompts below are moments from that handoff/pickup cycle
or from reconciling two windows' concurrent state.

---

## Prompt 1

**Actual Prompt Text:**
> before do work. I want to move to new claude code window, can you make
> md to tell how to work how to use tool and what we need to do and what
> we cant? I will paste it in claude code new window and continue work

**What the agent did:** At the end of Phase 4 (PR #49 open with 3
unresolved review comments), invoked the `handoff` skill and wrote a
process-focused handoff document to the OS temp directory — PR #49's
specific open review comments and the fix each needed, the project's
non-obvious GitHub/PR mechanics (manual issue-linking, inconsistent
auto-close), environment gotchas, and the remaining phase roadmap,
without duplicating what was already in `lab3_plan.md` or the merged
spec docs.

**My Reflection:**
Asking for a handoff doc before switching windows worked really well. The agent captured the important context—like the open PR comments, workflow gotchas, and next steps—without just repeating the main plan, making it easy to jump straight back into the work in a fresh session.

---

## Prompt 2

**Actual Prompt Text:**
> is github link tools working right now?

**What the agent did:** In the fresh window started from Prompt 1's
handoff doc, verified `gh` was authenticated and could reach the repo,
then noticed from file-change notifications that a *different* concurrent
window had already implemented and pushed all three of PR #49's review
fixes. Rather than duplicating that work, confirmed the push had actually
landed and deferred the rest of that PR to the other window.

**My Reflection:**
Checking the tooling first helped catch overlapping work before any conflicts happened. The agent verified GitHub access, saw the other window had already pushed the fixes, and avoided duplicating effort instead of blindly redoing the task.

---

## Prompt 3

**Actual Prompt Text:**
> this happen how to fix? is the problem is about you using tool and
> another window cant use?

**What the agent did:** A GitHub operation (posting review replies and
resolving threads on a PR) appeared to fail. Explained that Claude Code
windows each authenticate independently with `gh`/GraphQL — there's no
shared lock that would make one window's GitHub access work and
another's not — checked githubstatus.com, then re-ran the same
reply/resolve operations, which succeeded cleanly, confirming it had been
a transient GitHub-side hiccup rather than a cross-window conflict.

**My Reflection:**
Instead of jumping to wrong conclusions about tool locks between windows, the agent explained how authentication actually works and verified external service status. Simply retrying after ruling out multi-window conflicts resolved it, proving it was just a temporary GitHub glitch.

---

## Prompt 4

**Actual Prompt Text:**
> bro isnt we cant merge??

**What the agent did:** After pushing a fix to a PR, GitHub's merge
button showed a pending/unclear state. Checked the PR's actual
mergeability via the GraphQL API, found it was `UNKNOWN` — GitHub still
computing it after a fresh push, not an actual block — and confirmed no
CI checks were configured that could fail it. Reiterated that no merge
had been performed, per the standing "only Snooker merges" rule.

**My Reflection:**
I panicked a bit thinking the PR was stuck or merged when it shouldn't be, but the agent checked the API directly and explained that GitHub was just still processing the state. It also respected our workflow constraint by confirming nothing was merged without permission.

---

## Prompt 5

**Actual Prompt Text:**
> i need to link pr with #50 right?

**What the agent did:** PR #50's body already contained `Closes #39`, but
GitHub's "Development" sidebar widget showed no link. Inspected the page
DOM directly (rather than guessing from accessibility refs) and found the
repo simply doesn't have that linking UI enabled at all — not a
permissions issue, a missing feature for this repo. Confirmed the
`Closes #39` text was already creating a real GitHub cross-reference
(visible on the issue's own timeline) and that this would auto-close the
issue on merge, matching the pattern already observed on an earlier
merged PR.

**My Reflection:**
The agent checked the DOM and timeline directly instead of trusting the missing UI widget, confirming Closes #39 was already working properly so I didn't waste time fixing a non-issue.

---

## Prompt 6

**Actual Prompt Text:**
> make handoff and i will start next isuue in next window

**What the agent did:** At the end of Phase 9 (PR #54 merged, issue #43
auto-closed), invoked the `handoff` skill again and wrote an updated
handoff — Phases 1–9 done, Phase 10 (issues #44/#45) next, plus a still-
open background follow-up (a Lab 2 e2e regression caused by the
Requester Selector's removal) that hadn't been picked up yet — to the
same temp path for the next window.

**My Reflection:**
Clean, seamless handoff. The agent accurately summarized completed work, lined up the next phase's issues, and made sure an unassigned background regression wasn't forgotten before moving to the next window.

---

## Prompt 7

**Actual Prompt Text:**
> lets go to last issue

**What the agent did:** In the session started from Prompt 6's handoff,
after issue #44 (screenshots) was already merged, synced repository state
and confirmed issue #45 (release to `main`) was the only one left. Before
starting release work, surfaced a Definition-of-Done gap flagged in the
handoff — the Lab 2 e2e regression was still unfixed — confirmed it was
real by checking the actual client source (the old selector's CSS class
now belongs to Logout; the route it pointed to no longer exists at all),
asked how to handle one ambiguous case (a screenshot test for a screen
that had been removed outright), then fixed and verified all 21 affected
tests before continuing toward the release PR.

**My Reflection:**
Rather than rushing the final release, the agent proactively caught the unresolved Lab 2 regression from the handoff, checked the actual code changes, and resolved all 21 broken tests before moving ahead with the release PR.

---

## Prompt 8

**Actual Prompt Text:**
> it no linkj with issue

**What the agent did:** After opening the Lab 2 e2e fix as its own PR,
pointed out it had no linked issue. Confirmed this was actually correct —
the fix wasn't scoped to its own tracked GitHub issue, it was prep work
for issue #45's release — and added a "Part of #45" prose comment on the
PR instead of a closing link, matching the project's own documented
convention for when an issue's scope spans multiple PRs.

**My Reflection:**
Followed linking conventions accurately. Since this was prep work for release issue #45, the agent correctly used "Part of #45" rather than an auto-closing link.
