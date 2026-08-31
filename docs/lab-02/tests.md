# Lab 2 Test Plan

Sources of truth, in this order: `specification.md`, `api-spec.md`, `ui-spec.md`
(all merged and authoritative). This document does not re-decide anything
fixed there — it maps FR/BR/AC/UI rules onto concrete, automatable tests.
No code is included; test files listed below do not exist yet, this is the
plan that governs what they must contain. Every row's `Final` column is left
blank — it is filled in once the corresponding test file is written and run,
matching the evidence format `docs/lab-01/tests.md` used for Lab 1.

---

## 1. Test Strategy

Six test levels, each with its own tool and scope:

| Level | Tool | Scope | Talks to a real DB? |
|---|---|---|---|
| Unit | Vitest | Pure functions in isolation — no HTTP, no DOM, no DB | No |
| API/Integration | Vitest + Supertest | Express routes through Prisma against `toktickit_test` | Yes |
| UI Component | Vitest + React Testing Library | One component/screen at a time, API calls mocked | No |
| UI Style | Vitest + React Testing Library | Same as UI Component, but asserts only the exact class names fixed in `ui-spec.md` §19 | No |
| Responsive | Playwright | Real browser, viewport resizing, screenshot capture | Via a running server/client, not a unit-test DB |
| E2E | Playwright | Full stack, multi-step user flows, multiple Requesters | Via a running server/client |

**ID scheme**: `UNIT-nn`, `API-nn`, `UI-nn`, `STYLE-nn`, `RESP-nn`, `E2E-nn`,
each independently numbered.

**File locations.** Server-side files match the four names fixed by the
labsheet's repository structure exactly (`server/tests/lab-02/*.api.test.ts`,
one per resource area) plus two unit-test files for pure server logic. On the
client, component/style/unit tests are placed under `client/tests/lab-02/`,
mirroring the existing Lab 1 convention (`client/tests/lab-01/App.test.tsx`)
rather than under `client/src/`, since components live in `client/src/` but
their tests already live in a parallel `client/tests/` tree in this repo.
E2E and responsive/visual specs live under `e2e/lab-02/`; the flow spec name
(`requester-ticket-flow.spec.ts`) is fixed by the labsheet, and a second
`responsive-visual.spec.ts` is added alongside it to hold the viewport/
screenshot checks so they aren't mixed into the functional flow file.

**Ownership isolation as a cross-cutting concern.** Rather than re-testing
the `X-Requester-Id` validation table (api-spec.md §0.1) on every single
endpoint, it is verified in full on a representative pair
(`POST /api/tickets`, `GET /api/tickets/:id`) since every other endpoint
applies the identical shared check; endpoint-specific tests then assume that
check already passed and focus on what's unique to that route.

**Database isolation.** Every API/integration test runs against a dedicated
`toktickit_test` database, migrated once in global setup and truncated
between tests — see §5. No test ever runs against the development database.

**What "boundaries" means here.** Every length/count limit in
`specification.md` §5 (BR-15, BR-16, BR-24, BR-27, BR-28, BR-29, BR-34) gets
at least one test at its edge value (e.g. summary at exactly 5 and exactly
120 characters), not only comfortably-inside and comfortably-outside values.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-38 | Candidate `TKT-YYYY-NNNNNN` generation from a given year and count | Zero-padded 6-digit sequence, correct year | `server/tests/lab-02/ticket-number.unit.test.ts` | |
| UNIT-02 | Unit | BR-38 | Retry loop on a mocked unique-constraint violation | Retries up to 5 times, then gives up rather than looping forever | `server/tests/lab-02/ticket-number.unit.test.ts` | |
| UNIT-03 | Unit | BR-14 | Summary/Description are trimmed before length validation | `"  hi  "` is measured as length 2, not 6 | `server/tests/lab-02/ticket-validation.unit.test.ts` | |
| UNIT-04 | Unit | BR-15 | Summary length boundary | 4 chars fails, 5 passes, 120 passes, 121 fails | `server/tests/lab-02/ticket-validation.unit.test.ts` | |
| UNIT-05 | Unit | BR-16 | Description length boundary | 9 chars fails, 10 passes, 2000 passes, 2001 fails | `server/tests/lab-02/ticket-validation.unit.test.ts` | |
| UNIT-06 | Unit | AC-18, BR-27 | Client-side file-size check | Files >5 MB flagged, ≤5 MB accepted | `client/tests/lab-02/attachment-validation.unit.test.ts` | |
| UNIT-07 | Unit | AC-19, BR-26 | Client-side file-type check | JPG/JPEG/PNG/WEBP/PDF accepted, anything else flagged | `client/tests/lab-02/attachment-validation.unit.test.ts` | |
| UNIT-08 | Unit | BR-28, BR-29 | Client-side active-count check (picker convenience, not authoritative) | Adding a file that would push the selection over 5 is rejected client-side | `client/tests/lab-02/attachment-validation.unit.test.ts` | |
| UNIT-09 | Unit | ui-spec.md §13.2 (OQ-UI-2) | Default `sortDir` lookup per `sortBy` column | `desc` for `createdAt`, `asc` for `summary`, `desc` for `requestedPriority`, `desc` for `status` | `client/tests/lab-02/sort-defaults.unit.test.ts` | |
| UNIT-10 | Unit | BR-11, BR-13 | A fresh `Idempotency-Key` (UUID v4 shape) is generated per new Create-Ticket attempt | Two independent submissions get two different keys | `client/tests/lab-02/idempotency-key.unit.test.ts` | |

