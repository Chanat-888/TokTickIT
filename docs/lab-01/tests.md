# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

## Test cases

| Test File | Path | Tool | Test Description |
|-----------|------|------|------------------|
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest | Health endpoint returns 200 and expected JSON |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest | Categories endpoint returns the four seeded categories |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Vitest | TokTickIT heading renders |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Vitest | Loading state changes to Online plus the category list |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Vitest | API failure displays a useful error message |

## What each test asserts

**API-01 — `server/tests/lab-01/health.test.ts`**
Requests `/api/health` through Supertest and asserts HTTP 200 with a response
body exactly equal to `{ status: "ok", service: "TokTickIT API" }`. Supertest
imports the Express `app` directly, so no port is opened.

**API-02 — `server/tests/lab-01/categories.test.ts`**
Requests `/api/categories` and asserts HTTP 200, a four-item body, and the
category names in the order `Account and Access, Hardware, Software, Network`.
Ordering is checked a second time against the `id` values directly, so the
`orderBy` clause is verified independently of the seed order. A final assertion
confirms each object exposes only `id` and `name` — `createdAt` must not leak
into the API response.

The assertion deliberately matches on **names rather than literal ids**.
Dropping and re-seeding the table does not restart the PostgreSQL autoincrement
sequence, so hard-coding `id: 1..4` would fail against correct code after a
re-seed.

**UI-01 — `client/tests/lab-01/App.test.tsx`**
Renders `App` and asserts the TokTickIT heading is present. Worked example
supplied with the scaffold.

**UI-02 — `client/tests/lab-01/App.test.tsx`**
Mocks `checkSystem` with `vi.spyOn(...).mockResolvedValue(...)` returning the
four categories, clicks **Check System**, then asserts the `System Status:
Online` alert appears and the rendered list items match the four names *in
order*. Comparing the full list rather than checking each name individually
means a scrambled list fails.

**UI-03 — `client/tests/lab-01/App.test.tsx`**
Mocks `checkSystem` with `.mockRejectedValue(...)`, clicks the button, and
asserts both `System Status: Offline` and `Unable to connect to TokTickIT API`
render, and that no list items remain on screen. `vi.restoreAllMocks()` in
`afterEach` prevents the success mock from leaking into this test.

## Prerequisites

The client suite mocks the API module, so it needs neither a running backend nor
a database.

The server suite is different: API-02 queries PostgreSQL through Prisma. The
database service must be running and the seed applied (`npm run prisma:seed`)
before `npm test` in `server/`. The backend dev server does **not** need to be
running — Supertest imports the app without binding a port, which is why
`src/app.ts` and `src/index.ts` are kept separate.

## Passing runs

Server — `cd /d D:\SoftwareEng\TokTickIT\server` then `npm test`:

```
D:\SoftwareEng\TokTickIT\server>npm test

> toktickit-server@1.0.0 test
> vitest run


 RUN  v2.1.9 D:/SoftwareEng/TokTickIT/server

 ✓ tests/lab-01/categories.test.ts (1) 745ms
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  14:22:53
   Duration  6.40s (transform 248ms, setup 0ms, collect 8.93s, tests 760ms, environment 0ms, prepare 1.52s)
```

Client — `cd /d D:\SoftwareEng\TokTickIT\client` then `npm test`:

```
D:\SoftwareEng\TokTickIT\client>npm test

> toktickit-client@1.0.0 test
> vitest run

 RUN  v2.1.9 D:/SoftwareEng/TokTickIT/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ✓ shows Online and the seeded categories on success
     ✓ shows an Offline error message when the API is unavailable

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  14:22:59
   Duration  24.39s (transform 298ms, setup 3.48s, collect 4.56s, tests 182ms, environment 14.78s, prepare 789ms)
```

Note the skipped count is zero in both suites. The scaffold shipped
`categories.test.ts` wrapped in `describe.todo` and `App.test.tsx` with two
`it.todo` placeholders; those report green while executing nothing, so the
suites were only meaningful once the `.todo` markers were removed.
