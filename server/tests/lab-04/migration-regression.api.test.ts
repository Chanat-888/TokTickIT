import "../lab-02/testDbEnv.js";

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");
const migrationsDir = path.join(serverRoot, "prisma", "migrations");

const { getPrisma } = await import("../../src/prisma.js");

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function runMigrationFile(client: PrismaClient, migrationName: string) {
  const sql = readFileSync(path.join(migrationsDir, migrationName, "migration.sql"), "utf-8");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}

const LAB4_MIGRATION = "20260925115539_lab4_actions_taken";

describe("Lab 3 -> Lab 4 migration and seed", () => {
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

  // API-36 — the migration is additive: every pre-existing row survives, legacy
  // Tickets simply have zero Actions Taken, and dropping the new table (the
  // documented rollback, specification.md §7) leaves everything else intact.
  it("adds ActionTaken without changing any existing row, and rolls back by dropping the table", async () => {
    const dbName = `toktickit_migration_test_${randomUUID().replace(/-/g, "")}`;
    const baseUrl = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
    const throwawayUrl = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);

    const maintenance = new PrismaClient({ datasources: { db: { url: baseUrl } } });
    await maintenance.$executeRawUnsafe(`CREATE DATABASE "${dbName}";`);
    await maintenance.$disconnect();

    const throwaway = new PrismaClient({ datasources: { db: { url: throwawayUrl } } });
    try {
      for (const name of [
        "20260810063806_init",
        "20260831122130_lab2_schema",
        "20260915120000_lab3_users_and_workflow",
      ]) {
        await runMigrationFile(throwaway, name);
      }

      const category = await throwaway.category.create({ data: { name: "Hardware" } });
      const relatedSystem = await throwaway.relatedSystem.create({ data: { name: "Email" } });
      const requester = await throwaway.user.create({
        data: { name: "Alex Rivera", email: "alex@example.com", role: "REQUESTER", passwordHash: "x" },
      });
      const owner = await throwaway.user.create({
        data: { name: "Jordan Blake", email: "jordan@example.com", role: "IT_STAFF", passwordHash: "x" },
      });
      const ticket = await throwaway.ticket.create({
        data: {
          ticketNumber: "TKT-2026-000001",
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: "Legacy Ticket",
          description: "Created before the Lab 4 migration ran.",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          status: "IN_PROGRESS",
          ownerId: owner.id,
          idempotencyKey: randomUUID(),
        },
      });

      const counts = async () => ({
        users: await throwaway.user.count(),
        tickets: await throwaway.ticket.count(),
        categories: await throwaway.category.count(),
      });
      const before = await counts();

      await runMigrationFile(throwaway, LAB4_MIGRATION);

      expect(await counts()).toEqual(before);
      const legacy = await throwaway.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(legacy.ownerId).toBe(owner.id);
      expect(legacy.status).toBe("IN_PROGRESS");
      expect(await throwaway.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);

      await throwaway.actionTaken.create({
        data: {
          ticketId: ticket.id,
          performedById: owner.id,
          description: "d",
          result: "r",
          idempotencyKey: randomUUID(),
        },
      });
      await expect(
        throwaway.actionTaken.create({
          data: { ticketId: 999999, performedById: owner.id, description: "d", result: "r", idempotencyKey: randomUUID() },
        }),
      ).rejects.toThrow();

      await throwaway.$executeRawUnsafe(`DROP TABLE "ActionTaken";`);
      expect(await counts()).toEqual(before);
    } finally {
      await throwaway.$disconnect();
      const cleanup = new PrismaClient({ datasources: { db: { url: baseUrl } } });
      await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
      await cleanup.$disconnect();
    }
  }, 30000);

  // API-37 — handout §5.3: idempotent seed with Tickets having zero, one and
  // many Actions Taken, including one whose owner differs from a performer.
  it("seeds idempotently with zero/one/many Actions Taken per Ticket and a performer who is not the owner", async () => {
    const seed = () =>
      execSync("npx tsx prisma/seed.ts", { cwd: serverRoot, stdio: "pipe", env: process.env });

    seed();
    const snapshot = async () => ({
      tickets: await getPrisma().ticket.count(),
      users: await getPrisma().user.count(),
      actions: await getPrisma().actionTaken.count(),
    });
    const afterFirst = await snapshot();
    seed();
    expect(await snapshot()).toEqual(afterFirst);

    const perTicket = await getPrisma().actionTaken.groupBy({ by: ["ticketId"], _count: true });
    const counts = new Set(perTicket.map((g) => g._count));
    expect(counts.has(1)).toBe(true);
    expect([...counts].some((c) => c >= 2)).toBe(true);
    expect(afterFirst.tickets).toBeGreaterThan(perTicket.length);

    const actions = await getPrisma().actionTaken.findMany({ include: { ticket: true } });
    expect(actions.some((a) => a.ticket.ownerId !== a.performedById)).toBe(true);
    expect(actions.some((a) => a.followUpRequired && a.followUpNote)).toBe(true);
    expect(actions.some((a) => !a.followUpRequired)).toBe(true);
  }, 60000);
});