### 2.2 API/Integration

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API/Integration | FR-02, BR-17 | `GET /api/categories` | Active Categories only, ordered by `id` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-02 | API/Integration | FR-02, BR-17 | `GET /api/related-systems` | Active Related Systems only, ordered by `id` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-03 | API/Integration | AC-26, BR-05, BR-06 | `GET /api/requesters` | Active Requesters only; seeded inactive Requester excluded | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-04 | API/Integration | AC-01, AC-27, BR-01, BR-02, BR-04 | `POST /api/tickets` valid body | 201, `ticketNumber` matches `TKT-YYYY-NNNNNN`, `status: "NEW"`, `requesterId` equals the `X-Requester-Id` sent | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-05 | API/Integration | api-spec.md §0.1 | `POST /api/tickets` missing `X-Requester-Id` | 400, `field: "X-Requester-Id"` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-06 | API/Integration | api-spec.md §0.1 | `POST /api/tickets` header valid integer, not an active Requester | 403, `"Selected Requester is not active"` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-07 | API/Integration | AC-04, BR-15, BR-19 | `POST /api/tickets` empty Summary | 400 field error on `summary`; no Ticket row created | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-08 | API/Integration | BR-16 | `POST /api/tickets` Description at 9 chars (below minimum) | 400 field error on `description` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-09 | API/Integration | AC-07, BR-17 | `POST /api/tickets` `categoryId` referencing a deactivated Category | 400 field error on `categoryId` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-10 | API/Integration | BR-17 | `POST /api/tickets` `relatedSystemId` referencing an inactive/nonexistent row | 400 field error on `relatedSystemId` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-11 | API/Integration | BR-18 | `POST /api/tickets` `requestedPriority: "URGENT"` | 400 field error on `requestedPriority` | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-12 | API/Integration | AC-05, BR-11, BR-12 | `POST /api/tickets` repeated `Idempotency-Key`, same Requester | 200, identical `id`/`ticketNumber` to the first response, no second row | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-13 | API/Integration | BR-12 | `POST /api/tickets` same `Idempotency-Key`, different Requester | 201, a distinct second Ticket is created (key scoping is per-Requester) | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-14 | API/Integration | AC-06, BR-11, BR-12 | Two concurrent `POST /api/tickets` requests sharing one `Idempotency-Key` | Exactly one Ticket row exists afterward | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-15 | API/Integration | BR-15, BR-16 | `POST /api/tickets` Summary at 121 chars, Description at 2001 chars | 400 field errors on both, upper boundary | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-16 | API/Integration | api-spec.md §0.1 | `GET /api/tickets` missing `X-Requester-Id` | 400 | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-17 | API/Integration | FR-04, BR-09 | `GET /api/tickets` Requester A vs. Requester B | Requester A never sees Requester B's Tickets or vice versa | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-18 | API/Integration | AC-09, BR-24 | `GET /api/tickets` default page/pageSize, 25-Ticket Requester | 10 items, `page: 1`, `totalCount: 25`, `totalPages: 3` | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-19 | API/Integration | BR-24 | `GET /api/tickets?page=2` and `page=3` on the same Requester | Page 2 returns the next 10, page 3 returns the remaining 5 | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-20 | API/Integration | BR-24 | `GET /api/tickets?page=99` (beyond last page) | 200, empty `data` array, not an error | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-21 | API/Integration | BR-24, api-spec.md §12 OQ-8 | `GET /api/tickets?pageSize=999` | Clamps to 50; response echoes `pageSize: 50` | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-22 | API/Integration | BR-24, api-spec.md §12 OQ-8 | `GET /api/tickets?page=0` | Clamps to 1; response echoes `page: 1` | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-23 | API/Integration | AC-10, BR-21 | `GET /api/tickets?search=<ticket-number-prefix>` | Only Tickets whose number starts with the prefix | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-24 | API/Integration | BR-21 | `GET /api/tickets?search=<summary-substring>` in mixed case | Matches case-insensitively as a substring of Summary | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-25 | API/Integration | AC-11, BR-22 | `GET /api/tickets?categoryId=<id>` | Only Tickets in that Category | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-26 | API/Integration | BR-22 | `GET /api/tickets?requestedPriority=HIGH` | Only `HIGH` Tickets | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-27 | API/Integration | api-spec.md §12 OQ-2 | `GET /api/tickets?categoryId=<unknown-id>` | 400 | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-28 | API/Integration | api-spec.md §5 | `GET /api/tickets` invalid `sortBy`, invalid `sortDir`, `status=RESOLVED` | 400 for each | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-29 | API/Integration | AC-12 | `GET /api/tickets?sortBy=requestedPriority` at `sortDir=desc` then `sortDir=asc` | HIGH-first ordering, then LOW-first ordering | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-30 | API/Integration | BR-23, api-spec.md §12 OQ-7 | Default sort with two Tickets sharing a `createdAt` | Tiebreak by `id` descending, deterministic across repeated requests | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-31 | API/Integration | AC-13, BR-25 | `GET /api/tickets` for the seeded zero-Ticket Requester | `data: []`, `totalCount: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-32 | API/Integration | AC-14, BR-25 | `GET /api/tickets` with a filter matching nothing, on a Requester whose unfiltered `totalCount` is > 0 | Filtered `data: []` while unfiltered request for the same Requester is non-empty | `server/tests/lab-02/my-tickets.api.test.ts` | |
| API-33 | API/Integration | FR-08 | `GET /api/tickets/:id` owned | 200, Ticket representation plus `attachments: []` | `server/tests/lab-02/ticket-detail.api.test.ts` | |
| API-34 | API/Integration | AC-03, BR-10, BR-36 | `GET /api/tickets/:id` owned by a different Requester | 404, `"Not found"` | `server/tests/lab-02/ticket-detail.api.test.ts` | |
| API-35 | API/Integration | BR-36 | `GET /api/tickets/:id` nonexistent id | 404, body byte-identical to API-34's | `server/tests/lab-02/ticket-detail.api.test.ts` | |
| API-36 | API/Integration | api-spec.md §0.1 | `GET /api/tickets/:id` missing `X-Requester-Id` | 400 | `server/tests/lab-02/ticket-detail.api.test.ts` | |
| API-37 | API/Integration | api-spec.md §0.1 | `GET /api/tickets/:id` header not an active Requester | 403 | `server/tests/lab-02/ticket-detail.api.test.ts` | |
| API-38 | API/Integration | AC-15, BR-39 | `POST /api/tickets/:id/attachments` 1 valid file | 201, `isRemoved: false`; parent Ticket's `updatedAt` advances | `server/tests/lab-02/attachments.api.test.ts` | |
| API-39 | API/Integration | AC-16, BR-28 | `POST /api/tickets/:id/attachments` on a Ticket already at 5 active, +1 file | 409 `"Attachment limit reached"`; the existing 5 are unchanged | `server/tests/lab-02/attachments.api.test.ts` | |
| API-40 | API/Integration | AC-17, BR-29 | `POST /api/tickets/:id/attachments` 6 files in one request | 409 `"Too many files in this request"`; none of the 6 stored | `server/tests/lab-02/attachments.api.test.ts` | |
| API-41 | API/Integration | AC-19, BR-26 | `POST /api/tickets/:id/attachments` unsupported file type | 415 `"Unsupported file type"`; none stored | `server/tests/lab-02/attachments.api.test.ts` | |
| API-42 | API/Integration | BR-27 | `POST /api/tickets/:id/attachments` file >5 MB | 413 `"File exceeds 5 MB"`; none stored | `server/tests/lab-02/attachments.api.test.ts` | |
| API-43 | API/Integration | api-spec.md §7 precedence rule | Batch that is simultaneously >5 files, oversized, and wrong-typed | 409 wins (409 → 415 → 413 precedence); none stored | `server/tests/lab-02/attachments.api.test.ts` | |
| API-44 | API/Integration | BR-30, specification.md Assumption 9 | Batch of ≤5 files where exactly one has a bad type | Whole batch rejected (415); none stored, including the otherwise-valid files | `server/tests/lab-02/attachments.api.test.ts` | |
| API-45 | API/Integration | api-spec.md §7 | `POST /api/tickets/:id/attachments` with the `files` field missing/empty | 400, checked before the ownership/count checks | `server/tests/lab-02/attachments.api.test.ts` | |
| API-46 | API/Integration | api-spec.md §12 OQ-9 | `POST /api/tickets/:id/attachments` to a nonexistent/not-owned Ticket | 404, checked after 400 and before 409 | `server/tests/lab-02/attachments.api.test.ts` | |
| API-47 | API/Integration | api-spec.md §8 | `GET /api/tickets/:ticketId/attachments/:attachmentId` | 200, metadata only, includes `isRemoved`/`removedAt`/`removalReason` | `server/tests/lab-02/attachments.api.test.ts` | |
| API-48 | API/Integration | BR-10 | `GET /api/tickets/:ticketId/attachments/:attachmentId` not found/not owned | 404 | `server/tests/lab-02/attachments.api.test.ts` | |
| API-49 | API/Integration | FR-10, BR-35 | `GET .../download` on an active attachment | 200, binary stream, `Content-Type` from stored `mimeType` | `server/tests/lab-02/attachments.api.test.ts` | |
| API-50 | API/Integration | AC-21, BR-32 | `GET .../download` on a removed attachment, requested by its own owner | 404, no file content | `server/tests/lab-02/attachments.api.test.ts` | |
| API-51 | API/Integration | BR-10 | `GET .../download` not owned | 404 | `server/tests/lab-02/attachments.api.test.ts` | |
| API-52 | API/Integration | AC-20, BR-31, BR-32 | `DELETE .../attachments/:id` with a reason | 200, `isRemoved: true`, `removedAt` set, `removalReason` stored; metadata still readable via GET | `server/tests/lab-02/attachments.api.test.ts` | |
| API-53 | API/Integration | BR-34 | `DELETE .../attachments/:id` with no `reason` | 200, `removalReason: null` | `server/tests/lab-02/attachments.api.test.ts` | |
| API-54 | API/Integration | BR-34 | `DELETE .../attachments/:id` with `reason` at exactly 200 chars | 200, succeeds (upper boundary) | `server/tests/lab-02/attachments.api.test.ts` | |
| API-55 | API/Integration | api-spec.md §10 | `DELETE .../attachments/:id` already removed | 409 `"Attachment already removed"` | `server/tests/lab-02/attachments.api.test.ts` | |
| API-56 | API/Integration | BR-10 | `DELETE .../attachments/:id` not owned/not found | 404 | `server/tests/lab-02/attachments.api.test.ts` | |
| API-57 | API/Integration | AC-08, BR-20 | `POST /api/tickets` succeeds, then its only attachment upload fails (oversized) | Ticket is retained and still fetchable via `GET /api/tickets/:id`; the failed attachment is not stored | `server/tests/lab-02/attachments.api.test.ts` | |
| API-58 | API/Integration | BR-11 (§8 OQ-TEST-1) | `POST /api/tickets` missing `Idempotency-Key` header | 400, `field: "Idempotency-Key"`, `"Missing or invalid idempotency key"`; no Ticket created | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-59 | API/Integration | BR-11 (§8 OQ-TEST-1) | `POST /api/tickets` `Idempotency-Key` present but not a valid UUID (e.g. `"abc"`) | 400, `field: "Idempotency-Key"`, `"Missing or invalid idempotency key"`; no Ticket created | `server/tests/lab-02/create-ticket.api.test.ts` | |
| API-60 | API/Integration | BR-34 (§8 OQ-TEST-2) | `DELETE .../attachments/:id` with `reason` at 201 chars (one over the boundary) | 400, `field: "reason"`, `"Reason must be 200 characters or fewer"`; attachment not removed | `server/tests/lab-02/attachments.api.test.ts` | |

