# Lab 3 API Specification

Source of truth: `specification.md` (merged, authoritative). This document
expands `specification.md` §8 into per-endpoint detail. It does not add,
narrow, or contradict any FR/BR/AC — every rule below cites the
specification.md item it enforces.

No code, UI, or test content is included; see `ui-spec.md` and `tests.md`
for those.

---

## 0. Conventions

### 0.1 Session authentication (replaces Lab 2's `X-Requester-Id`)

Every endpoint below except `POST /auth/login` requires a valid session
cookie (`sid`, httpOnly, `SameSite=Lax`, `Secure` outside local dev). The
cookie is validated identically before any endpoint-specific logic runs:

| Cookie state | Response |
|---|---|
| Missing | `401` — `{ "error": "Not authenticated" }` |
| Present, no matching non-expired `Session` row | `401` — `{ "error": "Not authenticated" }` |
| Valid session, but `user.isActive === false` | `401` — `{ "error": "Not authenticated" }` (an account can be deactivated after a session was issued; it stops working immediately) |
| Valid session, `mustChangePassword === true`, endpoint is not `/auth/me`, `/auth/logout`, or `/auth/change-password` | `403` — `{ "error": "Password change required" }` |
| Valid session, active user, password OK | proceeds to role/ownership checks below |

This enforces BR-01, BR-02, BR-03, BR-11, BR-12, BR-15, and is what makes
Lab 2's Requester ownership scoping (unchanged from Lab 2's own spec)
continue to work with the client identity coming from the session instead
of a header.

### 0.2 Role and ownership checks

Every endpoint's **Allowed roles** column (specification.md §8) is checked
after authentication, before any endpoint logic runs:

| Situation | Response |
|---|---|
| Authenticated, role not in the endpoint's allowed set | `403` — `{ "error": "Forbidden" }` |
| Authenticated, role allowed, but a Requester-scoped resource is owned by a different Requester | `404` — `{ "error": "Not found" }` (BR-03; identical wording to a nonexistent resource, unchanged from Lab 2 BR-10/BR-36) |
| Authenticated, role allowed, resource does not exist | `404` — `{ "error": "Not found" }` |

Internal Note endpoints reject a Requester specifically with `403` and no
note content in the body (BR-23, AC-04) — this is the same 403 path above,
not a special case, because a Requester is simply never in an Internal
Note endpoint's allowed-roles set.

### 0.3 Fixed error body shapes

- **400** (field validation failure): `{ errors: [{ field, message }] }` —
  one entry per invalid field.
- **401 / 403 / 404 / 409 / 500**: `{ error: string }` — a single generic
  message, never per-field detail.

Fixed wordings not already given in §0.1/§0.2:

| Status | Body |
|---|---|
| 401 (login: bad credentials) | `{ "error": "Invalid email or password" }` (BR-09) |
| 403 (login: inactive account) | `{ "error": "This account is inactive" }` (BR-10) |
| 409 (duplicate email) | `{ "error": "Email already in use" }` (BR-14) |
| 409 (self-deactivation) | `{ "error": "You cannot deactivate your own account" }` (BR-25) |
| 409 (last active Administrator) | `{ "error": "At least one active Administrator is required" }` (BR-26) |
| 409 (illegal status transition) | `{ "error": "Status transition not permitted" }` (BR-19) |
| 500 | `{ "error": "Unexpected server error" }` — real error logged server-side only |

### 0.4 Resource representations

**User representation** (never includes `passwordHash` or any session
token — BR-13):

```
{
  id: integer,
  name: string,
  email: string,
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR",
  isActive: boolean,
  mustChangePassword: boolean,
  createdAt: string,   // ISO 8601
  updatedAt: string    // ISO 8601
}
```

**Ticket representation (staff view)** — the Lab 2 Ticket shape
(specification.md §7; unchanged fields keep their Lab 2 meaning) plus:

```
{
  ...Lab2TicketFields,
  itPriority: "LOW" | "MEDIUM" | "HIGH",
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
        | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED",
  ownerId: integer | null,
  requesterIndicatedResolvedAt: string | null   // ISO 8601
}
```

The Requester-facing Ticket shape (Lab 2 endpoints, unchanged paths) gains
only `requesterIndicatedResolvedAt`; it never includes `ownerId` internals
beyond the owner's name where the UI needs to display it (see
`ui-spec.md`).

**Comment / Note representation** (shared shape for `PublicComment` and
`InternalNote`):

```
{
  id: integer,
  ticketId: integer,
  authorId: integer,
  authorName: string,
  authorRole: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR",
  body: string,
  createdAt: string   // ISO 8601
}
```

## 1. Authentication endpoints

**POST /auth/login**
Body: `{ email: string, password: string }`.
- `200` — sets the `sid` cookie; body is the User representation.
- `401` — wrong password or unknown email (BR-09), identical message.
- `403` — correct credentials, inactive account (BR-10).
- `400` — missing/malformed `email` or `password`.

**POST /auth/logout**
- `200` — `{ success: true }`; deletes the `Session` row (BR-11) and clears
  the cookie.

**GET /auth/me**
- `200` — User representation for the caller.

**POST /auth/change-password**
Body: `{ currentPassword: string, newPassword: string }`. Allowed even
while `mustChangePassword` is true (§0.1).
- `200` — User representation with `mustChangePassword: false`.
- `400` — `newPassword` fails BR-07, or `newPassword === currentPassword`.
- `401` — `currentPassword` does not match.

