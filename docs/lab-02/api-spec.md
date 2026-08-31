# Lab 2 API Specification

Source of truth: `specification.md` (merged, authoritative). This document
expands specification.md §8 into per-endpoint detail. It does not add,
narrow, or contradict any FR/BR/AC — every rule below cites the
specification.md item it enforces. Nine details specification.md did not
originally fix were resolved and are recorded, with their answer and
reason, in §12 Resolved Decisions. Two of those resolutions also amend
specification.md itself: OQ-2 renames the `GET /api/tickets` category
filter to `categoryId` in specification.md §8, and OQ-7 makes BR-23's
id-descending tiebreaker universal rather than default-only.

No code, UI, or test content is included; see `ui-spec.md` and `tests.md`
for those.

---

## 0. Conventions

### 0.1 Which endpoints require `X-Requester-Id`

specification.md §8 states: "All Ticket/Attachment endpoints require an
`X-Requester-Id` header identifying the acting Development Requester." Read
literally, this scopes the requirement to endpoints that operate on a
Ticket or Attachment resource. The three reference-data endpoints (§1–§3
below) are not Ticket/Attachment endpoints and are read below as **not**
requiring the header — consistent with `GET /api/requesters` being the
endpoint that populates the selector *before* any Requester is chosen
(FR-01), which could not work if it itself demanded a chosen Requester's id.

Endpoints requiring `X-Requester-Id`: `POST /api/tickets`,
`GET /api/tickets`, `GET /api/tickets/:id`,
`POST /api/tickets/:id/attachments`,
`GET /api/tickets/:ticketId/attachments/:attachmentId`,
`GET /api/tickets/:ticketId/attachments/:attachmentId/download`,
`DELETE /api/tickets/:ticketId/attachments/:attachmentId`.

For every one of those endpoints, the header is validated the same way
before any endpoint-specific logic runs:

| Header value | Response |
|---|---|
| Missing | `400` — `{ "errors": [{ "field": "X-Requester-Id", "message": "Missing or invalid requester header" }] }` |
| Present but not an integer | `400` — `{ "errors": [{ "field": "X-Requester-Id", "message": "Missing or invalid requester header" }] }` |
| Valid integer, no active RequesterUser with that id | `403` — `{ error: "Selected Requester is not active" }` |
| Valid integer, matches an active RequesterUser | proceeds to endpoint logic, scoped to that Requester (FR-14, BR-09) |