### 2.3 UI Component

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI Component | AC-26 | Requester Selection dropdown, mocked active-only response | Only active Requesters render as options | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-02 | UI Component | ui-spec.md §11 | Continue button state | Disabled with no selection; enabled once one is chosen | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-03 | UI Component | BR-07 | Continue click | Writes the selection to `sessionStorage`, navigates to My Tickets | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-04 | UI Component | ui-spec.md §11 | Loading state | Spinner + "Loading Requesters…" while the request is pending | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-05 | UI Component | ui-spec.md §11 | Empty state, API returns `[]` | "No active Development Requesters are available." message; Continue stays disabled | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-06 | UI Component | ui-spec.md §11 | Failure state, API rejects | `.state-banner--error` with "Couldn't load Development Requesters." and a Retry button | `client/tests/lab-02/RequesterSelect.test.tsx` | |
| UI-07 | UI Component | AC-27 | Create Ticket initial render | Ticket Number placeholder, today's Date, Requester name — all read-only | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-08 | UI Component | AC-04 | Submit with empty Summary | Inline message renders under the field; no API request is sent | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-09 | UI Component | BR-19 | 400 response from the server | Already-entered field values and selected attachment chips are preserved, not cleared | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-10 | UI Component | AC-06, BR-13 | Submit clicked twice quickly | Busy style + "Submitting…" after the first click; the second click is a no-op | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-11 | UI Component | AC-23 | Network/API failure on submit | Failure state renders; entered field values are preserved | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-12 | UI Component | AC-01 | Successful creation | Ticket Number and a "View Ticket" link render | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-13 | UI Component | AC-08, BR-20 | Ticket created, attachment upload failed | Success sub-state: Ticket Number still shown, plus a Warning-token banner linking to Ticket Detail | `client/tests/lab-02/CreateTicketForm.test.tsx` | |
| UI-14 | UI Component | AC-18 | Selecting a file >5 MB | Invalid chip with "File exceeds 5 MB"; excluded from the submit payload | `client/tests/lab-02/AttachmentPicker.test.tsx` | |
| UI-15 | UI Component | AC-19 | Selecting an unsupported file type | Invalid chip with "Unsupported file type"; excluded from the payload | `client/tests/lab-02/AttachmentPicker.test.tsx` | |
| UI-16 | UI Component | BR-28, BR-29 | Selecting a 6th file when 5 are already selected | Batch-level banner "Up to 5 attachments allowed"; the newest addition is rejected | `client/tests/lab-02/AttachmentPicker.test.tsx` | |
| UI-17 | UI Component | ui-spec.md §6 | Chip "✕" control | Removes that file from the selection | `client/tests/lab-02/AttachmentPicker.test.tsx` | |
| UI-18 | UI Component | ui-spec.md §7 | My Tickets loading state | Skeleton rows/cards render while the GET is in flight | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-19 | UI Component | ui-spec.md §13.2 | Populated list, desktop | All 7 columns render with correctly mapped values | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-20 | UI Component | AC-13, BR-25 | Empty state | "No tickets yet" heading + Create Ticket action; toolbar hidden | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-21 | UI Component | AC-14, BR-25 | No-results state | "No tickets match your search" heading + enabled Clear Filters; toolbar stays visible | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-22 | UI Component | ui-spec.md §13.1 | Clear Filters enable/disable | Disabled with no active search/filter; enabled once one is applied | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-23 | UI Component | ui-spec.md §13.2 | Clicking a sortable column header | Toggles `sortDir`; the ▲/▼ glyph updates to match | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-24 | UI Component | ui-spec.md §13.5 (OQ-UI-3) | Page-size select | Changing it updates `pageSize` and resets to page 1 | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-25 | UI Component | ui-spec.md §7 | My Tickets failure state | `.state-banner--error` with a Retry action | `client/tests/lab-02/MyTickets.test.tsx` | |
| UI-26 | UI Component | FR-08 | Ticket Detail loaded state | Read-only header fields + Attachments panel; Priority/Status render as badges | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-27 | UI Component | AC-03, BR-36 | Ticket Detail 404 (missing vs. cross-Requester) | Identically-worded not-found panel with a "Back to My Tickets" link in both cases | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-28 | UI Component | AC-20, BR-34 | Remove Attachment | Confirmation panel with optional Reason field; only Confirm calls the DELETE | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-29 | UI Component | ui-spec.md §17 | Removed attachment row | Muted styling, "Removed" label + date/reason; no Preview/Download/Remove controls | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-30 | UI Component | ui-spec.md §17 | Preview/Download click that resolves 404 | Transient inline error; the action is disabled until the list refreshes | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-31 | UI Component | ui-spec.md §7 | Ticket Detail loading state | Skeleton renders before data resolves | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-32 | UI Component | BR-35 | Preview action | Opens the download URL in a new browser tab, not an in-app viewer | `client/tests/lab-02/TicketDetail.test.tsx` | |
| UI-33 | UI Component | ui-spec.md §10 | Active nav link | Carries the underline styling class and `aria-current="page"` together | `client/tests/lab-02/AppShell.test.tsx` | |
| UI-34 | UI Component | ui-spec.md §10 | Change Requester click | Clears `sessionStorage` and routes to Requester Selection with no confirmation step | `client/tests/lab-02/AppShell.test.tsx` | |