## 2. Requester endpoints (Lab 2, session-scoped)

`POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`,
`POST /api/tickets/:id/attachments`,
`GET /api/tickets/:ticketId/attachments/:attachmentId`,
`GET /api/tickets/:ticketId/attachments/:attachmentId/download`,
`DELETE /api/tickets/:ticketId/attachments/:attachmentId` keep their exact
Lab 2 request/response shapes and status codes
(`docs/lab-02/api-spec.md`). The only change is identity resolution: the
authenticated session's `User.id` (role `REQUESTER`) replaces
`X-Requester-Id` everywhere that header was read (BR-03, BR-15). A
non-Requester session calling these endpoints receives `403` (§0.2) rather
than the Lab 2 "not an active Requester" 403 — role, not header validity,
is now the gate.

**POST /api/tickets/:id/comments** — Requester (owner only) or IT Staff or
Administrator.
Body: `{ body: string }`.
- `201` — Comment/Note representation.
- `400` — `body` empty/whitespace-only or over 2000 chars (BR-21).
- `404` — Ticket not found, or Requester does not own it.

**GET /api/tickets/:id/comments** — same allowed callers.
- `200` — `{ data: Comment[] }`, oldest first.
- `404` — Ticket not found, or Requester does not own it.

**POST /api/tickets/:id/resolve-indication** — Requester (owner only).
- `200` — updated Ticket representation with
  `requesterIndicatedResolvedAt` set to the server time (BR-24; does not
  change `status`).
- `404` — Ticket not found, not owned, or already `Closed`/`Cancelled`
  (treated as not-found rather than leaking terminal-state detail to a
  Requester who no longer has an actionable ticket).

## 3. IT Staff endpoints

**GET /api/staff/tickets** — IT Staff, Administrator.
Query: `search`, `status`, `itPriority`, `requestedPriority`, `ownerId`
(`"unassigned"` or a user id), `sortBy`
(`createdAt`|`summary`|`itPriority`|`requestedPriority`|`status`),
`sortDir`, `page`, `pageSize` (BR-32, BR-33).
- `200` — `{ data: Ticket[], page, pageSize, totalCount, totalPages }`.
- `400` — invalid `status`, `itPriority`, `sortBy`, `sortDir`, or
  `pageSize` value.

**GET /api/staff/tickets/:id** — IT Staff, Administrator.
- `200` — Ticket representation (staff view) plus `attachments[]`,
  `comments[]`, `notes[]`.
- `404` — Ticket not found.

**POST /api/staff/tickets/:id/owner** — IT Staff, Administrator.
Body: `{ ownerId: integer | null }` (`null` unassigns).
- `200` — updated Ticket representation.
- `400` — `ownerId` does not reference an active `IT_STAFF`/
  `ADMINISTRATOR` user (BR-16).
- `404` — Ticket not found.

**PATCH /api/staff/tickets/:id/it-priority** — IT Staff, Administrator.
Body: `{ itPriority: "LOW" | "MEDIUM" | "HIGH" }`.
- `200` — updated Ticket representation.
- `400` — invalid value.
- `404` — Ticket not found.

**PATCH /api/staff/tickets/:id/status** — IT Staff, Administrator.
Body: `{ status: TicketStatus }`.
- `200` — updated Ticket representation.
- `400` — `status` is not a recognized value.
- `409` — the transition is not permitted from the Ticket's current status
  (specification.md §5 transition matrix, BR-19).
- `404` — Ticket not found.

**POST /api/tickets/:id/notes** / **GET /api/tickets/:id/notes** — IT
Staff, Administrator only (a Requester request hits the role check in §0.2
and receives `403` with no body content — BR-23, AC-04). Same request/
response shape and validation as the Comment endpoints in §2, scoped to
`InternalNote` instead of `PublicComment`.

## 4. Administrator endpoints

**GET /api/admin/users** — Administrator.
Query: `search` (matches name or email, case-insensitive substring),
`role` (optional exact filter).
- `200` — `{ data: User[] }`. No pagination in Lab 3 (specification.md
  §3, "not required").

**POST /api/admin/users** — Administrator.
Body: `{ name, email, role, isActive, initialPassword }`.
- `201` — User representation; `mustChangePassword: true` (BR-30).
- `400` — missing/invalid `name`/`email`/`role`, or `initialPassword`
  fails BR-07.
- `409` — email already in use (BR-14).

**PATCH /api/admin/users/:id** — Administrator.
Body: any of `{ name, email, role, isActive }` (BR-31; never a password
field).
- `200` — updated User representation.
- `400` — invalid `role` value.
- `409` — email already in use (BR-14); deactivating self (BR-25);
  deactivating or role-changing away from `ADMINISTRATOR` the last active
  Administrator (BR-26).
- `404` — user not found.

**POST /api/admin/users/:id/password** — Administrator.
Body: `{ newPassword: string }`.
- `200` — updated User representation with `mustChangePassword: true`
  (BR-29).
- `400` — `newPassword` fails BR-07.
- `404` — user not found.

## 5. HTTP status summary

| Status | Meaning in this API |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Resource created |
| 400 | Invalid input / field validation failure |
| 401 | Not authenticated, or authenticated with wrong password/current-password |
| 403 | Authenticated but role-forbidden, or password change still required |
| 404 | Resource missing, or a Requester-scoped resource not owned by the caller |
| 409 | State conflict: duplicate email, illegal status transition, self-deactivation, last-Administrator protection |
| 500 | Unexpected server error; body never leaks internal detail |
