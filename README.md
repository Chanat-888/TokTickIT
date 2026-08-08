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

### 2. Create the database

```
psql -U postgres -c "CREATE DATABASE toktickit;"
```

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

### 4. Install dependencies

```
cd server
npm install

cd ../client
npm install
```

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

```
cd server
npm test

cd ../client
npm test
```

The backend uses Vitest with Supertest for API tests. The frontend uses Vitest for UI tests.

## Project structure

```
client/           React + Vite frontend
  src/            Application source
  tests/lab-01/   UI tests
server/           Express + Prisma backend
  src/            Application source
  prisma/         Schema, migrations, and seed
  tests/lab-01/   API tests
docs/lab-01/      Lab documentation
```

## Branching model

```
main  <-  lab1-staging  <-  feature/*
```

Feature branches are opened as pull requests into `lab1-staging`. A single release pull request merges `lab1-staging` into `main` at the end of the lab.