### 2.4 UI Style

Every row asserts on the exact class names fixed in `ui-spec.md` §19 — none
of the classes below are invented for this document.

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| STYLE-01 | UI Style | ui-spec.md §3, §19 | Read-only fields (Ticket Number, Date, Requester, Current Status) | `field__control--readonly` class present | `client/tests/lab-02/style/field-states.style.test.tsx` | |
| STYLE-02 | UI Style | ui-spec.md §4, §19 | An invalid field after validation failure | `field__control--invalid` on the control, `field__message field__message--error` on its message | `client/tests/lab-02/style/field-states.style.test.tsx` | |
| STYLE-03 | UI Style | ui-spec.md §3, §19 | A disabled control | `field__control--disabled` class present | `client/tests/lab-02/style/field-states.style.test.tsx` | |
| STYLE-04 | UI Style | ui-spec.md §4, §19 | A required field's label | `field__required-marker` span renders the asterisk | `client/tests/lab-02/style/field-states.style.test.tsx` | |
| STYLE-05 | UI Style | ui-spec.md §5, §19 | Each button tier | `btn--primary` / `btn--secondary` / `btn--tertiary` / `btn--destructive` applied correctly per tier | `client/tests/lab-02/style/buttons.style.test.tsx` | |
| STYLE-06 | UI Style | ui-spec.md §5, §19 | Submit while a request is pending | `btn--busy` class plus a `btn__spinner` element | `client/tests/lab-02/style/buttons.style.test.tsx` | |
| STYLE-07 | UI Style | ui-spec.md §14.1, §19 | Requested Priority badge per value | `badge--priority-low` / `-medium` / `-high` render for `LOW`/`MEDIUM`/`HIGH` | `client/tests/lab-02/style/badges.style.test.tsx` | |
| STYLE-08 | UI Style | ui-spec.md §14.2, §19 | Current Status badge | `badge--status-new` renders for `NEW` | `client/tests/lab-02/style/badges.style.test.tsx` | |
| STYLE-09 | UI Style | ui-spec.md §6, §19 | Attachment picker elements | `attachment-picker__dropzone`, `__chip`, `__chip--invalid`, `__chip-remove`, `__error` all present as expected | `client/tests/lab-02/style/attachment-picker.style.test.tsx` | |
| STYLE-10 | UI Style | ui-spec.md §17, §19 | Attachment row states | `attachment-item--active` / `--uploading` / `--removed` / `--unavailable` applied per state | `client/tests/lab-02/style/attachment-list.style.test.tsx` | |
| STYLE-11 | UI Style | ui-spec.md §7, §19 | Every screen state | `state-banner--loading` / `--empty` / `--no-results` / `--error` / `--success` / `--warning` each render for their corresponding condition | `client/tests/lab-02/style/state-banners.style.test.tsx` | |
| STYLE-12 | UI Style | ui-spec.md §13.1, §19 | My Tickets toolbar controls | `ticket-toolbar__search`, `__filter`, `__page-size`, `__clear-filters-btn` all present | `client/tests/lab-02/style/my-tickets-toolbar.style.test.tsx` | |
| STYLE-13 | UI Style | ui-spec.md §13.2, §19 | Sortable column header | `ticket-table__header--sortable` and `ticket-table__sort-icon` present | `client/tests/lab-02/style/my-tickets-toolbar.style.test.tsx` | |
| STYLE-14 | UI Style | ui-spec.md §13.5, §19 | Pagination controls | `pagination__page-btn--active` on the current page; `pagination__prev` / `__next` present | `client/tests/lab-02/style/my-tickets-toolbar.style.test.tsx` | |
| STYLE-15 | UI Style | ui-spec.md §13.3, §19 | Mobile card view (<768px) | `ticket-card`, `ticket-card__priority-badge`, `ticket-card__status-badge` present | `client/tests/lab-02/style/my-tickets-toolbar.style.test.tsx` | |
| STYLE-16 | UI Style | ui-spec.md §10, §19 | App shell nav/controls | `app-shell__nav-link--active`, `app-shell__change-requester-btn`, `app-shell__mobile-toggle` present | `client/tests/lab-02/style/app-shell.style.test.tsx` | |

