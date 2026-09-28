import "../lab-02/testDbEnv.js";

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { sessionCookieFor } from "../authHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");

type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedUser(name: string, role: "REQUESTER" | "IT_STAFF") {
  return getPrisma().user.create({
    data: { name, email: `${randomUUID()}@example.com`, role, passwordHash: "unused", mustChangePassword: false },
  });
}

describe("status filter accepts a comma-separated list (BR-27)", () => {
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

  async function setup() {
    const category = await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
    const relatedSystem = await getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
    const requester = await seedUser("Alex Rivera", "REQUESTER");
    const other = await seedUser("Sam Okafor", "REQUESTER");
    const staff = await seedUser("Jordan Blake", "IT_STAFF");
    const make = (requesterId: number, status: TicketStatus) =>
      getPrisma().ticket.create({
        data: {
          ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: `A ${status} ticket`,
          description: "Default description long enough for validation purposes.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status,
          idempotencyKey: randomUUID(),
        },
      });
    for (const s of ["NEW", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as TicketStatus[]) await make(requester.id, s);
    await make(other.id, "OPEN");
    return {
      requesterCookie: await sessionCookieFor(requester.id),
      staffCookie: await sessionCookieFor(staff.id),
    };
  }

  const statusesOf = (body: { data: { status: string }[] }) => body.data.map((t) => t.status).sort();

  // API-22 — AC-18
  it("GET /api/staff/tickets?status=NEW,OPEN returns only New and Open Tickets", async () => {
    const { staffCookie } = await setup();
    const res = await request(app).get("/api/staff/tickets?status=NEW,OPEN").set("Cookie", staffCookie);

    expect(res.status).toBe(200);
    expect(statusesOf(res.body)).toEqual(["NEW", "OPEN", "OPEN"]);
    expect(res.body.totalCount).toBe(3);
  });

  // API-23
  it("GET /api/tickets?status=... as a Requester filters by a list, any status, and only their own Tickets", async () => {
    const { requesterCookie } = await setup();

    const list = await request(app)
      .get("/api/tickets?status=NEW,OPEN,IN_PROGRESS,REOPENED")
      .set("Cookie", requesterCookie);
    expect(list.status).toBe(200);
    expect(statusesOf(list.body)).toEqual(["IN_PROGRESS", "NEW", "OPEN"]);

    const single = await request(app).get("/api/tickets?status=RESOLVED").set("Cookie", requesterCookie);
    expect(single.status).toBe(200);
    expect(statusesOf(single.body)).toEqual(["RESOLVED"]);
  });

  // API-24
  it("a single value behaves as before, and an invalid token anywhere in the list returns 400", async () => {
    const { staffCookie, requesterCookie } = await setup();

    const single = await request(app).get("/api/staff/tickets?status=CLOSED").set("Cookie", staffCookie);
    expect(single.status).toBe(200);
    expect(statusesOf(single.body)).toEqual(["CLOSED"]);

    for (const url of ["/api/staff/tickets?status=NEW,BOGUS", "/api/staff/tickets?status=", "/api/staff/tickets?status=NEW,"]) {
      const res = await request(app).get(url).set("Cookie", staffCookie);
      expect(res.status, url).toBe(400);
      expect(res.body.errors[0].field).toBe("status");
    }
    const requesterBad = await request(app).get("/api/tickets?status=NEW,BOGUS").set("Cookie", requesterCookie);
    expect(requesterBad.status).toBe(400);
    expect(requesterBad.body.errors[0].field).toBe("status");
  });
});