This enforces BR-09 (ownership checked on every read/write), BR-37 (the
header is Lab 2's temporary auth substitute), and is what makes BR-10/BR-36
(cross-Requester access → 404) and BR-04 (Requester fixed server-side, not
client-supplied in the body) possible.

Per-endpoint sections below reference this table rather than repeating it,
except where an endpoint has additional header-driven behavior (e.g.
`Idempotency-Key` on `POST /api/tickets`).

### 0.2 Fixed error body shapes

specification.md §8 fixes these shapes for every endpoint in this API — no
endpoint below overrides them:

- **400** (field validation failure): `{ errors: [{ field, message }] }` —
  one entry per invalid field.
- **403 / 404 / 409 / 413 / 415 / 500**: `{ error: string }` — a single
  generic message with no per-field detail, since none of these originate
  from one specific form field.

Fixed wordings (specification.md §8, "Error response bodies"):

| Status | Body |
|---|---|
| 403 | `{ "error": "Selected Requester is not active" }` |
| 404 | `{ "error": "Not found" }` — identical wording whether the resource is missing or owned by a different Requester (BR-10, BR-36) |
| 409 (too many files) | `{ "error": "Too many files in this request" }` |
| 409 (attachment cap) | `{ "error": "Attachment limit reached" }` |
| 409 (double removal) | `{ "error": "Attachment already removed" }` |
| 413 | `{ "error": "File exceeds 5 MB" }` |
| 415 | `{ "error": "Unsupported file type" }` |
| 500 | `{ "error": "Unexpected server error" }` — the real error is logged server-side only |

### 0.3 Resource representations

These field sets are assembled from specification.md §7 (Data Changes) and
the explicit response shapes fixed in §8. They are reused across the
endpoints below rather than redefined per endpoint.

**Ticket representation** — one shared shape across create, list, and
detail (Resolved Decision OQ-3, §12): `POST /api/tickets` returns exactly
this; `GET /api/tickets` list items use it unchanged; `GET /api/tickets/:id`
uses it with `attachments: Attachment[]` added, nothing else:

```
{
  id: integer,
  ticketNumber: string,        // "TKT-YYYY-NNNNNN", BR-01
  requesterId: integer,
  categoryId: integer,
  relatedSystemId: integer,
  summary: string,
  description: string,
  requestedPriority: "LOW" | "MEDIUM" | "HIGH",
  status: "NEW",
  createdAt: string,            // ISO 8601
  updatedAt: string             // ISO 8601
}
```

`idempotencyKey` is a stored column (§7) but is not part of the fixed
response shape in §8 and is not exposed to the client.

**Attachment representation** (used by
`POST /api/tickets/:id/attachments`,
`GET /api/tickets/:ticketId/attachments/:attachmentId`, the `attachments[]`
array on `GET /api/tickets/:id`, and the `DELETE` response — all of which
specification.md §8 describes as "Attachment metadata" carrying the
removed-state fields):

```
{
  id: integer,
  ticketId: integer,
  originalFilename: string,
  mimeType: string,
  sizeBytes: integer,
  createdAt: string,             // ISO 8601
  isRemoved: boolean,
  removedAt: string | null,      // ISO 8601 or null
  removalReason: string | null
}
```

`storedFilename` is a stored column (§7) used server-side to locate the
file; per Resolved Decision OQ-4 (§12), it is never returned in any
client-facing response and is omitted above.

---

## 1. `GET /api/categories`

**Purpose**: active Categories, for the Create Ticket category dropdown
(existing Lab 1 endpoint; FR-02 depends on it, BR-17 enforces the
"currently active" constraint at ticket-creation time).

**Headers**: none required (§0.1).

**Params**: none.

**Responses**:

| Status | Body |
|---|---|
| 200 | `Array<{ id: integer, name: string }>`, ordered by `id` ascending, active rows only |
| 500 | `{ "error": string }` (§0.2) |

**Worked example — success**

```
GET /api/categories
```
```json
200 OK
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

**Worked example — failure**

```
GET /api/categories
```
```json
500 Internal Server Error
{ "error": "Unexpected server error" }
```
(Per Resolved Decision OQ-5, §12, this endpoint adopts the generic 500
wording rather than its prior implementation-specific text.)

---

## 2. `GET /api/related-systems`

**Purpose**: active Related Systems, for the Create Ticket related-system
dropdown. RelatedSystem "mirrors the existing Category shape" (§7), so its
list endpoint mirrors `GET /api/categories`. Enforces the same "must
reference a currently active row" constraint via BR-17 at ticket creation.

**Headers**: none required (§0.1).

**Params**: none.

**Responses**:

| Status | Body |
|---|---|
| 200 | `Array<{ id: integer, name: string }>`, ordered by `id` ascending, active rows only |
| 500 | `{ "error": string }` (§0.2) |

**Worked example — success**

```
GET /api/related-systems
```
```json
200 OK
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "VPN" },
  { "id": 3, "name": "Payroll Portal" },
  { "id": 4, "name": "Shared Drive" },
  { "id": 5, "name": "Ticketing System" },
  { "id": 6, "name": "Printer Fleet" }
]
```

**Worked example — failure**

```
GET /api/related-systems
```
```json
500 Internal Server Error
{ "error": "Unexpected server error" }
```

---

## 3. `GET /api/requesters`

**Purpose**: active Development Requesters, for the Requester Selection
screen dropdown (FR-01, BR-05). BR-06 means an inactive Requester's
tickets still exist but that Requester never appears here.

**Headers**: none required (§0.1) — this is the endpoint that runs
*before* a Requester is chosen.

**Params**: none.

**Responses**:

| Status | Body |
|---|---|
| 200 | `Array<{ id: integer, name: string }>`, active rows only (BR-05) — resolved per OQ-6, §12 |
| 500 | `{ "error": string }` (§0.2) |

**Worked example — success**

```
GET /api/requesters
```
```json
200 OK
[
  { "id": 1, "name": "Alex Rivera" },
  { "id": 2, "name": "Sam Okafor" },
  { "id": 3, "name": "Priya Nair" }
]
```
(`{ id, name }` only, matching the Category/RelatedSystem convention —
Resolved Decision OQ-6, §12. `email` is not returned.)

**Worked example — failure**

```
GET /api/requesters
```
```json
500 Internal Server Error
{ "error": "Unexpected server error" }
```

---

## 4. `POST /api/tickets`

**Purpose**: create a Ticket (FR-02), returning a server-generated Ticket
Number (FR-03, BR-01).

**Headers**:

| Header | Required | Rule |
|---|---|---|
| `X-Requester-Id` | yes | §0.1 table; fixes the Ticket's owner (BR-04) — the client cannot set `requesterId` via the body |
| `Idempotency-Key` | yes | UUID; BR-11. A repeated key from the same Requester returns the original Ticket instead of creating a duplicate (BR-11, BR-12, AC-05) |

**Path/query params**: none.

**Request body**:

```
{
  categoryId: integer,          // required; must reference an active Category (BR-17)
  relatedSystemId: integer,     // required; must reference an active RelatedSystem (BR-17)
  summary: string,              // required; trimmed server-side (BR-14), 5–120 chars after trim (BR-15)
  description: string,          // required; trimmed server-side (BR-14), 10–2000 chars after trim (BR-16)
  requestedPriority: "LOW" | "MEDIUM" | "HIGH"   // required (BR-18)
}
```

`requesterId` and `status` are never accepted in the body — `requesterId`
comes from `X-Requester-Id` (BR-04) and `status` is always `NEW` at
creation (BR-02).

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 201 | Ticket representation (§0.3) | created successfully |
| 200 | Ticket representation (§0.3), identical to the original creation, no new row | replay of a previously used `Idempotency-Key` for this Requester (BR-11) |
| 400 | `{ errors: [{ field, message }] }`, one entry per failing field | see table below |
| 400 | `{ "errors": [{ "field": "X-Requester-Id", "message": "Missing or invalid requester header" }] }` | `X-Requester-Id` missing/non-integer (§0.1) |
| 403 | `{ "error": "Selected Requester is not active" }` | `X-Requester-Id` valid integer but not an active Requester (§0.1) |
| 500 | `{ "error": "Unexpected server error" }` | unexpected failure (§0.2) |

Field-validation 400 triggers:

| `field` | Condition | BR |
|---|---|---|
| `categoryId` | missing, not an integer, or does not reference a currently active Category | BR-17 |
| `relatedSystemId` | missing, not an integer, or does not reference a currently active RelatedSystem | BR-17 |
| `summary` | missing, or trimmed length outside 5–120 | BR-14, BR-15 |
| `description` | missing, or trimmed length outside 10–2000 | BR-14, BR-16 |
| `requestedPriority` | missing or not one of `LOW`/`MEDIUM`/`HIGH` | BR-18 |
| `Idempotency-Key` | missing, or not a valid UUID | BR-11 |

On any 400, no Ticket is created (BR-19); the client is responsible for
preserving already-entered field values (a `ui-spec.md`/client concern, not
part of the response body).

BR-38's Ticket Number generation retries up to 5 times on a `ticketNumber`
unique-constraint collision. If all 5 attempts collide, the request fails
with the generic 500 (`{ "error": "Unexpected server error" }`, §0.2) — there
is no distinct status or body for retry exhaustion.

**Worked example — success (first submission)**

```
POST /api/tickets
X-Requester-Id: 2
Idempotency-Key: 3fa85f64-5717-4562-b3fc-2c963f66afa6
Content-Type: application/json