### 2.5 Responsive

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| RESP-01 | Responsive | AC-24 | My Tickets at <768px | `.ticket-card` stacked cards render, no `.ticket-table`, no horizontal page scroll | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-02 | Responsive | ui-spec.md §8 | My Tickets at 768–991px | Table renders with narrower columns; Category may abbreviate | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-03 | Responsive | ui-spec.md §8 | My Tickets at ≥992px | Full 7-column table renders | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-04 | Responsive | ui-spec.md §8 | Create Ticket across breakpoints | Two-column grid on desktop; one column with Attachments below the main fields on mobile | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-05 | Responsive | ui-spec.md §8, §10 | App shell at <768px | Nav + Requester display collapse into `.app-shell__mobile-toggle`; opening it reveals a stacked full-width menu | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-06 | Responsive | ui-spec.md §8 | Ticket Detail header grid | 4 columns desktop, 2 columns tablet, 1 column mobile | `e2e/lab-02/responsive-visual.spec.ts` | |
| RESP-07 | Responsive | ui-spec.md §18, specification.md §10 | Screenshot capture | One screenshot captured at every path fixed in `ui-spec.md` §18, at every listed viewport | `e2e/lab-02/responsive-visual.spec.ts` | |

### 2.6 E2E

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-15, AC-27 | Full happy path | Select Requester → Create Ticket with 1 attachment → success shows Ticket Number → View Ticket → Ticket Detail shows matching data and the active attachment | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-02 | E2E | AC-02 | Opening My Tickets with no Requester selected | Redirects to the Requester Selection screen | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-03 | E2E | AC-04 | Submitting Create Ticket with invalid data | Inline validation renders; the form is not navigated away from | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-04 | E2E | AC-09, AC-10, AC-11, AC-12 | My Tickets search/filter/sort/paginate against the seeded ~25-Ticket Requester | Result sets update correctly end-to-end through the real API | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-05 | E2E | AC-20 | Ticket Detail: add then remove (with reason) an attachment | Row updates to the removed state in place, no page reload | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-06 | E2E | AC-22, BR-08 | Change Requester mid-session, A → B | Requester A's Tickets disappear; Requester B's own Tickets load | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-07 | E2E | AC-25 | Keyboard-only navigation of Requester Selection | Dropdown and Continue reachable/operable via Tab/Enter, with a visible focus indicator at each stop | `e2e/lab-02/requester-ticket-flow.spec.ts` | |
| E2E-08 | E2E | AC-03 | Requester B opens Requester A's Ticket Detail URL directly | Not-found panel renders, same as a nonexistent Ticket | `e2e/lab-02/requester-ticket-flow.spec.ts` | |

