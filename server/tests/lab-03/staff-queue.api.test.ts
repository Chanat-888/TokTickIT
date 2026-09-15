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

type Priority = "LOW" | "MEDIUM" | "HIGH";
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

async function seedUser(name: string, email: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  return getPrisma().user.create({
    data: { name, email, role, isActive: true, passwordHash: "unused-in-lab3-tests", mustChangePassword: false },
  });
}

async function seedCategory() {
  return getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
}

async function seedRelatedSystem() {
  return getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
}

async function seedTicket(params: {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  ticketNumber?: string;
  status?: TicketStatus;
  itPriority?: Priority;
  requestedPriority?: Priority;
  ownerId?: number | null;
}) {
  return getPrisma().ticket.create({
    data: {
      ticketNumber:
        params.ticketNumber ?? `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
      requesterId: params.requesterId,
      categoryId: params.categoryId,
      relatedSystemId: params.relatedSystemId,
      summary: "Laptop won't power on after firmware update",
      description: "Default description long enough for validation purposes.",
      requestedPriority: params.requestedPriority ?? "MEDIUM",
      itPriority: params.itPriority ?? "MEDIUM",
      status: params.status ?? "NEW",
      ownerId: params.ownerId,
      idempotencyKey: randomUUID(),
    },
  });
}

describe("IT Staff Ticket Queue", () => {
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

  async function seedFixtures() {
    const category = await seedCategory();
    const relatedSystem = await seedRelatedSystem();
    const requester = await seedUser("Alex Rivera", `alex-${randomUUID()}@example.com`, "REQUESTER");
    const staff = await seedUser("Jordan Blake", `jordan-${randomUUID()}@example.com`, "IT_STAFF");
    return { category, relatedSystem, requester, staff };
  }

  // API-20
  it("GET /api/staff/tickets with the default query and 30+ seeded Tickets returns 10 items with correct pagination", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    for (let i = 0; i < 32; i++) {
      await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    }

    const res = await request(app).get("/api/staff/tickets").set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.page).toBe(1);
    expect(res.body.totalCount).toBe(32);
    expect(res.body.totalPages).toBe(4);
  });

  // API-21
  it("GET /api/staff/tickets?search=<ticket-number-prefix> returns only matching Tickets", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const match = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ticketNumber: "TKT-2026-000777",
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ticketNumber: "TKT-2026-000888",
    });

    const res = await request(app)
      .get("/api/staff/tickets?search=TKT-2026-0007")
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(match.id);
  });

  // API-22
  it("GET /api/staff/tickets?status=OPEN returns only OPEN Tickets", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const open = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      status: "OPEN",
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      status: "NEW",
    });

    const res = await request(app)
      .get("/api/staff/tickets?status=OPEN")
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(open.id);
  });

  // API-23
  it("GET /api/staff/tickets?itPriority=HIGH returns only HIGH IT-Priority Tickets", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const high = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      itPriority: "HIGH",
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      itPriority: "LOW",
    });

    const res = await request(app)
      .get("/api/staff/tickets?itPriority=HIGH")
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(high.id);
  });

  // API-24
  it("GET /api/staff/tickets?ownerId=unassigned returns only Tickets with ownerId: null", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const unassigned = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ownerId: null,
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ownerId: staff.id,
    });

    const res = await request(app)
      .get("/api/staff/tickets?ownerId=unassigned")
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(unassigned.id);
    expect(res.body.data[0].ownerId).toBeNull();
  });

  // API-25
  it("GET /api/staff/tickets?sortBy=itPriority orders HIGH-first on desc and LOW-first on asc, with an id-descending tiebreaker", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const low = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      itPriority: "LOW",
    });
    const high1 = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      itPriority: "HIGH",
    });
    const high2 = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      itPriority: "HIGH",
    });

    const cookie = await sessionCookieFor(staff.id);
    const desc = await request(app).get("/api/staff/tickets?sortBy=itPriority&sortDir=desc").set("Cookie", cookie);
    const asc = await request(app).get("/api/staff/tickets?sortBy=itPriority&sortDir=asc").set("Cookie", cookie);

    // BR-32's id-descending tiebreaker applies regardless of the primary
    // sortDir, so the two HIGH tickets keep the same relative order
    // (high2 before high1) in both directions.
    expect(desc.body.data.map((t: { id: number }) => t.id)).toEqual([high2.id, high1.id, low.id]);
    expect(asc.body.data.map((t: { id: number }) => t.id)).toEqual([low.id, high2.id, high1.id]);
  });

  // API-26
  it("An invalid sortBy, status, or itPriority query value returns 400 for each", async () => {
    const { staff } = await seedFixtures();
    const cookie = await sessionCookieFor(staff.id);

    const badSortBy = await request(app).get("/api/staff/tickets?sortBy=ownerId").set("Cookie", cookie);
    const badStatus = await request(app).get("/api/staff/tickets?status=DELETED").set("Cookie", cookie);
    const badItPriority = await request(app).get("/api/staff/tickets?itPriority=URGENT").set("Cookie", cookie);

    expect(badSortBy.status).toBe(400);
    expect(badStatus.status).toBe(400);
    expect(badItPriority.status).toBe(400);
  });

  // API-27
  it("pageSize=999 clamps to 50; pageSize=15 (not an allowed size) returns 400", async () => {
    const { staff } = await seedFixtures();
    const cookie = await sessionCookieFor(staff.id);

    const clamped = await request(app).get("/api/staff/tickets?pageSize=999").set("Cookie", cookie);
    const rejected = await request(app).get("/api/staff/tickets?pageSize=15").set("Cookie", cookie);

    expect(clamped.status).toBe(200);
    expect(clamped.body.pageSize).toBe(50);
    expect(rejected.status).toBe(400);
  });

  it("GET /api/staff/tickets without a session returns 401; a Requester session returns 403", async () => {
    const { requester } = await seedFixtures();

    const noSession = await request(app).get("/api/staff/tickets");
    const requesterSession = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", await sessionCookieFor(requester.id));

    expect(noSession.status).toBe(401);
    expect(requesterSession.status).toBe(403);
  });
});