{
  "categoryId": 2,
  "relatedSystemId": 4,
  "summary": "Laptop won't power on after firmware update",
  "description": "Laptop screen stays black after the scheduled firmware update finished overnight. Power light is on but nothing else responds.",
  "requestedPriority": "HIGH"
}
```
```json
201 Created
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 2,
  "categoryId": 2,
  "relatedSystemId": 4,
  "summary": "Laptop won't power on after firmware update",
  "description": "Laptop screen stays black after the scheduled firmware update finished overnight. Power light is on but nothing else responds.",
  "requestedPriority": "HIGH",
  "status": "NEW",
  "createdAt": "2026-08-29T10:15:00.000Z",
  "updatedAt": "2026-08-29T10:15:00.000Z"
}
```

**Worked example — replay of the same `Idempotency-Key` (AC-05)**

```
POST /api/tickets
X-Requester-Id: 2
Idempotency-Key: 3fa85f64-5717-4562-b3fc-2c963f66afa6
Content-Type: application/json

{
  "categoryId": 2,
  "relatedSystemId": 4,
  "summary": "Laptop won't power on after firmware update",
  "description": "Laptop screen stays black after the scheduled firmware update finished overnight. Power light is on but nothing else responds.",
  "requestedPriority": "HIGH"
}
```
```json
200 OK
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 2,
  "categoryId": 2,
  "relatedSystemId": 4,
  "summary": "Laptop won't power on after firmware update",
  "description": "Laptop screen stays black after the scheduled firmware update finished overnight. Power light is on but nothing else responds.",
  "requestedPriority": "HIGH",
  "status": "NEW",
  "createdAt": "2026-08-29T10:15:00.000Z",
  "updatedAt": "2026-08-29T10:15:00.000Z"
}
```
No second row is created; the same `id`/`ticketNumber` is returned.

**Worked example — failure (AC-04, AC-07)**

```
POST /api/tickets
X-Requester-Id: 2
Idempotency-Key: 6b1f0c2a-9d3e-4a11-8c2f-1e9b7d4a5f10
Content-Type: application/json