---

## 3. Acceptance-Criterion Traceability

Every AC-01 through AC-27 maps to at least one test below.

| AC | Tests |
|---|---|
| AC-01 | API-04, UI-12, E2E-01 |
| AC-02 | E2E-02 |
| AC-03 | API-34, API-35, UI-27, E2E-08 |
| AC-04 | API-07, UI-08, E2E-03 |
| AC-05 | API-12 |
| AC-06 | API-14, UI-10 |
| AC-07 | API-09 |
| AC-08 | API-57, UI-13 |
| AC-09 | API-18, E2E-04 |
| AC-10 | API-23, E2E-04 |
| AC-11 | API-25, E2E-04 |
| AC-12 | API-29, E2E-04 |
| AC-13 | API-31, UI-20 |
| AC-14 | API-32, UI-21 |
| AC-15 | API-38, E2E-01 |
| AC-16 | API-39 |
| AC-17 | API-40 |
| AC-18 | UNIT-06, UI-14 |
| AC-19 | UNIT-07, UI-15, API-41 |
| AC-20 | API-52, UI-28, E2E-05 |
| AC-21 | API-50 |
| AC-22 | E2E-06 |
| AC-23 | UI-09, UI-11 |
| AC-24 | RESP-01 |
| AC-25 | E2E-07 |
| AC-26 | API-03, UI-01 |
| AC-27 | API-04, UI-07, E2E-01 |

