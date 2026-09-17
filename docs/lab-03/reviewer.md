# Peer Review: Lab 3

**Reviewer:** Chanat Dachkumhang
**GitHub username:** Chanat-888
**Partner:** Jeerasak Phisawong, GitHub: @ShitheadQuin

We each keep our own copy of the repository (`Chanat-888/TokTickIT` and `ShitheadQuin/Toktickit`)
and review each other's Pull Requests for every Lab 3 Issue.

This file is updated as PRs are opened, reviewed and approved during the sprint, not reconstructed
at the end.

## Reviews I gave on my partner's PRs

Pull Requests Jeerasak authored and I reviewed, all targeting his `lab3-staging` except the two
release PRs into `main`:

| PR | Branch | My verdict |
|----|--------|------------|
| [#33](https://github.com/ShitheadQuin/Toktickit/pull/33) | feature/32-lab3-spec | Requested changes (3 blocking, 1 should-fix, 1 open question), fixed in `65068cb`, approved, merged into lab3-staging |
| [#42](https://github.com/ShitheadQuin/Toktickit/pull/42) | feature/34-user-migration | Approved with no changes requested, merged into lab3-staging |
| [#43](https://github.com/ShitheadQuin/Toktickit/pull/43) | feature/35-auth | Requested changes (0 blocking, 4 should-fix, 1 minor), fixed in `2e26120`, approved, merged into lab3-staging |
| [#44](https://github.com/ShitheadQuin/Toktickit/pull/44) | feature/36-authorization | Requested changes (1 should-fix, 1 minor), fixed in `98813f4`, approved, merged into lab3-staging |
| [#45](https://github.com/ShitheadQuin/Toktickit/pull/45) | feature/37-staff-queue | Approved with no changes requested, merged into lab3-staging |
| [#46](https://github.com/ShitheadQuin/Toktickit/pull/46) | feature/38-staff-detail | Approved with no changes requested, merged into lab3-staging |
| [#48](https://github.com/ShitheadQuin/Toktickit/pull/48) | feature/47-staff-detail-polish | Approved with no changes requested, merged into lab3-staging |
| [#49](https://github.com/ShitheadQuin/Toktickit/pull/49) | feature/39-user-admin | Approved with no changes requested, merged into lab3-staging |
| [#50](https://github.com/ShitheadQuin/Toktickit/pull/50) | feature/40-e2e-visual | Approved with no changes requested, merged into lab3-staging |
| [#51](https://github.com/ShitheadQuin/Toktickit/pull/51) | feature/41-release | Approved with no changes requested, merged into lab3-staging |
| [#52](https://github.com/ShitheadQuin/Toktickit/pull/52) | lab3-staging → main | Approved with no changes requested, merged into main (release) |
| [#54](https://github.com/ShitheadQuin/Toktickit/pull/54) | fix/server-typecheck | Approved with no changes requested, merged into lab3-staging |
| [#55](https://github.com/ShitheadQuin/Toktickit/pull/55) | fix/41-submission-docs | Approved with no changes requested, merged into lab3-staging |
| [#56](https://github.com/ShitheadQuin/Toktickit/pull/56) | lab3-staging → main | Approved with no changes requested, merged into main (release) |

Jeerasak's repository numbers its own business rules and tests independently of mine. Every
reference below is to **his** `specification.md` / `api-spec.md` / `tests.md`, not to this
repository's.

### Sprint 3 engineering contract, [ShitheadQuin/Toktickit#33](https://github.com/ShitheadQuin/Toktickit/pull/33)

Docs-only PR (no test/code files yet) — reviewed `specification.md`, `api-spec.md`, `ui-spec.md`,
`tests.md` in full.

**My comments (blocking):**
1. `tests.md` claimed 39/39 tests "Pass" while this PR adds zero test files — contradicts `tests.md`
   §6's own rule that a row moves to Pass only once its test exists and passes on its feature
   branch. Same aspirational-coverage issue as Lab 2 PR #30.
2. FR-13 said "IT Staff/Administrator set IT Priority," contradicting BR-15, `api-spec.md` §4's
   Administrator-403 on `PATCH /staff/tickets/:id/priority`, the §7 authorization matrix, and
   `specification.md` §11's own statement that Administrator doesn't perform IT Staff ticket
   operations.
3. Pagination field-name mismatch: `specification.md` §11 defines `totalCount`, but `api-spec.md`
   §4's response example used `totalItems` — a real contract ambiguity for whoever implements the
   queue.

**My comment (should-fix):** PR description claimed 25 ACs; `specification.md` §9 actually has 28
(AC-01–AC-28), all correctly traced in `tests.md` §3 — just update the description's count.

**My open question:** asked Jeerasak to confirm several design decisions against the actual
labsheet sections they cited (§4.3/4.5 on Admin ticket access, §6 on initial-password issuance,
§8.5/8.6 on admin list and feedback matrix).

**Jeerasak's response:** Fixed in `65068cb` — all `tests.md` rows reset to "Planned," Administrator
dropped from FR-13, and the API contract standardized on `totalCount`.

**My approval:** No blocking issues remained. Approved and merged into `lab3-staging`.

### User model, migration and seed, [ShitheadQuin/Toktickit#42](https://github.com/ShitheadQuin/Toktickit/pull/42)

15 files, +658/-75, matching GitHub.

**My review (approved, no changes requested):** Verified independently against the schema,
`migration.sql`, seed, seed-credentials, `app.ts`, updated Lab 2 tests, and the migration regression
test. The Requester→User rename preserves all ids and foreign keys, the migration's bcrypt hash
checks out against the documented password, role scoping is applied everywhere with no leftover
`prisma.requester` calls, seed counts match labsheet §5.3, and `tests.md` only marks the three tests
this PR actually implements as Pass.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Login, logout, current user, forced password change, [ShitheadQuin/Toktickit#43](https://github.com/ShitheadQuin/Toktickit/pull/43)

His fork's `lab3-staging` has independent git history from mine, so I diffed the PR branch against
his fork's own `lab3-staging` (24 files, +1205/-39, matching GitHub) rather than my `origin`. Stood
up an isolated local Postgres database, applied his migrations, and ran the actual suites: server
114 tests (2 pre-existing failures, both reproduced identically on his pre-PR `lab3-staging`,
unrelated to auth), client 54/54 pass, `e2e/lab-03/authentication.spec.ts` passes; isolated to just
this PR's new files, 24/24 pass.

**My comments (should-fix):**
1. Login and the login-throttle key compared email case-sensitively (`server/src/routes/auth.ts`,
   `server/src/auth/login-throttle.ts`), so a user typing a different case than stored got a false
   invalid-credentials error, although his BR-19 commits to case-insensitive email uniqueness.
2. The session's sliding expiry was extended in the database (`session.ts`) on every request, but
   the `sid` cookie's own `Expires` was set once at login and never refreshed in `requireAuth`, so
   an active user was still logged out at exactly the original 12-hour mark.
3. `api-spec.md` §3 cited "Issue #35" (this PR) for the BR-12 404-vs-403 ownership change, but
   `app.ts` is untouched by this PR and every ownership check still returns 403 — his own PR
   description says that work is deferred to #36.
4. `tests.md` wasn't updated despite this PR delivering passing tests for AC-01, AC-02, AC-05–08,
   AC-25 — those rows still said "Planned."

**My comment (minor):** `tests.md` described API-02 as covering response time, but the test only
asserts the error messages match.

**Jeerasak's response:** Fixed all five in `2e26120`. (1) Email is trimmed and lowercased before
the login lookup and before use as the throttle key, with a new test for a differently-cased login.
(2) `getSessionUser` now returns the refreshed expiry and `requireAuth` re-sets the cookie with it
on every authenticated request, with a new test asserting the `set-cookie` header. (3) The citation
now says Issue #36. (4) UNIT-01, UNIT-04, API-01–08, UI-01, UI-02, E2E-01 flipped to Pass. (5)
API-02's expected-result cell reworded to describe what the test actually asserts.

**My approval:** All five points verified fixed by re-reading the diff against the previous review.
Approved and merged into `lab3-staging`.

### Authorization layer, role navigation, Requester regression, [ShitheadQuin/Toktickit#44](https://github.com/ShitheadQuin/Toktickit/pull/44)

Diffed against the fork's `lab3-staging`, now including merged #43 (42 files, +992/-1237, matching
GitHub).

**My comment (should-fix):** `AppShell.tsx:75` used `className="tt-badge tt-badge-role"`, but
`.tt-badge-role` isn't defined in `theme.css` — only `.tt-badge-priority-*` and
`.tt-badge-status-*` exist. `ui-spec.md` §14/§9 call for `.tt-badge-role-requester` / `-it-staff` /
`-administrator`. Every role's badge rendered with no background or text color at all — the same
undefined-class pattern that recurred in Lab 2.

**My comment (minor):** The IT Staff (`/staff/queue`) and Administrator (`/users`) nav links pointed
to routes that don't exist until #37/#39, so clicking them rendered a blank page. Suggested a
placeholder or disabled state.

**My verification (no change requested):** every Lab 2 Requester/Attachment endpoint now runs
`requireAuth → requirePasswordChanged → requireRole('REQUESTER')`, resolves ownership from
`req.user.id` only, and returns 404 (not 403) for ownership mismatches; both #43 fixes carry
through correctly; the Development Requester selector is fully and cleanly removed with no dead
references anywhere in `client/src` or `server/src`; `RequireRole` redirects correctly for
unauthenticated, must-change-password and wrong-role cases; new `authorization.api.test.ts` cases
(API-09, API-10, API-15) hit the real app, with API-11–14 correctly deferred to #37/#38/#39.

**Jeerasak's response:** Fixed in `98813f4`. The role badge now uses the three §14 classes with
§9 colors. Checking further found the same problem on status badges (only `.tt-badge-status-new`
existed, and pages built class names from the raw enum instead of §14's names) — all 8 statuses and
3 roles now go through one shared mapping (`client/src/components/badge-classes.ts`), each with a
CSS rule, and a new `badge-classes.test.ts` fails if any mapped class loses its rule. `/staff/queue`
and `/users` are now role-guarded placeholder routes. Also restored 9 Lab 2 screenshots his
responsive spec had overwritten, and flipped the relevant `tests.md` rows to Pass.

**My approval:** Verified the badge fix (`ROLE_BADGE_CLASS` mapping, all classes backed by CSS) and
the placeholder routes directly against the diff. Approved and merged into `lab3-staging`.

### IT Staff Ticket Queue, [ShitheadQuin/Toktickit#45](https://github.com/ShitheadQuin/Toktickit/pull/45)

13 files, +1336/-18, matching GitHub.

**My review (approved, no changes requested):** Reviewed the server authorization and query logic
and spot-checked the client against `api-spec.md` §4 and `ui-spec.md` §6. Confirmed: the endpoint is
IT Staff only (403 for Requester and Administrator); invalid `status`/`itPriority`/`owner` values
degrade to zero results rather than 400; search covers ticket number, summary, description and
requester name/email; sort ties break on `id`; the Prisma enum declaration order genuinely matches
the documented sort order (New→Cancelled, Low→High) — easy to get silently wrong, and it isn't;
`ticket-list-helpers.ts`'s change is a pure export of existing helpers with no behavior change to My
Tickets; the client guards against out-of-order responses, keeps empty vs. no-results states
distinct, and shows a safe-failure message with retry rather than the empty state on a fetch error;
every `tt-*` class the Queue uses is backed by a `theme.css` rule, so the undefined-badge-class
problem from #44 didn't recur.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### IT Staff Ticket Detail, [ShitheadQuin/Toktickit#46](https://github.com/ShitheadQuin/Toktickit/pull/46)

23 files, +2854/-53, matching GitHub.

**My review (approved, no changes requested):** Focused on the highest-risk logic. The two
pre-implementation matrix fixes (Reopened→In Progress; owner's New→Open after a reassign) close
real gaps I'd have hit too. Claim is genuinely atomic (`updateMany` conditioned on
`ticketOwnerId: null, currentStatus: 'NEW'` in one statement, not read-then-write). Status
transitions use the same optimistic-concurrency pattern, turning a mid-air change into a 409 rather
than silently applying a stale transition. Internal Notes can't leak to a Requester:
`requireRole('IT_STAFF', 'ADMINISTRATOR')` runs before the ticket is even looked up on `GET
/notes`, so a Requester gets 403 with zero information about whether the ticket or notes exist.
`resolution-signal` correctly 404s for someone else's ticket, 409s on Closed/Cancelled, and is
idempotent. The visually-critical CSS classes (`.tt-comment-public`, `.tt-note-internal`,
`.tt-disabled-not-owner`) are all correctly applied and defined, and the owner-required status
option is disabled-with-tooltip, not hidden, matching `ui-spec.md` §7.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Staff Ticket Detail polish, [ShitheadQuin/Toktickit#48](https://github.com/ShitheadQuin/Toktickit/pull/48)

5 files, +34/-6, matching GitHub — small enough to read in full.

**My review (approved, no changes requested):** All three fixes matched the PR description exactly:
the Claim button now sits in its own block (verified by a real-browser bounding-box check in the
e2e spec, correctly placed there since jsdom can't do layout); the `409 INVALID_TRANSITION` message
uses the same `STATUS_LABEL` mapping already used client-side, no more raw enum codes shown to IT
Staff; the flaky client test had a real root cause (selecting a value before the async-loaded
`<option>` existed, silently selecting nothing) and was fixed by awaiting the option, not a
retry/timeout band-aid.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Administrator User Management, [ShitheadQuin/Toktickit#49](https://github.com/ShitheadQuin/Toktickit/pull/49)

18 files, +1373/-26, matching GitHub (diffed with merge-base semantics against `lab3-staging` since
#48 had merged in the meantime).

**My review (approved, no changes requested):** The last-active-admin check is race-safe — wrapped
in a `Serializable` transaction that recounts other active admins inside the transaction, catching
Postgres's `P2034` serialization failure and returning a clean 409 instead of a 500. The
self-deactivation check correctly runs before the last-admin check. `readUserFields` only ever
reads the four whitelisted fields off the body (BR-22), structurally, not just by filtering after
reading. Email normalization (trim + lowercase) matches the same fix from #43. Password reset
invalidates existing sessions in the same transaction as the hash update. The initial-password
generator uses `crypto.randomInt`, excludes ambiguous characters, and loops until the letter+digit
requirement is genuinely satisfied. Client error handling maps the three specific error codes to
the exact inline messages `ui-spec.md` §8 specifies.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### E2E, responsive and visual evidence, [ShitheadQuin/Toktickit#50](https://github.com/ShitheadQuin/Toktickit/pull/50)

28 files, +640/-21, matching GitHub.

**My review (approved, no changes requested):** Both claimed UI fixes are real and correctly done:
`.tt-head-status` width bumped 6.5rem→11rem (the actual regression, sized for Lab 2's one status
and never revisited when #36 added all eight); email wrapping switched from
`overflow-wrap: anywhere` to `break-word` plus a single `<wbr>` after the `@`, the correct way to
control exactly one break point. `global-teardown.ts` uses parameterized queries throughout, correct
FK ordering, and checks a fixture Requester still owns nothing unmarked before deleting it. Two
honest spec corrections beyond the two UI bugs (the header's drafted-but-never-built Profile menu;
the voluntary Change Password screen documented with a Cancel button it doesn't have) were both
explicitly flagged as doc corrections, not silently changed. The completed §12 checklist cites
specific measurements and test files per line.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Reviewer log and AI use, [ShitheadQuin/Toktickit#51](https://github.com/ShitheadQuin/Toktickit/pull/51)

2 files, +541, docs-only.

**My review (approved, no changes requested):** Given the PR's claim that every review comment was
taken from GitHub rather than reconstructed, I spot-checked rather than took it on faith. The
section on my own reviews (#43–#50) accurately reflects what I actually found, including exact
one-sentence approvals verbatim. The Chanat-888/TokTickIT#46–55 section initially looked
unfamiliar, so I checked it against the real GitHub API (`gh pr view`) rather than assume either
way — those PRs are real, merged, and Jeerasak's actual review comments there match what's
summarized. Verified one specific claim end-to-end: commit `2e26120` cited for #43's fix is real
and its message matches exactly. `ai-use.md` reads as specific and genuine, consistent with
everything else observed.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Lab 3 release, [ShitheadQuin/Toktickit#52](https://github.com/ShitheadQuin/Toktickit/pull/52)

His release from `lab3-staging` into `main`. 117 files, +10693/-1318, matching GitHub.

**My review (approved, no changes requested):** Given every constituent PR had already been
reviewed individually, checked this structurally rather than line-by-line: every merge commit
between `main` and `lab3-staging` maps to a PR I'd already reviewed (#33, #42, #43, #44, #45, #46,
#48, #49, #50, #51), no surprise commits; `tests.md` has zero rows still marked "Planned," every
test row is "Pass" at release time.

**Jeerasak's response:** None needed.

**My approval:** Approved (no written comment) and merged into `main`.

### Server typecheck, [ShitheadQuin/Toktickit#54](https://github.com/ShitheadQuin/Toktickit/pull/54)

8 files, +34/-23, matching GitHub.

**My review (approved, no changes requested):** Ran `tsc --noEmit` myself on both branches rather
than trust the headline claim — 320 errors on base, 0 on this branch, exact match. Root cause is
right: `module: "nodenext"` plus `package.json`'s `"type": "commonjs"` plus `verbatimModuleSyntax`
made every ES-module import an error (TS1295); `"preserve"` is correct for a project that runs
through `tsx`, since it only changes what the type-checker reports, not runtime behavior. The two
non-cosmetic fixes are real bugs, not noise suppression: `middleware.ts` was importing a `User`
export that Prisma 7 doesn't produce (it's `UserModel`), so `req.user` was never actually
type-checked anywhere in the app; and `app.ts`'s ticket-number sequence read now explicitly checks
for a missing row instead of silently building a ticket number from `undefined`.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Submission doc corrections, [ShitheadQuin/Toktickit#55](https://github.com/ShitheadQuin/Toktickit/pull/55)

2 files, +134/-32, matching GitHub.

**My review (approved, no changes requested):** Verified the corrections against live GitHub data
again. The claim that I "approved #52 without a written comment" looked suspicious at first, since
I'd given a detailed written review of #52 — checked `gh pr view 52` directly and confirmed the
real review is `APPROVED` with an empty body at exactly the claimed timestamp, so it's accurate. The
two brand-new entries (#56, #57 on `Chanat-888/TokTickIT`) were checked against the real GitHub
review/comment threads and are faithful paraphrases, not fabricated. `ai-use.md` corrections are all
minor and consistent.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `lab3-staging`.

### Lab 3 release: submission doc corrections, [ShitheadQuin/Toktickit#56](https://github.com/ShitheadQuin/Toktickit/pull/56)

2 files, +134/-32 — the release of #55 into `main`.

**My review (approved, no changes requested):** Confirmed the diff is identical to #55's
already-verified content, and the only merge commit since `main` is #55 itself. Nothing new to
check.

**Jeerasak's response:** None needed.

**My approval:** Approved and merged into `main`.

## Reviews my partner gave on my PRs

Pull Requests I authored on `Chanat-888/TokTickIT` and Jeerasak reviewed, all targeting my
`lab3-staging` except the final release PR into `main`:

| PR | Branch | His verdict |
|----|--------|------------|
| [#46](https://github.com/Chanat-888/TokTickIT/pull/46) | feature/lab3-specs | Requested changes (2 should-fix, via inline comments), fixed in `6ad0ad1`/`d9ebd8e`, approved, merged into lab3-staging |
| [#47](https://github.com/Chanat-888/TokTickIT/pull/47) | feature/lab3-tests | Requested changes (1 should-fix), fixed in `09bf3e7`/`01e1765`, approved, merged into lab3-staging |
| [#48](https://github.com/Chanat-888/TokTickIT/pull/48) | feature/lab3-schema-seed | Requested changes (3 should-fix), fixed in `2e7c3b7`, approved, merged into lab3-staging |
| [#49](https://github.com/Chanat-888/TokTickIT/pull/49) | feature/lab3-auth | Requested changes (3 should-fix), fixed in `4dc3abe`, approved, merged into lab3-staging |
| [#50](https://github.com/Chanat-888/TokTickIT/pull/50) | feature/lab3-requester-regression | Requested changes twice (2 should-fix, then missing API test coverage), fixed in `fb793c0`/`c1e0719`, approved, merged into lab3-staging |
| [#51](https://github.com/Chanat-888/TokTickIT/pull/51) | feature/lab3-staff-queue | Requested changes (3 should-fix), fixed in `f798ee4`, approved, merged into lab3-staging |
| [#52](https://github.com/Chanat-888/TokTickIT/pull/52) | feature/lab3-staff-ticket-detail | Requested changes (3 should-fix), fixed in `a30c583`, approved, merged into lab3-staging |
| [#53](https://github.com/Chanat-888/TokTickIT/pull/53) | feature/lab3-admin-users | Requested changes (3 should-fix), fixed in `bb1dad0`, approved, merged into lab3-staging |
| [#54](https://github.com/Chanat-888/TokTickIT/pull/54) | feature/lab3-test-suite | Approved with no changes requested, merged into lab3-staging |
| [#55](https://github.com/Chanat-888/TokTickIT/pull/55) | feature/lab3-screenshots | Approved with no changes requested, merged into lab3-staging |
| [#56](https://github.com/Chanat-888/TokTickIT/pull/56) | feature/lab3-lab2-e2e-fix | Approved with no changes requested (one non-blocking note), merged into lab3-staging |
| [#57](https://github.com/Chanat-888/TokTickIT/pull/57) | feature/lab3-ai-use | Requested changes twice (a false-alarm 404, then a real dangling `reviewer.md` reference), second issue fixed, approved, merged into lab3-staging |
| [#58](https://github.com/Chanat-888/TokTickIT/pull/58) | lab3-staging → main | Approved with no changes requested, merged into main (release) |

My repository numbers its own business rules and tests independently of Jeerasak's. Every reference
below is to **my own** `specification.md` / `api-spec.md` / `tests.md`.

### Sprint 3 engineering contract (Spec DD), [#46](https://github.com/Chanat-888/TokTickIT/pull/46)

3 files, +1090/-0.

**His comments (should-fix):**
1. `ui-spec.md`'s Owner control needed a searchable list of active IT Staff/Administrator users, but
   the only user-list endpoint (`GET /api/admin/users`) was Administrator-only, so IT Staff couldn't
   load the users they needed to assign — asked for a dedicated endpoint.
2. `POST /api/auth/change-password` left the user's old sessions valid after a password change — no
   business rule said whether other sessions should be invalidated or the caller's token rotated.

**My response:** Added `GET /api/staff/assignable-users` to `api-spec.md`, and BR-35 to
`specification.md` §5 requiring session invalidation on password change. Then his follow-up comment
caught that the new endpoint still wasn't listed in `specification.md` §8's own endpoint table —
fixed that too.

**His approval:** All three points confirmed addressed. Approved and merged into `lab3-staging`.

### Test DD plan (tests.md), [#47](https://github.com/Chanat-888/TokTickIT/pull/47)

2 files, +411/-0.

**His comment (should-fix):** A test expected an already-open session from a deactivated user to
return 401 immediately, but BR-28 only said an inactive user cannot authenticate — nothing required
`isActive` to be checked on every request for an existing session.

**My response:** BR-36 added to `specification.md` §5 requiring `isActive` to be checked per
request, giving the test a spec source; API-65/API-66/UI-24 added to cover BR-35 and the
`assignable-users` endpoint from #46. His follow-up caught that `assignable-users` only had a 200
case documented — added a row covering a Requester session getting 403.

**His approval:** Test plan confirmed complete and traceable. Approved and merged into
`lab3-staging`.

### Data model and migration, [#48](https://github.com/Chanat-888/TokTickIT/pull/48)

11 files, +446/-59.

**His comments (should-fix):**
1. `specification.md` §7 said email is stored lowercased, but nothing enforced it — `User_email_key`
   was case-sensitive, so `A@x.com` and `a@x.com` could both exist.
2. `Session.expiresAt` had no index, despite BR-12/BR-35 meaning expired and per-user sessions would
   be deleted often.
3. Tickets could reach `RESOLVED`/`REOPENED`, but `requesterIndicatedResolvedAt` was never seeded —
   BR-24 and the Queue flag had no seed data to exercise them.

**My response:** Fixed in `2e7c3b7` — a lowercase backfill plus a `User_email_lowercase` CHECK
constraint, an `@@index([expiresAt])` on `Session` in both the migration and `schema.prisma`, and a
few seeded tickets given a non-null `requesterIndicatedResolvedAt`.

**His approval:** All three confirmed addressed; called the migration careful and the rename
ID-preserving. Approved and merged into `lab3-staging`.

### Authentication foundation, [#49](https://github.com/Chanat-888/TokTickIT/pull/49)

28 files, +1150/-729.

**His comments (should-fix):**
1. An unknown email skipped `bcrypt.compare` entirely and returned in ~1ms, while a real email cost
   ~300ms — a timing oracle that let an attacker enumerate valid emails, even though BR-09 wants the
   two cases indistinguishable.
2. Logging in again didn't delete the caller's previous `Session` row, and nothing ever swept
   expired rows — old tokens stayed valid for the full 12 hours and the table only grew.
3. There was no global 401 handler — if a session expired or an Admin deactivated the account
   mid-session (BR-36), client state stayed "authenticated" and the user just saw failing requests
   with no way back to Login.

**My response:** Fixed in `4dc3abe` — a dummy `bcrypt.compare` runs even on an unknown email to
close the timing gap; `createSession` now sweeps expired sessions scoped so it doesn't overlap with
BR-35's other-session invalidation; a global 401 handler on `apiFetch` sets auth status to
unauthenticated on any 401, excluding `/auth/*` routes to avoid a refresh loop.

**His approval:** All three confirmed addressed, with the reasoning right in each case. Approved and
merged into `lab3-staging`.

### Requester regression and public comments, [#50](https://github.com/Chanat-888/TokTickIT/pull/50)

5 files, +692/-1.

**His comments (should-fix):**
1. Comment bodies were stored raw, including leading/trailing whitespace, inconsistent with BR-21's
   own trim-for-the-empty-check logic.
2. A second `POST` to the resolve-indication endpoint overwrote `requesterIndicatedResolvedAt` with
   a later timestamp — the client hid the button after the first click, but the endpoint itself
   wasn't idempotent, and BR-24 records when the Requester *first* indicated this.

**My response:** Fixed in `fb793c0` — comment bodies now trimmed before storage; resolve-indication
made idempotent, returning the ticket unchanged on a repeat call.

**His follow-up (requested changes again):** This PR added two endpoints and a UI panel with no
tests, despite `tests.md` already listing rows for comments and the resolve indication.

**My response:** Added `comments-notes.api.test.ts` covering API-38 through API-48 in `c1e0719`,
deferring API-41/42 (which need `POST /api/tickets/:id/notes` from a later PR) with his agreement.

**His approval:** All points confirmed addressed. Approved and merged into `lab3-staging`.

### IT Staff Ticket Queue, [#51](https://github.com/Chanat-888/TokTickIT/pull/51)

10 files, +1349/-15.

**His comments (should-fix):**
1. No guard against out-of-order responses — two quick sort/page clicks could resolve in reverse
   order and leave the older result on screen.
2. Changing a filter while on a later page fired one fetch with the stale page, then a second after
   an effect reset it to page 1 — a wasted request and a visible flash of wrong rows.
3. An unrecognized `ownerId` was silently ignored (returning the whole unfiltered queue) while
   `status`/`itPriority` both correctly 400'd on a bad value — an inconsistency worth closing even
   though §3 didn't explicitly require it for `ownerId`.

**My response:** Fixed in `f798ee4` — a request-id guard drops stale responses; filter setters call
`setPage(1)` directly instead of through an effect, so a filter change issues exactly one request;
`ownerId` now validates alongside the other filters, with a regression test for each fix.

**His approval:** All three confirmed addressed; called the regression tests a good addition.
Approved and merged into `lab3-staging`.

### IT Staff Ticket operations, [#52](https://github.com/Chanat-888/TokTickIT/pull/52)

9 files, +1567/-1.

**His comments (should-fix):**
1. The status-change endpoint was read-then-write with no guard — two staff members acting
   concurrently could both pass the transition-matrix check against the same stale status, and the
   second write would silently win.
2. The IT Staff ticket-detail view returned soft-removed attachments too, unlike the Requester view
   which filters `removedAt: null` — asked whether that was intended, and if so, whether the UI
   should mark them.
3. Owner/IT-Priority/Status handlers each merged only their own field back into local state, so a
   change another staff member made since page load stayed stale on screen.

**My response:** Fixed in `a30c583` — the status write became a conditional `updateMany` returning
409 on a mismatch; on the attachments point, his re-read of the Requester handler found both views
already intentionally return removed rows with `isRemoved` and the UI already marks them, so no
change was needed there; client handlers now re-fetch the full ticket after a successful write
instead of merging a partial response.

**His approval:** All three confirmed addressed, including agreeing no change was needed on the
attachments point after his own re-check. Called the conditional `updateMany` the right pattern.
Approved and merged into `lab3-staging`.

### Administrator User Management, [#53](https://github.com/Chanat-888/TokTickIT/pull/53)

9 files, +1581/-1.

**His comments (should-fix):**
1. An admin-initiated password reset didn't delete the target user's sessions, so anyone already
   signed in as that account stayed signed in for up to 12 hours — BR-35 does exactly this for a
   self-initiated change, but this endpoint didn't reuse that logic.
2. The last-active-admin check had the same read-then-write gap as #52's status PATCH — two admins
   demoting each other at once could each count one other active admin and both succeed, leaving
   zero active admins.
3. `UserManagement.tsx`'s search box had no stale-response guard, unlike `StaffTicketQueue`, so fast
   typing could let an older search result land last.

**My response:** Fixed in `bb1dad0` — password reset now calls `deleteAllSessions` (not
`deleteOtherSessions`, since there's no caller session of the target's own to preserve); the
last-admin check wrapped in a `Serializable` transaction, catching Postgres's `P2034` and mapping it
to the same 409; the search box reuses the same `latestRequestId` ref pattern as the Queue.

**His approval:** All three confirmed addressed; agreed the Serializable-isolation approach handles
the write-skew case cleanly, and that a timing-based concurrency test wasn't necessary given the
existing sole-admin test already covers the business behavior. Approved and merged into
`lab3-staging`.

### Test suite (unit, API, component, style, E2E), [#54](https://github.com/Chanat-888/TokTickIT/pull/54)

24 files, +2025/-30.

**His review (approved, no changes requested):** Cross-checked every Test ID in `tests.md` against
the files on this branch — all covered, and the new suites match the spec. Agreed the Lab 2
E2E-06/07/08 rewrite (broken by the Requester Selector's removal) belonged in a separate follow-up
task rather than this PR.

**My response:** None needed.

**His approval:** Approved and merged into `lab3-staging`.

### Screenshots and visual inspection, [#55](https://github.com/Chanat-888/TokTickIT/pull/55)

42 files, +384/-6.

**His review (approved, no changes requested):** All 40 screenshot captures present across the five
folders, and the paths in `responsive-visual.spec.ts` match. Agreed that adding
`requester-ticket-detail/` to `ui-spec.md` §8 was the right call, since §5.4's Requester Ticket
Detail additions didn't have a home in the original four listed folders.

**My response:** None needed.

**His approval:** Approved and merged into `lab3-staging`.

### fix(lab-02): repair E2E-06/07/08 and screenshot checklist, [#56](https://github.com/Chanat-888/TokTickIT/pull/56)

6 files, +65/-84.

**His review (approved, with one non-blocking suggestion):** The rewrites accurately describe what
changed, and documenting E2E-07's reachability constraint inline follows the same approach as this
repo's own API-58/59 precedent. Noted that Phase 10's Definition of Done asks for Lab 2's E2E suite
to pass *unmodified*, and this PR does modify three of its tests — suggested a line in the release
PR explaining this so it doesn't look like the tests were changed just to make them pass. Also
called out reverting the accidentally-regenerated Lab 2 evidence PNGs as the right call.

**My response:** None at the time — the inline comments this PR already added to the affected test
files (explaining the BR-15 justification) carried through into the release diff, which he judged
sufficient when he later reviewed #58. Retroactively also added an explicit note to #58's own
description while assembling this reviewer log, for anyone reading the release PR without digging
into the test-file diffs.

**His approval:** Approved and merged into `lab3-staging`.

### docs(lab-03): add ai-use.md, [#57](https://github.com/Chanat-888/TokTickIT/pull/57)

1 file, +160/-0.

**His first comment (should-fix):** `raw.githubusercontent.com` returned 404 for the file — either
it was never committed, or the path was wrong.

**My response:** Verified directly (`git log`, and `curl` against both the branch tip and the exact
commit reviewed) that `ai-use.md` itself was genuinely committed and correctly populated — the 404
traced to a transient `raw.githubusercontent.com` CDN lag right after the push, not a missing file.
Asked him to re-check.

**His second comment (should-fix, on re-review):** Approved the file overall — format matched Lab
2's `ai-use.md`, prompts were real — but pointed out a *different*, genuine problem: line 7's intro
referenced `docs/lab-03/reviewer.md` by exact path, and that file actually did return 404 on this
branch (including at the specific commit), since it only existed on local, unpushed branches at the
time. Not blocking, but worth fixing before submission.

**My response:** Confirmed his second premise was correct and reworded the intro to describe the
review-log arrangement without asserting a specific path that wasn't actually there yet.

**His approval:** Approved and merged into `lab3-staging`.

### Lab 3: Release integration to main, [#58](https://github.com/Chanat-888/TokTickIT/pull/58)

117 files, +10885/-891 — the release of `lab3-staging` into `main`.

**His review (approved, no changes requested):** All 12 phase PRs already reviewed and approved
individually, so this was a clean roll-up of previously-checked work. Noted approvingly that the
Lab 2 E2E modification was "called out explicitly rather than left for a grader to find" — visible
to him via #56's inline test-file comments carrying through into this release's diff, satisfying his
earlier suggestion on #56 without a separate release-note line. Confirmed the full suite green
(220 server / 77 client / 45 e2e) and evidence/`ai-use.md` both in place.

**My response:** None needed.

**His approval:** Approved and merged into `main`.