{
  "categoryId": 9,
  "relatedSystemId": 4,
  "summary": "",
  "description": "Printer jam",
  "requestedPriority": "URGENT"
}
```
```json
400 Bad Request
{
  "errors": [
    { "field": "categoryId", "message": "Category is not active" },
    { "field": "summary", "message": "Summary is required" },
    { "field": "description", "message": "Description must be at least 10 characters" },
    { "field": "requestedPriority", "message": "Requested Priority must be LOW, MEDIUM, or HIGH" }
  ]
}
```
(specification.md fixes the field identified and the rule violated for
each of these body-validation entries, but not the literal `message`
text; wording shown is illustrative.)

---

## 5. `GET /api/tickets`

**Purpose**: paginated, searchable, filterable, sortable list of the
caller's own Tickets (FR-04, FR-05, FR-06, FR-07).

**Headers**: `X-Requester-Id` (§0.1) — every result is scoped to this
Requester only (BR-09); FR-04 guarantees the caller only ever sees their
own tickets, never a query parameter for another Requester's id.

**Query parameters**:

| Param | Type | Allowed values | Default | Rule |
|---|---|---|---|---|
| `search` | string | any | none (no filter) | matches Ticket Number by **prefix**, or Summary by **case-insensitive substring** (BR-21, FR-05) |
| `categoryId` | integer | any active Category `id` | none (no filter) | filters by Category (BR-22, FR-06) |
| `requestedPriority` | string | `LOW`, `MEDIUM`, `HIGH` | none (no filter) | filters by Requested Priority (BR-22, FR-06) |
| `status` | string | `NEW` (only value the enum can hold this sprint) | none (no filter) | filters by Current Status (BR-22, FR-06) |
| `sortBy` | string | `createdAt`, `summary`, `requestedPriority`, `status` | `createdAt` | FR-07, BR-23 |
| `sortDir` | string | `asc`, `desc` | `desc` | BR-23 |
| `page` | integer | ≥ 1 | `1` | 1-based (BR-24) |
| `pageSize` | integer | `10`, `20`, `50` | `10` | BR-24 |

`categoryId` is rejected with 400 if it is not an integer, or is an
integer that does not reference any existing Category row (active or
not) — an unknown `categoryId` here is a query-string malformation, not
the same thing as the `categoryId`/`relatedSystemId` **active-row**
reference check on `POST /api/tickets` (BR-17), which is a body
field-validation rule and rejects an inactive (not merely nonexistent)
row.

Default sort: `createdAt` descending, with Ticket `id` descending as a
tiebreaker (BR-23). The `id`-descending tiebreaker applies to every sort,
not only the default — see Resolved Decision OQ-7 in §12, which also
amends specification.md BR-23.

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 200 | `{ data: Ticket[], page: integer, pageSize: integer, totalCount: integer, totalPages: integer }` | success; `data` items use the shared Ticket representation (§0.3) |
| 400 | `{ errors: [{ field, message }] }` | invalid `categoryId`, `sortBy`, `sortDir`, `requestedPriority`, or `status` value |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

Out-of-range `page`/`pageSize` values are **clamped, not rejected** — they
never produce a 400. A `page` beyond the last available page returns an
empty `data` array, not an error (BR-24, AC-09 implicitly, since it
requires correct page-count metadata rather than an error path). Per
Resolved Decision OQ-8 (§12): `page` below 1 clamps to 1; `pageSize`
clamps to the nearest allowed value in `{10, 20, 50}`; the response's
`page`/`pageSize` fields echo the clamped values actually used, not the
values originally requested.

**Pagination metadata shape** (fixed by specification.md §8):

```
{
  data: Ticket[],
  page: integer,
  pageSize: integer,
  totalCount: integer,
  totalPages: integer
}
```

**Worked example — success (AC-09)**

```
GET /api/tickets?sortBy=createdAt&sortDir=desc&page=1&pageSize=10
X-Requester-Id: 1
```
```json
200 OK
{
  "data": [
    {
      "id": 67,
      "ticketNumber": "TKT-2026-000067",
      "requesterId": 1,
      "categoryId": 3,
      "relatedSystemId": 5,
      "summary": "Ticketing system login loop",
      "description": "Signing in redirects back to the login page repeatedly.",
      "requestedPriority": "MEDIUM",
      "status": "NEW",
      "createdAt": "2026-08-29T09:40:00.000Z",
      "updatedAt": "2026-08-29T09:40:00.000Z"
    }
    // ... 9 more Tickets
  ],
  "page": 1,
  "pageSize": 10,
  "totalCount": 25,
  "totalPages": 3
}
```

**Worked example — failure (invalid filter/sort value)**

```
GET /api/tickets?status=RESOLVED
X-Requester-Id: 1
```
```json
400 Bad Request
{
  "errors": [
    { "field": "status", "message": "Status must be NEW" }
  ]
}
```
(`RESOLVED` is not a value `TicketStatus` can hold in Lab 2 — see §7
Enums.)

---

## 6. `GET /api/tickets/:id`

**Purpose**: one owned Ticket with its Attachments (FR-08).

**Headers**: `X-Requester-Id` (§0.1).

**Path params**: `id` — integer, the Ticket's `id`.

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 200 | Ticket representation (§0.3) plus `attachments: Attachment[]` (§0.3 representation) | found and owned by caller |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 404 | `{ "error": "Not found" }` | Ticket does not exist, or is owned by a different Requester (BR-10, BR-36, AC-03) |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

**Worked example — success**

```
GET /api/tickets/42
X-Requester-Id: 2
```
```json
200 OK
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 2,
  "categoryId": 2,
  "relatedSystemId": 4,
  "summary": "Laptop won't power on after firmware update",
  "description": "Laptop screen stays black after the scheduled firmware update finished overnight. Power light is on but nothing else responds.",
  "requestedPriority": "HIGH",
  "status": "NEW",
  "createdAt": "2026-08-29T10:15:00.000Z",
  "updatedAt": "2026-08-29T10:15:00.000Z",
  "attachments": [
    {
      "id": 101,
      "ticketId": 42,
      "originalFilename": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 245678,
      "createdAt": "2026-08-29T10:16:00.000Z",
      "isRemoved": false,
      "removedAt": null,
      "removalReason": null
    }
  ]
}
```

**Worked example — failure (AC-03, cross-Requester access)**

```
GET /api/tickets/42
X-Requester-Id: 3
```
```json
404 Not Found
{ "error": "Not found" }
```
(Requester 3 is a valid, active Requester — just not the owner of Ticket
42 — so the response is indistinguishable from Ticket 42 not existing at
all, per BR-10/BR-36.)

---

## 7. `POST /api/tickets/:id/attachments`

**Purpose**: upload up to 5 files to an existing owned Ticket in one
request (FR-09).

**Headers**: `X-Requester-Id` (§0.1); ownership enforced per BR-33 (only
the owning Requester may add an attachment to their own Ticket).

**Content-Type**: `multipart/form-data`.

**Path params**: `id` — the target Ticket's id.

**Body**: field `files`, 1–5 entries (each an uploaded file).

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 201 | `Attachment[]` (§0.3 representation), one entry per stored file | all files in the batch pass validation and are stored |
| 400 | `{ "errors": [...] }` | malformed request only: `files` missing/empty, or `:id` is not a valid Ticket-id format. Checked before any file-content validation, since a malformed request can't be counted or inspected |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 404 | `{ "error": "Not found" }` | Ticket not found or not owned (BR-10, BR-36) |
| 409 | `{ "error": "Too many files in this request" }` | more than 5 files in the request (BR-29, AC-17) |
| 409 | `{ "error": "Attachment limit reached" }` | accepting the batch would push the Ticket's active-attachment count above 5 (BR-28, AC-16) |
| 415 | `{ "error": "Unsupported file type" }` | first file, in submission order, whose type is not JPG/JPEG/PNG/WEBP/PDF (BR-26, AC-19) |
| 413 | `{ "error": "File exceeds 5 MB" }` | first file, in submission order, that exceeds 5 MB — only checked once no file has already failed 409/415 (BR-27, AC-18) |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

**Precedence rule** (specification.md §8, exact): among the
content-validation codes, checks run in the fixed order **409 → 415 →
413**. The first failing check in that order determines the single
response status for the whole request. Regardless of which single file
caused the failure, **none of the files in the batch are stored** (BR-30,
AC-16, AC-17) — this is the same atomic-batch behavior specification.md
Assumption 9 applies uniformly to batches of any size ≤5, not only to the
>5-file wholesale-rejection case.

Full overall check order: **400 (malformed) → 404 (ticket lookup/
ownership) → 409 → 415 → 413** (Resolved Decision OQ-9, §12) — 404 is
checked second, after 400 and before 409.

A successful upload also updates the parent Ticket's `updatedAt` (BR-39),
which is what the My Tickets "Last Updated" column reflects.

**Worked example — success (AC-15)**

```
POST /api/tickets/42/attachments
X-Requester-Id: 2
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="files"; filename="error-dialog.jpg"
Content-Type: image/jpeg