---

## 4. Responsive and Visual Checklist

Checked at the three breakpoints fixed by labsheet §8.7 / `ui-spec.md` §8.
Each row's screenshot path is fixed by `ui-spec.md` §18; `{viewport}`
expands to `desktop`, `tablet`, or `mobile`.

| Screen | Desktop (≥992px) | Tablet (768–991px) | Mobile (<768px) | Screenshot path(s) | Verified |
|---|---|---|---|---|---|
| Requester Selection | loading, loaded, empty, failure | — | — | `create-ticket/requester-select-{state}-desktop.png` | |
| Create Ticket | 2-column grid | 2-column, Summary/Description full-width rows | 1 column, Attachments below main fields | `create-ticket/create-ticket-initial-{viewport}.png` (+ validation/submitting/success/failure/invalid-attachment, desktop only) | |
| My Tickets | 7-column table | table, narrower columns, Category may abbreviate | `.ticket-card` stacked cards, no horizontal scroll | `my-tickets/my-tickets-list-{viewport}.png` (+ loading/empty/no-results/failure/requester-switch, desktop only) | |
| Ticket Detail | 4-column header grid | 2-column header grid | 1-column header, Attachments always full-width | `ticket-detail/ticket-detail-loaded-{viewport}.png` (+ removed-attachment/remove-confirm/not-found, desktop only) | |
| App shell | full horizontal nav | full horizontal nav | hamburger toggle, stacked full-width menu | covered within each screen's own screenshots above | |

