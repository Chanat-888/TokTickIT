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

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedUser(params: { name: string; email?: string; role: Role; isActive?: boolean }) {
  return getPrisma().user.create({
    data: {
      name: params.name,
      email: params.email ?? `${params.name.toLowerCase().replace(/\s+/g, "-")}-${randomUUID()}@example.com`,
      role: params.role,
      isActive: params.isActive ?? true,
      passwordHash: "unused-in-lab3-tests",
      mustChangePassword: false,
    },
  });
}

async function seedCategory(name = `Hardware-${randomUUID()}`) {
  return getPrisma().category.create({ data: { name } });
}

async function seedRelatedSystem(name = `Email-${randomUUID()}`) {
  return getPrisma().relatedSystem.create({ data: { name } });
}

async function seedTicket(params: { requesterId: number; categoryId: number; relatedSystemId: number }) {
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
      requesterId: params.requesterId,
      categoryId: params.categoryId,
      relatedSystemId: params.relatedSystemId,
      summary: "Laptop won't power on after firmware update",
      description: "Default description long enough for validation purposes.",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW",
      idempotencyKey: randomUUID(),
    },
  });
}

describe("Authorization boundaries", () => {
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

  // API-14
  it("every protected route with no session returns 401", async () => {
    const tickets = await request(app).get("/api/tickets");
    const staffTickets = await request(app).get("/api/staff/tickets");
    const adminUsers = await request(app).get("/api/admin/users");

    expect(tickets.status).toBe(401);
    expect(staffTickets.status).toBe(401);
    expect(adminUsers.status).toBe(401);
  });

  // API-15
  it("a Requester session calling GET /api/staff/tickets returns 403", async () => {
    const requester = await seedUser({ name: "Alex Rivera", role: "REQUESTER" });
    const res = await request(app).get("/api/staff/tickets").set("Cookie", await sessionCookieFor(requester.id));
    expect(res.status).toBe(403);
  });

  // API-16
  it("an IT Staff session calling GET /api/admin/users returns 403", async () => {
    const staff = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    const res = await request(app).get("/api/admin/users").set("Cookie", await sessionCookieFor(staff.id));
    expect(res.status).toBe(403);
  });

  // API-17
  it("a Requester session calling the Internal Notes endpoints returns 403 with no note content in the body", async () => {
    const requester = await seedUser({ name: "Alex Rivera", role: "REQUESTER" });
    const staff = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    const category = await seedCategory();
    const relatedSystem = await seedRelatedSystem();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: staff.id, body: "SECRET-INTERNAL-NOTE-CONTENT" },
    });

    const cookie = await sessionCookieFor(requester.id);
    const postRes = await request(app)
      .post(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookie)
      .send({ body: "Trying to write a note." });
    const getRes = await request(app).get(`/api/tickets/${ticket.id}/notes`).set("Cookie", cookie);

    expect(postRes.status).toBe(403);
    expect(getRes.status).toBe(403);
    expect(JSON.stringify(postRes.body)).not.toContain("SECRET-INTERNAL-NOTE-CONTENT");
    expect(JSON.stringify(getRes.body)).not.toContain("SECRET-INTERNAL-NOTE-CONTENT");
  });

  // API-18
  it("BR-28: deactivating a user invalidates their currently-open session immediately, before natural expiry", async () => {
    const staff = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    const cookie = await sessionCookieFor(staff.id);

    // Confirm the session is valid before deactivation.
    const before = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(before.status).toBe(200);

    await getPrisma().user.update({ where: { id: staff.id }, data: { isActive: false } });

    const after = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(after.status).toBe(401);
  });

  // API-19
  it("POST /api/tickets ignores a client-supplied requesterId and stores the session's user", async () => {
    const requester = await seedUser({ name: "Alex Rivera", role: "REQUESTER" });
    const impersonated = await seedUser({ name: "Sam Okafor", role: "REQUESTER" });
    const category = await seedCategory();
    const relatedSystem = await seedRelatedSystem();

    const res = await request(app)
      .post("/api/tickets")
      .set("Cookie", await sessionCookieFor(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Laptop won't power on",
        description: "Screen stays black after the firmware update finished overnight.",
        requestedPriority: "HIGH",
        requesterId: impersonated.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.requesterId).toBe(requester.id);
  });
});
