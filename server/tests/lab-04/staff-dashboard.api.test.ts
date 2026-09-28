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

async function seedUser(name: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", isActive = true) {
  return getPrisma().user.create({
    data: { name, email: `${randomUUID()}@example.com`, role, isActive, passwordHash: "unused", mustChangePassword: false },
  });
}

describe("IT Staff / Administrator Dashboard API (docs/lab-04/api-spec.md §3)", () => {
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
    const requester = await seedUser("Alex Rivera", "REQUESTER");
    let n = 0;
    const make = (status: TicketStatus, ownerId: number | null = null, ageMinutes = 0) =>
      getPrisma().ticket.create({
        data: {
          ticketNumber: `TKT-2026-${String(++n).padStart(6, "0")}`,
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: `A ${status} ticket #${n}`,
          description: "Default description long enough for validation purposes.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status,
          ownerId,
          idempotencyKey: randomUUID(),
          updatedAt: new Date(Date.now() - ageMinutes * 60_000),
        },
      });
    const act = (ticketId: number, performedById: number, description: string, ageMinutes = 0) =>
      getPrisma().actionTaken.create({
        data: {
          ticketId,
          performedById,
          description,
          result: "Done",
          idempotencyKey: randomUUID(),
          createdAt: new Date(Date.now() - ageMinutes * 60_000),
        },
      });
    return { make, act, requester };
  }

  // API-30 — AC-11, BR-21
  it("Unassigned and My Assigned exclude Closed/Cancelled Tickets", async () => {
    const { make } = await fixtures();
    const me = await seedUser("Jordan Blake", "IT_STAFF");
    const other = await seedUser("Taylor Chen", "IT_STAFF");
    await make("NEW");
    await make("OPEN");
    await make("CLOSED");
    await make("CANCELLED");
    await make("IN_PROGRESS", me.id);
    await make("CLOSED", me.id);
    await make("OPEN", other.id);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(me.id));
    expect(res.status).toBe(200);
    expect(res.body.unassigned).toBe(2);
    expect(res.body.myAssigned).toBe(1);
  });

  // API-31 — BR-21, BR-23
  it("byStatus has all 8 keys, zeros included, matching DB group counts", async () => {
    const { make } = await fixtures();
    const me = await seedUser("Jordan Blake", "IT_STAFF");
    await make("NEW");
    await make("NEW");
    await make("RESOLVED");

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(me.id));
    expect(res.body.byStatus).toEqual({
      NEW: 2,
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_FOR_REQUESTER: 0,
      RESOLVED: 1,
      CLOSED: 0,
      REOPENED: 0,
      CANCELLED: 0,
    });
  });

  // API-32 — AC-12
  it("a staff user with no owned Tickets and no actions gets zero and an empty list", async () => {
    const { make } = await fixtures();
    const me = await seedUser("Taylor Chen", "IT_STAFF");
    await make("OPEN");

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(me.id));
    expect(res.status).toBe(200);
    expect(res.body.myAssigned).toBe(0);
    expect(res.body.myRecentActionsTaken).toEqual([]);
  });

  // API-33 — BR-21
  it("myRecentActionsTaken is the caller's own, newest first, capped at 5, with ticketNumber", async () => {
    const { make, act } = await fixtures();
    const me = await seedUser("Jordan Blake", "IT_STAFF");
    const other = await seedUser("Taylor Chen", "IT_STAFF");
    const ticket = await make("OPEN", me.id);
    for (let i = 0; i < 7; i++) await act(ticket.id, me.id, `mine ${i}`, 70 - i * 10);
    await act(ticket.id, other.id, "by another staff member", 0);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(me.id));
    const items: { description: string; ticketNumber: string; ticketId: number }[] = res.body.myRecentActionsTaken;
    expect(items).toHaveLength(5);
    expect(items.map((a) => a.description)).toEqual(["mine 6", "mine 5", "mine 4", "mine 3", "mine 2"]);
    expect(items[0].ticketNumber).toBe(ticket.ticketNumber);
    expect(items[0].ticketId).toBe(ticket.id);
    expect(Object.keys(items[0]).sort()).toEqual(["createdAt", "description", "id", "ticketId", "ticketNumber"]);
  });

  it("recentlyUpdated covers any status and owner, newest first, capped at 5", async () => {
    const { make } = await fixtures();
    const me = await seedUser("Jordan Blake", "IT_STAFF");
    for (let i = 0; i < 7; i++) await make("CLOSED", null, 70 - i * 10);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(me.id));
    const times = res.body.recentlyUpdated.map((t: { updatedAt: string }) => Date.parse(t.updatedAt));
    expect(times).toHaveLength(5);
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  // API-34 — AC-14, BR-22
  it("accounts counts active users by role for an Administrator and is null for IT Staff", async () => {
    await fixtures();
    const admin = await seedUser("Ada Admin", "ADMINISTRATOR");
    const staff = await seedUser("Jordan Blake", "IT_STAFF");
    await seedUser("Taylor Chen", "IT_STAFF");
    await seedUser("Retired Staff", "IT_STAFF", false);

    const asAdmin = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(admin.id));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.accounts).toEqual({ REQUESTER: 1, IT_STAFF: 2, ADMINISTRATOR: 1 });

    const asStaff = await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(staff.id));
    expect(asStaff.body.accounts).toBeNull();
    expect(asStaff.body.unassigned).toBe(asAdmin.body.unassigned);
  });

  // API-35
  it("is staff-only: a Requester gets 403, no session gets 401", async () => {
    const { requester } = await fixtures();
    expect((await request(app).get("/api/dashboard/staff").set("Cookie", await sessionCookieFor(requester.id))).status).toBe(403);
    expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
  });

  // BR-25 — the Accounts card drill-down reproduces the card's count
  it("GET /api/admin/users?role=&isActive=true lists exactly the users the Accounts card counted", async () => {
    await fixtures();
    const admin = await seedUser("Ada Admin", "ADMINISTRATOR");
    await seedUser("Taylor Chen", "IT_STAFF");
    await seedUser("Retired Staff", "IT_STAFF", false);
    const cookie = await sessionCookieFor(admin.id);

    const card = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    const active = await request(app).get("/api/admin/users?role=IT_STAFF&isActive=true").set("Cookie", cookie);
    expect(active.status).toBe(200);
    expect(active.body.data).toHaveLength(card.body.accounts.IT_STAFF);
    expect(active.body.data.every((u: { isActive: boolean }) => u.isActive)).toBe(true);

    const inactive = await request(app).get("/api/admin/users?isActive=false").set("Cookie", cookie);
    expect(inactive.body.data.map((u: { name: string }) => u.name)).toEqual(["Retired Staff"]);

    const bad = await request(app).get("/api/admin/users?isActive=maybe").set("Cookie", cookie);
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].field).toBe("isActive");
  });
});