Non-viewport visual checks (all asserted via `RESP-*`/`STYLE-*` and manually
reviewed against the screenshots above, per specification.md §10's "visually
verified against Playwright screenshots, not personal memory"):

- [ ] No clipped labels, overlapping messages, hidden buttons, or unreadable
      attachment names at any of the three breakpoints (labsheet §8.7).
- [ ] Read-only vs. editable field styling matches `ui-spec.md` §3 at every
      breakpoint.
- [ ] Badge rules (§14) — icon + colour + text, never colour alone.
- [ ] Busy Submit state (§5) is visible and legible at every breakpoint.
- [ ] Focus-visible outline (§3) is visible on every interactive control
      reached via keyboard.

---

## 5. Test Commands

### 5.1 One-time `toktickit_test` database setup

```
psql -U toktickit -h localhost -c "CREATE DATABASE toktickit_test;"
```

`server/.env.test` (not committed) points at it, mirroring `.env.example`'s
convention:

```
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public"
```

### 5.2 Migration in global setup

A `server/tests/globalSetup.ts`, referenced from `server/vitest.config.ts`
(`test.globalSetup`), loads `.env.test` and runs the migration exactly once
before any test file executes:

```
prisma migrate deploy --schema=prisma/schema.prisma
```

This never touches the development database, since `.env.test` — not
`.env` — supplies `DATABASE_URL` for the whole test run.

### 5.3 Truncation between tests

A `beforeEach`/`afterEach` hook (`server/tests/setup.ts`, wired via
`test.setupFiles`) truncates every application table and restarts identity
sequences, so each test starts from a known-empty state and seeds only the
fixtures it needs:

```sql
TRUNCATE TABLE "Attachment", "Ticket", "RequesterUser", "RelatedSystem", "Category"
RESTART IDENTITY CASCADE;
```

### 5.4 Running each suite

```
cd server && npm test        # Unit + API/Integration (Vitest + Supertest)
cd client && npm test        # UI Component + UI Style (Vitest + RTL, jsdom, no DB/network)
cd e2e && npx playwright test   # Responsive + E2E (Playwright, real browser)
```

The E2E/Responsive suite requires the server and client dev servers running
against a seeded database (`npm run prisma:seed` produces the ~25/~5/0
distribution specification.md §7 describes) — not `toktickit_test`, since
that database is truncated between every Vitest test and would never hold
data long enough for Playwright to exercise it.

---

## 6. Final Results

Not yet run. This plan was written before the Lab 2 client/server
implementation, following the same spec-first order as
`specification.md` → `api-spec.md` → `ui-spec.md` → this document. Once the
test files above exist and the full suite passes with zero skipped/todo
tests (specification.md §10 Definition of Done), this section is replaced
with the actual command output for each of the four `npm test`/
`npx playwright test` runs — in the same format as `docs/lab-01/tests.md`'s
"Passing runs" section — and every row's `Final` column above is filled in
(pass/fail, not left blank).

---

## 7. Known Limitations or Deferred Tests

- **BR-37 is intentionally untested.** It states that the
  `X-Requester-Id`/selector mechanism is a temporary substitute for
  authentication with no cryptographic identity guarantee — a constraint on
  what the Requester context is *allowed to be*, not an observable
  behaviour. There is nothing to assert against: every behaviour that BR-37
  motivates (ownership checks, 404-on-cross-access, the header-validation
  table) is already covered by API-05/06/16/17/34–37/46/48/51/56 and does
  not depend on BR-37's wording itself.
- **True concurrent-request races beyond API-14 are not exercised.**
  API-14 fires two `Promise.all`-parallel requests sharing one
  `Idempotency-Key` against the real DB unique constraint, which is
  sufficient to prove the constraint (not just application logic) enforces
  BR-11/BR-12, but it doesn't guarantee the same interleaving on every test
  run; this is accepted as a property test rather than a fully deterministic
  one.
- **BR-38's bounded-retry exhaustion (6 consecutive collisions) is not
  integration-tested.** Forcing 5 consecutive real unique-constraint
  collisions on `ticketNumber` would require manipulating the DB sequence
  counter in a way no fixture in this plan sets up; the retry-loop mechanics
  themselves are covered at the unit level instead (UNIT-02, mocked insert).
- **Genuine 500 (unexpected server error) paths are not forced through the
  real API/DB stack.** Deliberately triggering an unhandled server
  exception in an integration test (e.g. killing the DB connection
  mid-request) is impractical to do deterministically; the 500-handling UI
  behaviour is instead verified at the component level via a mocked
  rejected fetch (UI-06, UI-11, UI-25).
- **No automated pixel-diffing.** Responsive/visual correctness is verified
  by DOM/class assertions (RESP-01–06) plus manually reviewed Playwright
  screenshots at the fixed `ui-spec.md` §18 paths (RESP-07) — matching
  specification.md §10's "visually verified against Playwright screenshots,
  not personal memory," which requires screenshot evidence but not
  automated visual-regression tooling.
- **No dedicated "IT Priority"/"Ticket Owner" absence tests.** Both fields
  are entirely absent from the schema, API representations, and rendered
  field lists (specification.md §3/§11); the fixed representations and
  column/field lists already asserted by API-04/UI-07/UI-19/UI-26 leave no
  additional surface to test the absence of.

---

## 8. Resolved decisions

Three gaps this plan flagged as open questions were silences in
`api-spec.md`, not in this test plan itself — so they were fixed there
first (and mirrored into `specification.md` §8), then closed out here with
the new tests API-58–API-60 (§2.2).

- **OQ-TEST-1**: The exact 400 response when `Idempotency-Key` is missing
  or malformed on `POST /api/tickets`. **Decision:** 400 with
  `{ errors: [{ "field": "Idempotency-Key", "message": "Missing or invalid
  idempotency key" }] }`, added to the endpoint's field-validation 400
  trigger table (api-spec.md §4, specification.md §8). **Reason:** keeps
  `Idempotency-Key` validation inside the same body-validation shape already
  used for every other `POST /api/tickets` field, rather than leaving it
  undefined.
- **OQ-TEST-2**: The response when a `DELETE .../attachments/:id` request's
  `reason` exceeds 200 characters. **Decision:** 400 with
  `{ errors: [{ "field": "reason", "message": "Reason must be 200 characters
  or fewer" }] }`, added as a new response row (api-spec.md §10,
  specification.md §8). **Reason:** BR-34's 200-character limit needs an
  observable failure response to be enforceable, not just a documented
  limit with no defined outcome for violating it.
- **OQ-TEST-3**: The response when BR-38's bounded 5-attempt Ticket Number
  retry is exhausted. **Decision:** the generic 500
  (`{ "error": "Unexpected server error" }`), with no distinct status or
  body, stated explicitly in api-spec.md §4. **Reason:** retry exhaustion is
  an unexpected, not a user-correctable, failure — it belongs with every
  other unexpected-failure path rather than inventing a new error shape for
  one rare case. Still not integration-tested, for the reasons in §7.