<binary>
------X--
```
```json
201 Created
[
  {
    "id": 102,
    "ticketId": 42,
    "originalFilename": "error-dialog.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 812345,
    "createdAt": "2026-08-29T11:00:00.000Z",
    "isRemoved": false,
    "removedAt": null,
    "removalReason": null
  }
]
```

**Worked example — failure (AC-17, >5 files, precedence)**

```
POST /api/tickets/42/attachments
X-Requester-Id: 2
Content-Type: multipart/form-data; boundary=----X

(6 files attached, one of which is also oversized and one of which is
also an unsupported type)
```
```json
409 Conflict
{ "error": "Too many files in this request" }
```
(409 wins over the 415/413 conditions also present in the batch, per the
fixed 409 → 415 → 413 precedence. No files are stored.)

---

## 8. `GET /api/tickets/:ticketId/attachments/:attachmentId`

**Purpose**: Attachment metadata only, never the file body.

**Headers**: `X-Requester-Id` (§0.1).

**Path params**: `ticketId`, `attachmentId` — integers.

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 200 | Attachment representation (§0.3), including removed-state fields even if removed | found and owned |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 404 | `{ "error": "Not found" }` | not found, or not owned by caller (BR-10) |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

**Worked example — success**

```
GET /api/tickets/42/attachments/101
X-Requester-Id: 2
```
```json
200 OK
{
  "id": 101,
  "ticketId": 42,
  "originalFilename": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 245678,
  "createdAt": "2026-08-29T10:16:00.000Z",
  "isRemoved": false,
  "removedAt": null,
  "removalReason": null
}
```

**Worked example — failure**

```
GET /api/tickets/42/attachments/999
X-Requester-Id: 2
```
```json
404 Not Found
{ "error": "Not found" }
```

---

## 9. `GET /api/tickets/:ticketId/attachments/:attachmentId/download`

**Purpose**: stream an active Attachment's file; also used as "preview"
per BR-35 (opens directly in a new browser tab, no in-app viewer) (FR-10).

**Headers**: `X-Requester-Id` (§0.1).

**Path params**: `ticketId`, `attachmentId` — integers.

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 200 | binary file stream; `Content-Type` set from the stored `mimeType` | attachment found, owned, and active |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 404 | `{ "error": "Not found" }` | not found, not owned, **or the attachment is removed** (BR-32, AC-21) |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

A removed Attachment returns 404 here even to its own owning Requester —
BR-32 states no one can download or preview a removed Attachment.

**Worked example — success**

```
GET /api/tickets/42/attachments/101/download
X-Requester-Id: 2
```
```
200 OK
Content-Type: image/png

