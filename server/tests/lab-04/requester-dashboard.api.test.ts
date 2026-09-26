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

async function seedUser(name: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  return getPrisma().user.create({
    data: { name, email: `${randomUUID()}@example.com`, role, passwordHash: "unused", mustChangePassword: false },
  });
}

describe("Requester Dashboard API (docs/lab-04/api-spec.md §3)", () => {
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

  async function fixtures() {
    const category = await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
    const relatedSystem = await getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
    let n = 0;
    // updatedAt is set explicitly (larger ageMinutes = older) so ordering is deterministic.
    const make = (requesterId: number, status: TicketStatus, ageMinutes = 0) =>
      getPrisma().ticket.create({
        data: {
          ticketNumber: `TKT-2026-${String(++n).padStart(6, "0")}`,
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: `A ${status} ticket #${n}`,
          description: "Default description long enough for validation purposes.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status,
          idempotencyKey: randomUUID(),
          updatedAt: new Date(Date.now() - ageMinutes * 60_000),
        },
      });
    return { make };
  }

  // API-25 — AC-02, BR-19
  it("returns only the caller's own data and ignores a requesterId query parameter", async () => {
    const { make } = await fixtures();
    const a = await seedUser("Alex Rivera", "REQUESTER");
    const b = await seedUser("Sam Okafor", "REQUESTER");
    await make(a.id, "OPEN");
    await make(b.id, "OPEN");
    await make(b.id, "WAITING_FOR_REQUESTER");
    await make(b.id, "RESOLVED");

    const res = await request(app)
      .get(`/api/dashboard/requester?requesterId=${b.id}`)
      .set("Cookie", await sessionCookieFor(a.id));

    expect(res.status).toBe(200);
    expect(res.body.myOpenTickets).toBe(1);
    expect(res.body.waitingForRequester).toBe(0);
    expect(res.body.recentlyUpdated).toHaveLength(1);
    expect(res.body.recentlyResolved).toEqual([]);
  });

  // API-26 — BR-20
  it("counts and lists follow BR-20 and match a direct DB query", async () => {
    const { make } = await fixtures();
    const a = await seedUser("Alex Rivera", "REQUESTER");
    await make(a.id, "NEW", 60);
    await make(a.id, "OPEN", 50);
    await make(a.id, "IN_PROGRESS", 40);
    await make(a.id, "REOPENED", 30);
    await make(a.id, "WAITING_FOR_REQUESTER", 20);
    await make(a.id, "RESOLVED", 10);
    await make(a.id, "CLOSED", 5);
    await make(a.id, "CANCELLED", 1);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", await sessionCookieFor(a.id));

    const db = getPrisma();
    expect(res.status).toBe(200);
    expect(res.body.myOpenTickets).toBe(
      await db.ticket.count({ where: { requesterId: a.id, status: { in: ["NEW", "OPEN", "IN_PROGRESS", "REOPENED"] } } }),
    );
    expect(res.body.myOpenTickets).toBe(4);
    expect(res.body.waitingForRequester).toBe(1);

    const updated: { status: string; updatedAt: string }[] = res.body.recentlyUpdated;
    expect(updated.map((t) => t.status)).toEqual(["CANCELLED", "CLOSED", "RESOLVED", "WAITING_FOR_REQUESTER", "REOPENED"]);
    const times = updated.map((t) => Date.parse(t.updatedAt));
    expect([...times].sort((x, y) => y - x)).toEqual(times);

    expect(res.body.recentlyResolved.map((t: { status: string }) => t.status)).toEqual(["CLOSED", "RESOLVED"]);
    expect(Object.keys(res.body.recentlyUpdated[0]).sort()).toEqual(["id", "status", "summary", "ticketNumber", "updatedAt"]);
  });

  // API-27 — AC-13
  it("a Requester with zero Tickets gets zeros and empty lists", async () => {
    await fixtures();
    const a = await seedUser("Priya Nair", "REQUESTER");
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", await sessionCookieFor(a.id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ myOpenTickets: 0, waitingForRequester: 0, recentlyUpdated: [], recentlyResolved: [] });
  });

  // API-28
  it("is Requester-only: IT Staff and Administrator get 403, no session gets 401", async () => {
    const staff = await seedUser("Jordan Blake", "IT_STAFF");
    const admin = await seedUser("Ada Admin", "ADMINISTRATOR");
    expect((await request(app).get("/api/dashboard/requester").set("Cookie", await sessionCookieFor(staff.id))).status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester").set("Cookie", await sessionCookieFor(admin.id))).status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
  });

  // API-29 — BR-20
  it("caps both lists at 5", async () => {
    const { make } = await fixtures();
    const a = await seedUser("Alex Rivera", "REQUESTER");
    for (let i = 0; i < 7; i++) await make(a.id, "RESOLVED", i);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", await sessionCookieFor(a.id));
    expect(res.body.recentlyUpdated).toHaveLength(5);
    expect(res.body.recentlyResolved).toHaveLength(5);
  });
});
