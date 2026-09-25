# Lab 4 API Specification

Source of truth: `specification.md` (merged, authoritative). This document
expands `specification.md` §8 into per-endpoint detail. It does not add,
narrow, or contradict any FR/BR/AC — every rule below cites the
specification.md item it enforces.

No code, UI, or test content is included; see `ui-spec.md` and `tests.md`
for those.

---

## 0. Conventions

Unchanged from `docs/lab-03/api-spec.md` §0: session-cookie auth, the
role/ownership check order, the fixed 400/401/403/404/409/500 error body
shapes, and the User/Ticket/Comment representations. This section adds
only what Lab 4 introduces.

### 0.1 New fixed error wordings

| Status | Body | Trigger / BR |
|---|---|---|
| 400 (follow-up note missing) | `{ errors: [{ field: "followUpNote", message: "Follow-up Note is required when Follow-Up Required is checked" }] }` | BR-06 |
| 409 (stale Ticket write) | `{ "error": "This ticket was changed by someone else. Refresh and try again." }` | BR-17 |
| 409 (illegal status transition) | `{ "error": "Status transition not permitted" }` | unchanged from lab-03 BR-19, still checked after the concurrency check below |

### 0.2 Action Taken representation

```
{
  id: integer,
  ticketId: integer,
  performedById: integer,
  performedByName: string,
  description: string,
  result: string,
  followUpRequired: boolean,
  followUpNote: string | null,
  attachmentNotes: string | null,
  createdAt: string,   // ISO 8601, UTC (BR-04, BR-24)
  updatedAt: string    // ISO 8601, UTC
}
```

Identical for every caller (Requester, IT Staff, Administrator) that is
allowed to see it at all (BR-11) — there is no reduced Requester-facing
shape, unlike Internal Notes.

### 0.3 Dashboard ticket-summary representation

Used only inside dashboard list fields (§3), never as a full Ticket
representation — keeps dashboard responses concise (specification.md §6.2
of the handout, BR-23):

```
{
  id: integer,
  ticketNumber: string,
  summary: string,
  status: TicketStatus,
  updatedAt: string
}
```

### 0.4 `status` query parameter extension (BR-27)

`GET /api/tickets` (lab-02) and `GET /api/staff/tickets` (lab-03) now
accept a comma-separated list for `status`, e.g. `status=NEW,OPEN,
IN_PROGRESS,REOPENED`. A single value behaves exactly as before (no
behavior change for existing callers). Each comma-separated token is
validated against the `TicketStatus` enum individually; one invalid token
rejects the whole request with 400, same as an invalid single value did.

## 1. Actions Taken endpoints

**POST /api/tickets/:id/actions-taken** — IT Staff, Administrator.
Body: `{ description: string, result: string, followUpRequired?: boolean, followUpNote?: string, attachmentNotes?: string, idempotencyKey: string (UUID) }`.
- `201` — Action Taken representation (§0.2). `performedById`/
  `performedByName` come from the session (BR-03); `createdAt` from the
  server clock (BR-04).
- `200` — a retried request with an `idempotencyKey` already used for this
  Ticket returns the original Action Taken unchanged, not a new one
  (BR-13).
- `400` — `description` or `result` empty/whitespace-only or over 2000
  characters (BR-05); `followUpRequired: true` with an empty/missing
  `followUpNote`, or `followUpNote` over 2000 characters (BR-06);
  `attachmentNotes` over 500 characters (BR-07); `idempotencyKey` missing or
  not a UUID (same format Ticket creation already requires, lab-02
  BR-11) — field error on `idempotencyKey`.
- `403` — caller is a Requester (BR-08).
- `404` — Ticket not found.

**GET /api/tickets/:id/actions-taken** — Requester (owner only), IT Staff,
Administrator.
- `200` — `{ data: ActionTaken[] }`, oldest first (BR-12).
- `404` — Ticket not found, or Requester does not own it (same
  existence-hiding pattern as lab-03 §0.2).

**PATCH /api/tickets/:id/actions-taken/:actionId** — IT Staff,
Administrator.
Body: any of `{ description, result, followUpRequired, followUpNote, attachmentNotes }` (BR-09; `ticketId`, `performedById`, `createdAt` are never
accepted here even if sent — silently ignored, not rejected, since a
client resending the full representation it just received is expected).
- `200` — updated Action Taken representation. `performedById`/
  `performedByName` remain whoever originally created it (BR-09/BR-10),
  regardless of which active IT Staff/Administrator submitted the update.
- `400` — same field rules as create (BR-05/BR-06/BR-07).
- `403` — caller is a Requester (BR-08).
- `404` — Ticket or Action Taken not found, or the Action Taken does not
  belong to the given Ticket.

This endpoint never touches `Ticket.updatedAt` (BR-14) and never checks
`expectedUpdatedAt` — the concurrency check in §2 applies only to Ticket
Status/Owner/IT Priority writes (specification.md §11.7).

## 2. Ticket workflow — concurrency addition

**PATCH /api/staff/tickets/:id/status**, **PATCH /api/staff/tickets/:id/
it-priority**, **POST /api/staff/tickets/:id/owner** — unchanged allowed
roles and success/validation behavior from `docs/lab-03/api-spec.md` §3,
with one added required field and one added response case:

Body gains `expectedUpdatedAt: string` (ISO 8601, the `updatedAt` value
the caller last read for this Ticket) alongside each endpoint's existing
body fields.

Check order on each of these three endpoints:
1. Authentication (§0, unchanged) — `401`.
2. Role check (§0, unchanged) — `403`.
3. Ticket existence — `404`.
4. Endpoint-specific validation against the Ticket as read (e.g. status-
   transition legality for the status endpoint) — unchanged `400`/`409`
   behavior from lab-03. An illegal transition is reported as
   "Status transition not permitted", not as a stale-write conflict.
5. **New — atomic conditional write** (BR-17, specification.md §11.15):
   the write is a single `updateMany` with `where: { id, updatedAt:
   expectedUpdatedAt }` (the status endpoint additionally keeps its
   existing current-status condition). `count === 0` → `409`
   (§0.1) with body `{ "error": "This ticket was changed by someone else. Refresh and try again.", "current": Ticket }` — `current` is the
   freshly re-read Ticket representation (staff view), so the client can
   update its view without a second round trip. There is no separate
   "compare, then update" step: two concurrent requests holding the same
   `expectedUpdatedAt` cannot both succeed; exactly one write applies and
   the other gets the 409.
6. `count === 1` → `200` with the updated Ticket representation (new
   `updatedAt`).

Owner and it-priority previously used a plain `update`; Lab 4 changes both
to the conditional write. Because `updatedAt` is also bumped by Attachment
upload/removal and the Requester's resolve-indication (BR-14), a 409 here
can be caused by those writes too; the recovery (refresh, retry with the
new `updatedAt`) is identical.

## 3. Dashboard endpoints

**GET /api/dashboard/requester** — Requester.
- `200`:
```
{
  myOpenTickets: integer,
  waitingForRequester: integer,
  recentlyUpdated: TicketSummary[],   // up to 5, BR-20
  recentlyResolved: TicketSummary[]   // up to 5, BR-20
}
```
Every field is scoped to the caller's own Tickets only (BR-19); there is
no `requesterId` parameter. `myOpenTickets`/`waitingForRequester` are
counts; the two list fields use the ticket-summary shape (§0.3). A
Requester with zero Tickets gets `0` for both counts and `[]` for both
lists — never an error (handout §5.3 zero-metric requirement).

**GET /api/dashboard/staff** — IT Staff, Administrator.
- `200`:
```
{
  unassigned: integer,
  myAssigned: integer,
  byStatus: { [status in TicketStatus]: integer },   // all 8 keys always present, BR-21
  recentlyUpdated: TicketSummary[],                  // up to 5
  myRecentActionsTaken: ActionTakenSummary[],         // up to 5, BR-21
  accounts: { REQUESTER: integer, IT_STAFF: integer, ADMINISTRATOR: integer } | null
             // present (active-user counts, BR-22) only for an
             // Administrator caller; null for IT Staff
}
```
`ActionTakenSummary` (dashboard-only, mirrors §0.3's ticket summary):
```
{ id: integer, ticketId: integer, ticketNumber: string, description: string, createdAt: string }
```
`byStatus` always has all 8 `TicketStatus` keys, `0` for any status with
no matching Tickets — never an omitted key (BR-23, no hidden zero). An IT
Staff user with zero owned Tickets and zero authored Actions Taken gets
`myAssigned: 0` and `myRecentActionsTaken: []`.

### 3.1 Drill-down parameters (BR-25)

Each count-type metric's UI link is built from the same condition the
endpoint used to compute it, expressed via existing list-endpoint query
parameters (§0.4):

| Metric | Drill-down query |
|---|---|
| `myOpenTickets` | `GET /api/tickets?status=NEW,OPEN,IN_PROGRESS,REOPENED` |
| `waitingForRequester` | `GET /api/tickets?status=WAITING_FOR_REQUESTER` |
| `unassigned` | `GET /api/staff/tickets?ownerId=unassigned&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,REOPENED` |
| `myAssigned` | `GET /api/staff/tickets?ownerId=<callerId>&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,REOPENED` |
| `byStatus[<value>]` | `GET /api/staff/tickets?status=<value>` |
| `accounts[<role>]` | `GET /api/admin/users?role=<role>` |

`recentlyUpdated`, `recentlyResolved`, and `myRecentActionsTaken` are not
count metrics — each row in those lists links directly to its own Ticket
(`GET /api/staff/tickets/:id` or the Requester's `GET /api/tickets/:id`),
not to a filtered list.

## 4. HTTP status summary (additions to lab-03 §5)

| Status | Meaning in this API |
|---|---|
| 200 | Successful retrieval/update, or a duplicate create request returning the original record (BR-13) |
| 201 | Action Taken created |
| 400 | Invalid Action Taken field, or an unrecognized `status` token in a comma-separated filter |
| 403 | Requester attempting to create/update an Action Taken |
| 404 | Ticket or Action Taken not found |
| 409 | Stale Ticket write (BR-17) or illegal status transition (unchanged from lab-03) |
