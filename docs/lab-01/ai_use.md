# Lab 1 — AI Use

**LLM / agent used:** Claude (Anthropic), via the claude.ai web interface.
Filesystem read/write access to the project directory in later sessions. All
shell and git commands were run by me; the agent could read and write files but
could not execute anything.

---

## Prompt 1

**Actual Prompt Text:**
> lets start check on issue 1 : set up project. List what have to be done and ask me question if want to know more

**What the agent did:** Listed the seven Issue 1 acceptance criteria with what each required, and asked two clarifying questions about my machine state instead of assuming it.

**My Reflection:**
Knowing what ai can do and what I need to do and see the picture before doing it.

---

## Prompt 2

**Actual Prompt Text:**
> lets go step by step. For step 1 where to run that code

**What the agent did:** Reduced its output from a block of commands to one command at a time, with the working directory stated.

**My Reflection:**
Going step by step can let me know what ai goin to do and where we are now.

---

## Prompt 3

**Actual Prompt Text:**
> lets start with ai_use.md where to store it where to start

**What the agent did:** Stated it had no write access to my filesystem and told me to create the file by hand. It then checked again and found it did have write access.

**My Reflection:**
I want ai to track what we have done in md file. And ai may make some mistake because ai did not check, so I have to told them to check.

---

## Prompt 4

**Actual Prompt Text:**
> TokTickIT — CPE 334 Lab 1, Issue 2: Implement the API health check.
> CONTEXT
> - Windows 10, Command Prompt (not bash). `cd /d` needed to switch drives. No `&&` chaining.
> - Repo: D:\SoftwareEng\TokTickIT — github.com/Chanat-888/TokTickIT
> - I am on branch feature/2-health-check, stacked on feature/1-project-foundation
>   (Issue 1's PR #5 is open into lab1-staging but not merged yet).
> - Stack: client = Vite+React+TS+Bootstrap, server = Express+TS+Prisma+PostgreSQL.
> - Issue 1 is done: both servers start, Postgres 17 running, DB `toktickit` created.
> ACCEPTANCE CRITERIA (from the labsheet — these are what get graded)
> - GET /api/health returns HTTP 200
> - JSON response contains status = "ok" and service = "TokTickIT API"
> - A Supertest test verifies the endpoint
> - The React page displays the backend status based on a real API call
> - A useful error message appears when the backend is unavailable
> SCOPE DECISION ALREADY MADE — do not re-litigate
> The scaffold comments mark App.tsx and api.ts as "Issue 4", but the labsheet
> puts the backend-status UI in Issue 2. Follow the labsheet.
> checkSystem() must be HEALTH-ONLY in this issue: fetch /api/health, throw if
> not ok, return { online: true, categories: [] }. The categories fetch is added
> in Issue 4. Do not fetch /api/categories now — it isn't implemented and would
> make the UI show Offline permanently.
> FILES TO CHANGE (all four, minimum surgical edits)
> 1. server/src/app.ts — replace the 501 stub in the /api/health handler with the
>    required 200 response. The existing test asserts exact object equality, so
>    no extra fields.
> 2. client/src/api.ts — implement checkSystem() per the scope decision above.
> 3. client/src/App.tsx — wire handleCheck with try/catch; render idle / loading /
>    success / error. Use Bootstrap classes. Match the labsheet wording exactly:
>      Success: "System Status: Online"
>      Failure: "System Status: Offline" and "Unable to connect to TokTickIT API"
>    (Part 4 grades a screenshot against this wording.)
> 4. client/.env — copy from client/.env.example (gitignored).
> DO NOT
> - Do not implement GET /api/categories or the Prisma Category model (Issue 3/4).
> - Do not fill in the two `it.todo` tests in client/tests/lab-01/App.test.tsx —
>   they are Issue 4's.
> - Do not run `npm audit fix --force`.
> - Do not run `npx prisma migrate dev` (schema has no models until Issue 3).
> - Do not commit .env or node_modules.
> VERIFY BEFORE I COMMIT
> - cd server, npm test → the health Supertest test passes. Paste the output.
> - Both servers running, click [Check System] in the browser → "System Status: Online".
> - Stop the backend, click again → Offline + the error message. Screenshot this.
> WORKING STYLE
> Go one step at a time and wait for my terminal output before the next step.
> Be direct, tell me if I'm wrong, give one recommendation not a list of options.
> I paste raw output rather than summarising — read it yourself.
> You have filesystem access to D:\ and can read/write project files, but cannot
> run shell or git commands. I run those.
> Start by reading server/src/app.ts, client/src/api.ts, client/src/App.tsx and
> server/tests/lab-01/health.test.ts, then give me step 1.

**What the agent did:** Changed four files, kept `checkSystem()` health-only, and did not touch the Issue 4 items listed under DO NOT.

**My Reflection:**
Using ai to help create prompt make the prompt more effective and accurate.

---

## Prompt 5

**Actual Prompt Text:**
> for reviewer.md where to look in pdf what ta want?

**What the agent did:** Stated it did not have the labsheet PDF and could not cite a section. After I uploaded it, the agent located the Part 1 "PR Review Evidence, 5 points" spec and retracted an earlier claim that the Part 4 failure screenshot had to be committed to the repo.

**My Reflection:**
I give ai the pdf to see what is needed.

---

## Prompt 6

**Actual Prompt Text:**
> isnt there should be screenshots folder here? where it gone

**What the agent did:** Had me run `git log --oneline -1 feature/2-health-check` to show commit 87491a5 still held the folder, which had disappeared from Explorer after a branch checkout.

**My Reflection:**
I'm new to git so I learn that file change with what branch I working on.

---

## Prompt 7

**Actual Prompt Text:**
> I want to start issue 3. Plan how to do it

**What the agent did:** Read schema.prisma, seed.ts, package.json and .env before answering. Identified that package.json already wires a Prisma seed hook, so the seed had to be written before running `migrate dev`. In the same session it made two claims that were later disproved: that the README would cause a permission error on Postgres 15+ (retracted after it read the README), and that `migrate dev` would auto-run the seed (the terminal output showed it did not).

**My Reflection:**
When start to do something I let ai plan what to do first.

---

## Prompt 8

**Actual Prompt Text:**
> what to do with the one in main??

**What the agent did:** Argued against using the Revert button on PR #7, on the grounds that a revert leaves the commits in main's ancestry so the release PR would skip re-applying them. Recommended opening PR #8 to re-target the same commits onto lab1-staging instead.

**My Reflection:**
Made some mistake and merge to main so try to find way out of this problem.

---

## Prompt 9

**Actual Prompt Text:**
> can you try edit again?

**What the agent did:** After a filesystem tool timeout, re-read the file rather than re-applying the edit from memory, and found the working tree was on the wrong branch.

**My Reflection:**
If some tools is broken I need to ask ai the check it again.

---

## Prompt 10

**Actual Prompt Text:**
> I want to start issue 4. plan it for me

**What the agent did:** Read the repo, then searched earlier sessions and reported that the reverse peer review I had recorded as outstanding had in fact been completed. Later in the same session it wrote this file in my first person without being asked, which I stopped and reverted to this skeleton.

**My Reflection:**
Same as previous issue, I let ai plan for me first before working on it, So I can know where/what to do first.

---

## Reflection

I think lets ai plan everytime before doing work is the best way to start and let ai ask more question to let ai see the same picture as you. And check what ai doing and the result everytime you do work. And for prompt part let ai help you prompt is good for dont do this dont do that, but it may not necessary everytime.