<binary file content>
```

**Worked example — failure (AC-21, removed attachment)**

```
GET /api/tickets/42/attachments/103/download
X-Requester-Id: 2
```
```json
404 Not Found
{ "error": "Not found" }
```
(Attachment 103 has been soft-removed; no file content is returned.)

---

## 10. `DELETE /api/tickets/:ticketId/attachments/:attachmentId`

**Purpose**: soft-remove an Attachment (FR-11).

**Headers**: `X-Requester-Id` (§0.1); ownership enforced per BR-33 (only
the owning Requester may remove an Attachment on their own Ticket).

**Path params**: `ticketId`, `attachmentId` — integers.

**Request body**:

```
{
  reason?: string    // optional, ≤200 chars (BR-34)
}
```

**Responses**:

| Status | Body | Trigger / BR |
|---|---|---|
| 200 | Attachment representation (§0.3) with `isRemoved: true`, `removedAt` set, `removalReason` set (or `null` if omitted) | removed successfully (BR-31, AC-20) |
| 400 | `{ "errors": [{ "field": "reason", "message": "Reason must be 200 characters or fewer" }] }` | `reason` exceeds 200 characters (BR-34) |
| 403 | `{ "error": "Selected Requester is not active" }` | §0.1 |
| 404 | `{ "error": "Not found" }` | not found or not owned (BR-10) |
| 409 | `{ "error": "Attachment already removed" }` | attachment was already soft-removed |
| 500 | `{ "error": "Unexpected server error" }` | §0.2 |

Removal is soft: the row is retained with `removedAt` and optional
`removalReason` set; the underlying file is never deleted from storage
(BR-31). The Attachment's metadata (filename, size, upload date, removal
date, and reason if provided) remains visible on Ticket Detail after
removal (BR-32). Removal also updates the parent Ticket's `updatedAt`
(BR-39).

**Worked example — success (AC-20)**

```
DELETE /api/tickets/42/attachments/101
X-Requester-Id: 2
Content-Type: application/json

