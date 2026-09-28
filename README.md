# TokTickIT

An IT service desk ticketing application built for CPE 334, one lab at a time.
Lab 4 adds Actions Taken on Tickets, safer status changes, and role dashboards.

**Stack:** React + TypeScript + Vite + Bootstrap (frontend) · Node.js + Express + TypeScript + Prisma (backend) · PostgreSQL

## Prerequisites

- Node.js 18 or later
- PostgreSQL 17 running locally on port 5432
- npm

## Setup

### 1. Clone the repository

```
git clone https://github.com/Chanat-888/TokTickIT.git
cd TokTickIT
```

### 2. Create the database role and database

The `DATABASE_URL` in `server/.env.example` connects as the `toktickit` role, so
that role must exist before Prisma can connect:

```
psql -U postgres -c "CREATE ROLE toktickit WITH LOGIN PASSWORD 'toktickit';"
psql -U postgres -c "CREATE DATABASE toktickit OWNER toktickit;"
```

If you prefer to use an existing PostgreSQL role, skip the first command and set
`DATABASE_URL` to that role's credentials in step 3 instead.

### 3. Configure the backend environment

```
cd server
copy .env.example .env
```

Open `.env` and set `DATABASE_URL` to match your local PostgreSQL credentials:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
```

`.env` is listed in `.gitignore` and must never be committed.

### 4. Configure the frontend environment

Vite reads the API base URL from `client/.env`, which is also gitignored:

```
cd client
copy .env.example .env
```

The default `VITE_API_URL` is `http://localhost:3000`, matching the backend
below. Vite only reads this file at startup, so restart the dev server after
changing it.

### 5. Install dependencies

```
cd server
npm install

cd ../client
npm install
```

### 6. Apply migrations and seed the database

From `server/`:

```
npx prisma migrate deploy
npm run prisma:seed
```

This applies all four migrations (Lab 1's `Category` table; Lab 2's
`RequesterUser`, `RelatedSystem`, `Ticket`, and `Attachment` tables; Lab
3's rename of `RequesterUser` to `User` plus `Session`, `PublicComment`,
`InternalNote`, and the new `Ticket` workflow columns; Lab 4's
`ActionTaken` table) and seeds:
4 Categories, 6 Related Systems, 10 Users (5 Requesters — 4 active, 1
inactive; 4 IT Staff — 3 active, 1 inactive; 1 active Administrator), and
~30 Tickets split 25/5/0 across three of the active Requesters, a subset
of which are claimed with a mix of IT Priority/status/sample Public
Comments and Internal Notes. The seed uses `upsert` for reference data and
is otherwise idempotent — running it more than once produces the same
counts, not duplicates. Lab 4 also seeds Actions Taken on assigned Tickets
(zero, one, or several per Ticket, by more than one IT Staff member) so both
dashboards have data; Priya Nair has no Tickets and Taylor Chen records no
actions, which keeps the dashboard zero states reachable.

**Seeded login (local development only, never a real secret):** every
seeded account shares the password `ChangeMe123!` and must change it at
first login (`mustChangePassword`). See `server/prisma/seed.ts` for the
full account list and roles.

## Running the application

Two terminals are required.

**Backend** — http://localhost:3000

```
cd server
npm run dev
```

**Frontend** — http://localhost:5173

```
cd client
npm run dev
```

## Testing

Four independent test suites cover Labs 1-4 (each lab's tests live under
`tests/lab-0N/`, so `npm test` runs every lab as a regression):

```
cd server
npm test
```
Unit and API/integration tests (Vitest + Supertest), run against a
separate `toktickit_test` Postgres database — never the dev database
above. Create it once and point `server/.env.test` at it before the
first run:

```
psql -U postgres -c "CREATE DATABASE toktickit_test OWNER toktickit;"
```
```
# server/.env.test
DATABASE_URL="postgresql://postgres:toktickit@localhost:5432/toktickit_test?schema=public"
```
Adjust the role/password to whatever local Postgres user you actually
use — `postgres` above matches this repo's own `server/.env.test`, not
necessarily the `toktickit` role created in step 2 above.

```
cd client
npm test
```
UI component and style tests (Vitest + React Testing Library), API calls
mocked — no database, no real network.

```
cd server && npm run prisma:seed && npm run prisma:seed
cd ../e2e
npm install
npx playwright test
```
E2E and responsive/visual tests (Playwright, real browser). This suite
needs both dev servers running against the seeded **dev** database (not
`toktickit_test`) — `playwright.config.ts` starts both automatically
and reuses them if already running. A `globalSetup` resets and reseeds
the dev database to the exact 25/5/0 shape before every run, so the
running `npm run prisma:seed` above is optional but harmless; the two
commands together confirm the seed itself is idempotent before
Playwright takes over.

Screenshots from the responsive/visual suite are committed under
`e2e/lab-02/screenshots/` (Lab 2), `artifacts/lab-03/screenshots/` (Lab 3)
and `artifacts/lab-04/screenshots/` (Lab 4: `staff-dashboard/`,
`requester-dashboard/`, `actions-taken/`, `ticket-workflow/`), organized by
screen, matching the paths in each lab's `tests.md`. Run only Lab 4 with
`npx playwright test lab-04`. After login every role lands on its
Dashboard; My Tickets and the Ticket Queue are one click away in the nav.

## Project structure

```
client/           React + Vite frontend
  src/            Application source
  tests/lab-01/   UI tests (Lab 1)
  tests/lab-02/   UI tests (Lab 2)
  tests/lab-03/   UI tests (Lab 3)
  tests/lab-04/   UI tests (Lab 4: Actions Taken, workflow, dashboards)
server/           Express + Prisma backend
  src/            Application source
  prisma/         Schema, migrations, and seed
  tests/lab-01/   API tests (Lab 1)
  tests/lab-02/   API tests (Lab 2)
  tests/lab-03/   API tests (Lab 3)
  tests/lab-04/   API tests (Lab 4)
e2e/              Playwright E2E and responsive/visual tests
  lab-02/         Specs and committed screenshots
  lab-03/         Specs (screenshots under artifacts/lab-03/)
  lab-04/         Specs (screenshots under artifacts/lab-04/)
artifacts/        Screenshots for Labs 3 and 4
docs/lab-01/      Lab 1 documentation
docs/lab-02/      Lab 2 documentation (specification, API spec, UI spec,
                  test plan, AI usage log)
docs/lab-03/      Lab 3 documentation (same set, plus reviewer log)
docs/lab-04/      Lab 4 documentation (specification, API spec, UI spec,
                  test plan, reviewer log)
```

## Branching model

```
main  <-  lab4-staging  <-  feature/*
```

Feature branches are opened as pull requests into the lab's staging branch
(`lab4-staging` for Lab 4; earlier labs used `lab2-staging` and
`lab3-staging`). A single release pull request merges the staging branch
into `main` at the end of each lab.
