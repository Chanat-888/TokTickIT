import "../lab-02/testDbEnv.js";

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");
const migrationsDir = path.join(serverRoot, "prisma", "migrations");

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

// Runs a migration.sql file's statements in order against `client`. The
// files here have no semicolons inside comments or string literals, so a
// strip-comments-then-split-on-";" pass is sufficient — this mirrors what
// `prisma migrate deploy` itself applies, just statement-by-statement so it
// can be pointed at a throwaway database mid-sequence (§ below).
async function runMigrationFile(client: PrismaClient, migrationName: string) {
  const sql = readFileSync(path.join(migrationsDir, migrationName, "migration.sql"), "utf-8");
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}

// api-spec.md/specification.md §11.9 — the documented local-dev seed
// password "ChangeMe123!", bcrypt-hashed, byte-identical to the literal the
// real migration.sql backfills every migrated Lab 2 Requester with.
const MIGRATED_PASSWORD_HASH = "$2b$12$yE2PZvXJeJrRkZ6EnSdDde.pteY1tudqo9weYoXm7YtG5ADoiYCjy";

describe("Lab 2 -> Lab 3 migration regression", () => {
  beforeAll(() => {
    execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
    });
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
    delete process.env.DATABASE_URL;
  });

  // API-62 — replays the real migration files (not a re-derivation of what
  // they do) against a fresh throwaway database seeded with Lab-2-shape
  // rows, deterministic and self-contained (no timing dependency, unlike a
  // concurrency test) so it's safe to run on every suite invocation. The
  // one-time verification against a full data copy (toktickit_lab3_verify)
  // is documented in lab3_plan.md Phase 3; this is the automated,
  // repeatable version of that same check.
  it("converts every Lab 2 RequesterUser to a Lab 3 User with the same id/role, preserving Ticket ownership", async () => {
    const dbName = `toktickit_migration_test_${randomUUID().replace(/-/g, "")}`;
    // Creating a database and replaying 3 migration files is legitimately
    // slower than a normal DB-backed test, especially with every other
    // suite file's connections competing for the same Postgres instance
    // when the full suite runs — the default 5000ms timeout isn't enough.
    const baseUrl = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
    const throwawayUrl = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);

    const maintenance = new PrismaClient({ datasources: { db: { url: baseUrl } } });
    await maintenance.$executeRawUnsafe(`CREATE DATABASE "${dbName}";`);
    await maintenance.$disconnect();

    const throwaway = new PrismaClient({ datasources: { db: { url: throwawayUrl } } });
    try {
      // Lab 2 schema only, matching the shape a real Lab 2 deployment left
      // behind before the Lab 3 migration ever ran.
      await runMigrationFile(throwaway, "20260810063806_init");
      await runMigrationFile(throwaway, "20260831122130_lab2_schema");

      const category = await throwaway.category.create({ data: { name: "Hardware" } });
      const relatedSystem = await throwaway.relatedSystem.create({ data: { name: "Email" } });
      const requester = await throwaway.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO "RequesterUser" (name, email) VALUES ('Alex Rivera', 'alex@example.com') RETURNING id;`,
      );
      const requesterId = requester[0].id;
      const ticket = await throwaway.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO "Ticket" (
           "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description,
           "requestedPriority", status, "idempotencyKey", "updatedAt"
         ) VALUES (
           'TKT-2026-000001', ${requesterId}, ${category.id}, ${relatedSystem.id},
           'Laptop won''t power on', 'Screen stays black after the firmware update.',
           'HIGH', 'NEW', '${randomUUID()}', CURRENT_TIMESTAMP
         ) RETURNING id;`,
      );
      const ticketId = ticket[0].id;

      // The migration under test.
      await runMigrationFile(throwaway, "20260915120000_lab3_users_and_workflow");

      const migratedUser = await throwaway.user.findUniqueOrThrow({ where: { id: requesterId } });
      expect(migratedUser.name).toBe("Alex Rivera");
      expect(migratedUser.email).toBe("alex@example.com");
      expect(migratedUser.role).toBe("REQUESTER");
      expect(migratedUser.mustChangePassword).toBe(true);
      expect(migratedUser.passwordHash).toBe(MIGRATED_PASSWORD_HASH);

      const migratedTicket = await throwaway.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(migratedTicket.requesterId).toBe(requesterId);
      expect(migratedTicket.itPriority).toBe("HIGH");
    } finally {
      await throwaway.$disconnect();
      const cleanup = new PrismaClient({ datasources: { db: { url: baseUrl } } });
      await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
      await cleanup.$disconnect();
    }
  }, 20000);

  // API-63
  it("a migrated Requester logs in with the documented seed password and sees exactly their pre-existing Tickets", async () => {
    const category = await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
    const relatedSystem = await getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
    const migratedUser = await getPrisma().user.create({
      data: {
        name: "Alex Rivera",
        email: `alex-${randomUUID()}@example.com`,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
        passwordHash: MIGRATED_PASSWORD_HASH,
      },
    });
    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
        requesterId: migratedUser.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Pre-existing Lab 2 Ticket",
        description: "Created before the Lab 3 migration ran, in spirit.",
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        status: "NEW",
        idempotencyKey: randomUUID(),
      },
    });
    // Someone else's Ticket must not leak into the migrated Requester's list.
    const otherRequester = await getPrisma().user.create({
      data: {
        name: "Sam Okafor",
        email: `sam-${randomUUID()}@example.com`,
        role: "REQUESTER",
        passwordHash: "unused-in-lab3-tests",
        mustChangePassword: false,
      },
    });
    await getPrisma().ticket.create({
      data: {
        ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
        requesterId: otherRequester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Someone else's Ticket",
        description: "Must not appear in Alex's list.",
        requestedPriority: "LOW",
        itPriority: "LOW",
        status: "NEW",
        idempotencyKey: randomUUID(),
      },
    });

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: migratedUser.email, password: "ChangeMe123!" });
    expect(loginRes.status).toBe(200);

    const cookie = String(loginRes.headers["set-cookie"]);
    const ticketsRes = await request(app).get("/api/tickets").set("Cookie", cookie);

    // mustChangePassword is still true right after login (BR-02) — a fresh
    // session must change it before reaching a normal route.
    expect(ticketsRes.status).toBe(403);

    await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "ChangeMe123!", newPassword: "NewPassword1" });

    const ticketsAfter = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(ticketsAfter.status).toBe(200);
    expect(ticketsAfter.body.data).toHaveLength(1);
    expect(ticketsAfter.body.data[0].id).toBe(ticket.id);
  });

  // API-64 — the full server/tests/lab-02/* suite already runs unmodified
  // against this exact migrated schema every time `npm test` executes
  // (Vitest collects every file under tests/, lab-02 and lab-03 alike,
  // against the same toktickit_test database); this is a canary, not a
  // duplicate of those files.
  it("a Lab 2 endpoint (GET /api/categories) still works unmodified against the migrated schema", async () => {
    await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}`, isActive: true } });

    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