{ "reason": "Duplicate of another attached screenshot" }
```
```json
200 OK
{
  "id": 101,
  "ticketId": 42,
  "originalFilename": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 245678,
  "createdAt": "2026-08-29T10:16:00.000Z",
  "isRemoved": true,
  "removedAt": "2026-08-29T11:30:00.000Z",
  "removalReason": "Duplicate of another attached screenshot"
}
```

**Worked example — failure (double removal)**

```
DELETE /api/tickets/42/attachments/101
X-Requester-Id: 2
Content-Type: application/json

{}
```
```json
409 Conflict
{ "error": "Attachment already removed" }
```

---

## 11. HTTP status summary

Reproduced from specification.md §8 for quick reference; not a separate
rule set.

| Status | Meaning in this API |
|---|---|
| 200 | Successful retrieval, or idempotent replay of a create |
| 201 | Resource created |
| 400 | Invalid input / field validation failure |
| 403 | `X-Requester-Id` does not match a currently active Requester |
| 404 | Resource missing, not owned by the caller, or removed (attachment download) |
| 409 | State conflict: attachment cap exceeded, >5 files in one request, double-removal |
| 413 | Uploaded file exceeds 5 MB |
| 415 | Uploaded file type not permitted |
| 500 | Unexpected server error; body never leaks internal detail |

---

## 12. Resolved decisions

These nine details were not fixed by the original specification.md.
Each is now resolved; the answer is applied throughout this document.
Two (OQ-2, OQ-7) also amend specification.md itself — see that document's
§8 (`GET /api/tickets` query line) and BR-23 respectively.

- **OQ-1**: The 400 returned when `X-Requester-Id` is missing or
  non-integer (§0.1) is
  `{ "errors": [{ "field": "X-Requester-Id", "message": "Missing or invalid requester header" }] }`.
  Reason: keeps the header check inside the same `{ field, message }`
  shape already fixed for body validation, just naming the header as the
  field.
- **OQ-2**: The `GET /api/tickets` category filter is `categoryId`
  (integer), not `category`. An invalid or unknown value returns 400 and
  is added to the endpoint's 400-trigger list alongside `sortBy`,
  `sortDir`, `requestedPriority`, and `status`. Reason: the underlying
  column is a foreign-key `categoryId` everywhere else in the contract, and
  every other filter/sort parameter on this endpoint already 400s on a bad
  value — `category` was the odd one out.
- **OQ-3**: One shared Ticket representation is used across
  `POST /api/tickets`, `GET /api/tickets` list items, and
  `GET /api/tickets/:id`. Detail adds `attachments: Attachment[]`; list
  adds nothing. Reason: a Ticket has one server-side shape; diverging it
  per endpoint would mean maintaining multiple shapes for no behavioral
  difference.
- **OQ-4**: `storedFilename` is never returned in any client-facing
  response. Reason: it is a server-side storage-lookup detail; returning
  it would expose internal file-storage layout for no client-side use.
- **OQ-5**: `GET /api/categories` adopts the generic
  `{ "error": "Unexpected server error" }` 500 wording fixed in §8, rather
  than keeping its prior implementation-specific text. Reason: one
  consistent 500 message across the whole API, matching every other
  endpoint documented here.
- **OQ-6**: `GET /api/requesters` returns `{ id, name }` only —
  `email` is not included. Reason: matches the `{ id, name }` convention
  already fixed for Category/RelatedSystem; the selector dropdown has no
  use for `email`.
- **OQ-7**: The `id`-descending tiebreaker applies to every sort on
  `GET /api/tickets`, not only the default `createdAt` sort. Reason (per
  the resolution): `status` is single-valued in Lab 2, so every row ties
  on that sort key, and pagination would be non-deterministic across pages
  without a universal tiebreaker.
- **OQ-8**: On `GET /api/tickets`, `page` below 1 clamps to 1; `pageSize`
  clamps to the nearest allowed value in `{10, 20, 50}`; the response's
  `page`/`pageSize` fields echo the clamped values actually used, not the
  values originally requested. Reason: keeps "clamped, not rejected"
  (BR-24) meaningful — the client can tell what was actually applied
  instead of the response silently disagreeing with its own request
  echo.
- **OQ-9**: On `POST /api/tickets/:id/attachments`, 404 (Ticket not found
  or not owned) is checked second, after 400 and before 409. Reason: the
  409 active-attachment-count check needs a resolved, owned Ticket to
  count against, so ownership must be settled before it can run.
