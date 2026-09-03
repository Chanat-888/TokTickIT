# Lab 2 — AI Use

**LLM / agent used:** Claude (Anthropic), via the claude.ai web interface,
plus Claude Code (terminal agent) for actual file edits, running tests, and
git operations. Claude in this chat planned each Issue and verified
Claude Code's work directly via the filesystem MCP tool before any commit;
Claude Code wrote code and ran commands but never committed or created
branches — I did both by hand every time.

---

## Prompt 1

**Actual Prompt Text:**
> Create the nine Issues on GitHub. Label lab-2, assign Pan, project
> "TokTickIT Individual Sprints", leave in Backlog. Each description
> lists the FR and AC numbers it covers plus its dependency.

**What the agent did:** Wrote a Claude Code prompt that first verified
`gh` auth and label/project state before creating anything, wrote all
nine Issue bodies to files outside the repo, then created Issues
#15–#23 with the labsheet's exact template (Scope/Covers/Dependency/Done
when). Read all nine body files back from disk afterward to verify them
before Issue #15's branch was started.

**My Reflection:**
Pre-verifying the template files against the lab sheet caught potential scope errors before creating the branches.
---

## Prompt 2

**Actual Prompt Text:**
> is this correct?

**What the agent did:** Confirmed PR #25's reviewer, assignee, label,
and Development link were all correctly set, and flagged that Issue #16
still needed to be moved to PR Review on the project board manually,
since only the Issue — not the PR — belongs on the board.

**My Reflection:**
Good reminder that automated PR linking doesn't auto-update the issue's board column, you still have to manage board states deliberately.

---

## Prompt 3

**Actual Prompt Text:**
> why it look like this

**What the agent did:** Explained that adding a PR itself to the project
board (rather than just its linked Issue) created a duplicate card in a
different column, and gave the exact steps to remove the stray PR card
while leaving the Issue card in place.

**My Reflection:**
A quick reminder that linking a PR to an Issue is enough, manually adding the PR card itself just desyncs the board.

---

## Prompt 4

**Actual Prompt Text:**
> project do we need to add it?

**What the agent did:** Said no — the board tracks Issues only, and the
Issue card already shows a link to the PR, so adding the PR itself would
just recreate the duplicate-card problem from Prompt 3.

**My Reflection:**
Confirmed that PRs stay off the project board entirely—the linked Issue card already surfaces the PR state without duplicating items.

---

## Prompt 5

**Actual Prompt Text:**
> Implement Issue #18: Create Ticket.
> [...] This is a large Issue, including a real sequencing gap: TASK 4
> builds POST /api/tickets/:id/attachments here rather than in Issue
> #21, because ui-spec.md §7 and BR-20 require Create Ticket to upload
> attachments as a second call after Ticket creation, and that endpoint
> didn't exist yet under the original Issue split.

**What the agent did:** Read api-spec.md, ui-spec.md, and tests.md
before writing anything, flagged that Issue #18 could not work without
an endpoint originally scoped to Issue #21, and moved that endpoint
forward instead of building Create Ticket in a way that couldn't
function yet. Verified every server route and client screen directly on
disk after Claude Code's implementation, and corrected Issue #21's own
body afterward so its scope stayed accurate.

**My Reflection:**
Checking the UI spec against API requirements before coding exposed a missing endpoint early, avoiding a messy rewrite mid-implementation.

---

## Prompt 6

**Actual Prompt Text:**
> [Uploaded a screenshot of ShitheadQuin's review comment on PR #27,
> no additional text — the comment read: "There's no limits.fileSize
> set here, so a file bigger than 5MB gets fully loaded into memory
> before the manual size check runs. Would it be worth adding a higher
> fileSize limit in multer too, so oversized files get rejected before
> using too much memory?"]

**What the agent did:** Agreed the concern was valid, wrote a prompt
adding a coarse 20MB multer-level limit (well above the real 5MB
business rule) so an oversized upload is rejected before being fully
buffered into memory, then re-read the changed route on disk to confirm
the 5MB business check and the 20MB multer guard didn't conflict before
the fix was committed.

**My Reflection:**
Learned to protect server memory at the middleware level instead of relying solely on app-level size checks.

---

## Prompt 7

**Actual Prompt Text:**
> choose first or run first

**What the agent did:** Told me to cancel Claude Code's proposed
`DELETE FROM "Ticket"` reseed prompt and instead run a manual
`TRUNCATE ... RESTART IDENTITY CASCADE` myself, because a plain DELETE
would leave the Postgres id sequence at its old value and break the
id-descending sort tiebreaker the seed data was supposed to test.

**My Reflection:**
Learned the hard way that Postgres sequences persist through DELETE resetting identity counters prevented weird sort/tiebreaker bugs in our test suite.

---

## Prompt 8

**Actual Prompt Text:**
> i think it first time need install

**What the agent did:** Told me to run the Playwright browser install
manually and separately from Claude Code first, since it's a large
one-time download and Claude Code can't watch a progress bar or notice
a silent failure on its own. When the first install attempt returned
with no visible output at all, walked through a `--dry-run` check and a
directory listing to confirm Chromium was actually already cached
rather than assuming something had broken.

**My Reflection:**
Large binary downloads are better handled outside the AI agent so you can monitor download progress and avoid silent timeouts.

---

## Prompt 9

**Actual Prompt Text:**
> [Uploaded a screenshot of ShitheadQuin's review comment on PR #28,
> no additional text — the comment read: "On a tie, like pageSize=15
> being equally close to 10 and 20, reduce keeps the first one, so it
> clamps to 10. Is that the intended behavior, or should ties round up
> to 20? OQ-8 only says 'nearest allowed value,' so it might be worth
> adding a quick note to make the tie-break clear."]

**What the agent did:** Confirmed round-down was a defensible choice
since OQ-8 never specified tie direction, but rather than leaving it as
an accident of `reduce`'s iteration order, wrote a prompt adding a
comment at the exact line explaining the tie-break is deliberate. This
was a documentation-only fix; separately, in the same Issue's review, a
real bug was found and fixed: My Tickets never reset its page number
when a filter changed, so sitting on page 2 of a filtered view and then
loosening the filter could return an empty page of real data and
misrender as the zero-tickets "No tickets yet" panel. That one was
found by reading MyTickets.tsx directly, before Snooker ever saw it.

**My Reflection:**
Good reminder to look beyond the surface comment during PR reviews, auditing the component directly caught a critical filter/pagination bug before our reviewer ever saw it.

---

## Prompt 10

**Actual Prompt Text:**
> last one #23

**What the agent did:** Verified the README's setup/test instructions
actually worked by having Claude Code run them literally, rather than
trusting the draft — this caught a mismatch between the README's
documented `.env.test` database role and the one actually in use, and a
cosmetic bug in the seed script's own ticket-count log line.

**My Reflection:**
reminder that onboarding docs need end-to-end testing just like real code.

---

## Reflection

Using web Claude for planning and Claude Code for implementation sped up development, but keeping git and database operations manual was what saved the project. AI excelled at writing boilerplate and code edits, but catching subtle issues—like Postgres sequence persistence, board desyncs, and dependency gaps—demanded tight human verification before anything got committed.
