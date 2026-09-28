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
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

// docs/lab-04 BR-17: owner/it-priority/status writes require expectedUpdatedAt.
const NOW = new Date().toISOString();

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedUser(name: string, role: Role, isActive = true) {
  return getPrisma().user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}-${randomUUID()}@example.com`,
      role,
      isActive,
      passwordHash: "unused-in-lab3-tests",
      mustChangePassword: false,
    },
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
  status?: TicketStatus;
  itPriority?: Priority;
  requestedPriority?: Priority;
  ownerId?: number | null;
}) {
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
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

describe("IT Staff Ticket Detail", () => {
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
    const requester = await seedUser("Alex Rivera", "REQUESTER");
    const staff = await seedUser("Jordan Blake", "IT_STAFF");
    return { category, relatedSystem, requester, staff };
  }

  // API-28
  it("GET /api/staff/tickets/:id returns 200 with the staff Ticket representation plus attachments/comments/notes", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    await getPrisma().publicComment.create({ data: { ticketId: ticket.id, authorId: requester.id, body: "Still broken." } });
    await getPrisma().internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, body: "Ordered a replacement part." } });

    const res = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
    expect(res.body.attachments).toEqual([]);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe("Still broken.");
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].body).toBe("Ordered a replacement part.");
  });

  // API-29
  it("A Ticket created with requestedPriority HIGH has itPriority HIGH on the staff detail view", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const createRes = await request(app)
      .post("/api/tickets")
      .set("Cookie", await sessionCookieFor(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Server room too hot",
        description: "Temperature alarm triggered overnight, needs urgent attention.",
        requestedPriority: "HIGH",
      });
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .get(`/api/staff/tickets/${createRes.body.id}`)
      .set("Cookie", await sessionCookieFor(staff.id));

    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("HIGH");
  });

  // API-30
  it("POST /api/staff/tickets/:id/owner on an unassigned Ticket with ownerId = caller returns 200 with ownerId updated", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, ownerId: null });

    const res = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ ownerId: staff.id, expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staff.id);
  });

  // API-31
  it("POST .../owner reassigning a Ticket already owned by a different IT Staff user returns 200 with ownerId updated", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const otherStaff = await seedUser("Morgan Silva", "IT_STAFF");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ownerId: otherStaff.id,
    });

    const res = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ ownerId: staff.id, expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staff.id);
  });

  // API-32
  it("POST .../owner with ownerId referencing a Requester, or an inactive IT Staff user, returns 400 for each", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const otherRequester = await seedUser("Sam Okafor", "REQUESTER");
    const inactiveStaff = await seedUser("Casey Novak", "IT_STAFF", false);
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    const cookie = await sessionCookieFor(staff.id);

    const toRequester = await request(app).post(`/api/staff/tickets/${ticket.id}/owner`).set("Cookie", cookie).send({ ownerId: otherRequester.id, expectedUpdatedAt: ticket.updatedAt.toISOString() });
    const toInactiveStaff = await request(app).post(`/api/staff/tickets/${ticket.id}/owner`).set("Cookie", cookie).send({ ownerId: inactiveStaff.id, expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(toRequester.status).toBe(400);
    expect(toInactiveStaff.status).toBe(400);
  });

  // API-33
  it("PATCH /api/staff/tickets/:id/it-priority with a valid value returns 200 with itPriority updated", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, itPriority: "LOW" });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ itPriority: "HIGH", expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("HIGH");
  });

  // API-34
  it("PATCH /api/staff/tickets/:id/status In Progress -> Resolved returns 200 with status updated", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, status: "IN_PROGRESS" });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ status: "RESOLVED", expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESOLVED");
  });

  // API-35
  it("PATCH .../status New -> Closed returns 409 \"Status transition not permitted\"", async () => {
    const { category, relatedSystem, requester, staff } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW" });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ status: "CLOSED", expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Status transition not permitted" });
  });

  // API-36
  it("PATCH .../status called with a Requester session returns 403", async () => {
    const { category, relatedSystem, requester } = await seedFixtures();
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW" });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", await sessionCookieFor(requester.id))
      .send({ status: "OPEN", expectedUpdatedAt: ticket.updatedAt.toISOString() });

    expect(res.status).toBe(403);
  });

  // API-37
  it("owner/it-priority/status endpoints against a nonexistent Ticket id return 404 for each", async () => {
    const { staff } = await seedFixtures();
    const cookie = await sessionCookieFor(staff.id);

    const owner = await request(app).post("/api/staff/tickets/999999/owner").set("Cookie", cookie).send({ ownerId: staff.id, expectedUpdatedAt: NOW });
    const itPriority = await request(app).patch("/api/staff/tickets/999999/it-priority").set("Cookie", cookie).send({ itPriority: "HIGH", expectedUpdatedAt: NOW });
    const status = await request(app).patch("/api/staff/tickets/999999/status").set("Cookie", cookie).send({ status: "OPEN", expectedUpdatedAt: NOW });

    expect(owner.status).toBe(404);
    expect(itPriority.status).toBe(404);
    expect(status.status).toBe(404);
  });

  // API-66
  it("GET /api/staff/assignable-users returns only active IT Staff/Administrator users, filterable by search", async () => {
    const { staff } = await seedFixtures();
    const admin = await seedUser("Robin Park", "ADMINISTRATOR");
    await seedUser("Sam Okafor", "REQUESTER");
    await seedUser("Casey Novak", "IT_STAFF", false);

    const cookie = await sessionCookieFor(staff.id);
    const all = await request(app).get("/api/staff/assignable-users").set("Cookie", cookie);
    const searched = await request(app).get("/api/staff/assignable-users?search=Robin").set("Cookie", cookie);

    expect(all.status).toBe(200);
    const allIds = all.body.data.map((u: { id: number }) => u.id).sort();
    expect(allIds).toEqual([staff.id, admin.id].sort());

    expect(searched.status).toBe(200);
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.data[0].id).toBe(admin.id);
  });
});
