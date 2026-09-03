# TokTickIT

An IT service desk ticketing application built for CPE 334 Lab 1.

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

This applies both migrations (Lab 1's `Category` table, then Lab 2's
`RequesterUser`, `RelatedSystem`, `Ticket`, and `Attachment` tables) and
seeds: 4 Categories, 6 Related Systems, 5 Development Requesters (4 active,
1 inactive), and ~30 Tickets split 25/5/0 across three of the active
Requesters. The seed uses `upsert` for reference data and is otherwise
idempotent for Tickets — running it more than once produces the same
counts, not duplicates.

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

Four independent test suites cover Lab 2:

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
`e2e/lab-02/screenshots/`, organized by screen, matching the fixed
paths in `docs/lab-02/tests.md` §4.

## Project structure

```
client/           React + Vite frontend
  src/            Application source
  tests/lab-01/   UI tests (Lab 1)
  tests/lab-02/   UI tests (Lab 2)
server/           Express + Prisma backend
  src/            Application source
  prisma/         Schema, migrations, and seed
  tests/lab-01/   API tests (Lab 1)
  tests/lab-02/   API tests (Lab 2)
e2e/              Playwright E2E and responsive/visual tests
  lab-02/         Specs and committed screenshots
docs/lab-01/      Lab 1 documentation
docs/lab-02/      Lab 2 documentation (specification, API spec, UI spec,
                  test plan, AI usage log)
```

## Branching model

```
main  <-  lab2-staging  <-  feature/*
```

Feature branches are opened as pull requests into `lab2-staging`. A single
release pull request merges `lab2-staging` into `main` at the end of each
lab.
