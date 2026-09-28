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

async function seedUser(name: string, role: Role) {
  return getPrisma().user.create({
    data: {
      name,
      email: `${randomUUID()}@example.com`,
      role,
      isActive: true,
      passwordHash: "unused-in-lab4-tests",
      mustChangePassword: false,
    },
  });
}

async function seedTicket(requesterId: number, ownerId: number | null = null) {
  const category = await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
  const relatedSystem = await getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop won't power on after firmware update",
      description: "Default description long enough for validation purposes.",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "IN_PROGRESS",
      ownerId,
      idempotencyKey: randomUUID(),
    },
  });
}

const validBody = () => ({
  description: "Replaced the battery",
  result: "Laptop powers on",
  idempotencyKey: randomUUID(),
});

describe("Actions Taken API", () => {
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
    const requester = await seedUser("Alex Rivera", "REQUESTER");
    const staffA = await seedUser("Staff A", "IT_STAFF");
    const staffB = await seedUser("Staff B", "IT_STAFF");
    const ticket = await seedTicket(requester.id, staffA.id);
    return {
      requester,
      staffA,
      staffB,
      ticket,
      requesterCookie: await sessionCookieFor(requester.id),
      staffACookie: await sessionCookieFor(staffA.id),
      staffBCookie: await sessionCookieFor(staffB.id),
    };
  }

  // API-01 — AC-01, BR-01, BR-03
  it("staff creates an Action Taken under the correct Ticket; performer comes from the session, not the body", async () => {
    const { staffA, staffB, ticket, staffACookie } = await setup();
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", staffACookie)
      .send({ ...validBody(), performedById: staffB.id, ticketId: 9999 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      performedById: staffA.id,
      performedByName: "Staff A",
      description: "Replaced the battery",
      result: "Laptop powers on",
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    });
    expect(typeof res.body.createdAt).toBe("string");
    expect(await getPrisma().actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  // API-02 — AC-04, BR-02
  it("a different staff member records an action without changing the Ticket Owner", async () => {
    const { staffA, staffB, ticket, staffBCookie } = await setup();
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", staffBCookie)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.performedById).toBe(staffB.id);
    const reloaded = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.ownerId).toBe(staffA.id);
  });

  // API-03 — AC-03, BR-06
  it("rejects followUpRequired=true without a note and writes nothing", async () => {
    const { ticket, staffACookie } = await setup();
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", staffACookie)
      .send({ ...validBody(), followUpRequired: true });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "followUpNote", message: "Follow-up Note is required when Follow-Up Required is checked" },
    ]);
    expect(await getPrisma().actionTaken.count()).toBe(0);
  });

  // API-04 — BR-05, BR-07, plus missing idempotencyKey
  it("returns a field error per invalid field", async () => {
    const { ticket, staffACookie } = await setup();
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", staffACookie)
      .send({ description: "  ", result: "x".repeat(2001), attachmentNotes: "x".repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      ["attachmentNotes", "description", "idempotencyKey", "result"].sort(),
    );
    expect(await getPrisma().actionTaken.count()).toBe(0);
  });

  // API-05 — AC-05, BR-08
  it("a Requester cannot create or update an Action Taken (403, nothing written)", async () => {
    const { ticket, staffA, requesterCookie } = await setup();
    const existing = await getPrisma().actionTaken.create({
      data: {
        ticketId: ticket.id,
        performedById: staffA.id,
        description: "original",
        result: "original",
        idempotencyKey: randomUUID(),
      },
    });

    const created = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", requesterCookie)
      .send(validBody());
    const patched = await request(app)
      .patch(`/api/tickets/${ticket.id}/actions-taken/${existing.id}`)
      .set("Cookie", requesterCookie)
      .send({ description: "tampered" });

    expect(created.status).toBe(403);
    expect(patched.status).toBe(403);
    expect(await getPrisma().actionTaken.count()).toBe(1);
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: existing.id } })).description).toBe("original");
  });

  // API-06 — AC-06, BR-11, BR-12
  it("the owning Requester lists all actions, oldest first, with every field", async () => {
    const { ticket, staffA, staffB, requesterCookie } = await setup();
    const base = Date.now();
    for (const [i, performer] of [staffA, staffB, staffA].entries()) {
      await getPrisma().actionTaken.create({
        data: {
          ticketId: ticket.id,
          performedById: performer.id,
          description: `step ${i + 1}`,
          result: "done",
          followUpRequired: i === 1,
          followUpNote: i === 1 ? "check again Friday" : null,
          attachmentNotes: i === 2 ? "photo in comment #3" : null,
          idempotencyKey: randomUUID(),
          createdAt: new Date(base + i * 1000),
        },
      });
    }

    const res = await request(app).get(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", requesterCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((a: { description: string }) => a.description)).toEqual(["step 1", "step 2", "step 3"]);
    expect(res.body.data[1]).toMatchObject({
      followUpRequired: true,
      followUpNote: "check again Friday",
      performedByName: "Staff B",
    });
    expect(res.body.data[2].attachmentNotes).toBe("photo in comment #3");
  });

  // API-07 — BR-11
  it("a Requester listing another Requester's Ticket gets the same 404 as a nonexistent Ticket", async () => {
    const { ticket, staffA } = await setup();
    const other = await seedUser("Sam Okafor", "REQUESTER");
    const otherCookie = await sessionCookieFor(other.id);
    await getPrisma().actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffA.id, description: "d", result: "r", idempotencyKey: randomUUID() },
    });

    const foreign = await request(app).get(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", otherCookie);
    const missing = await request(app).get(`/api/tickets/999999/actions-taken`).set("Cookie", otherCookie);

    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(missing.status).toBe(404);
  });

  // API-08 — AC-07, BR-13
  it("a retried create with the same idempotencyKey returns the original and creates no duplicate", async () => {
    const { ticket, staffACookie } = await setup();
    const body = validBody();

    const first = await request(app).post(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", staffACookie).send(body);
    const second = await request(app).post(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", staffACookie).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await getPrisma().actionTaken.count()).toBe(1);
  });

  it("two concurrent creates with the same idempotencyKey produce exactly one row", async () => {
    const { ticket, staffACookie } = await setup();
    const body = validBody();

    const results = await Promise.all([
      request(app).post(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", staffACookie).send(body),
      request(app).post(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", staffACookie).send(body),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await getPrisma().actionTaken.count()).toBe(1);
  });

  // API-09 — AC-15, BR-09, BR-10
  it("another staff member edits description/result; performer, ticketId and createdAt stay unchanged", async () => {
    const { ticket, staffA, staffBCookie } = await setup();
    const existing = await getPrisma().actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffA.id, description: "old", result: "old", idempotencyKey: randomUUID() },
    });
    const otherTicket = await seedTicket(ticket.requesterId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}/actions-taken/${existing.id}`)
      .set("Cookie", staffBCookie)
      .send({
        description: "new description",
        result: "new result",
        performedById: 12345,
        ticketId: otherTicket.id,
        createdAt: "2001-01-01T00:00:00.000Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      description: "new description",
      result: "new result",
      performedById: staffA.id,
      performedByName: "Staff A",
      ticketId: ticket.id,
      createdAt: existing.createdAt.toISOString(),
    });
  });

  it("PATCH applies BR-06 against the merged state (turning follow-up on needs a note; turning it off clears it)", async () => {
    const { ticket, staffA, staffACookie } = await setup();
    const existing = await getPrisma().actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffA.id, description: "d", result: "r", idempotencyKey: randomUUID() },
    });
    const url = `/api/tickets/${ticket.id}/actions-taken/${existing.id}`;

    const missingNote = await request(app).patch(url).set("Cookie", staffACookie).send({ followUpRequired: true });
    expect(missingNote.status).toBe(400);
    expect(missingNote.body.errors[0].field).toBe("followUpNote");

    const on = await request(app).patch(url).set("Cookie", staffACookie).send({ followUpRequired: true, followUpNote: "recheck" });
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ followUpRequired: true, followUpNote: "recheck" });

    const off = await request(app).patch(url).set("Cookie", staffACookie).send({ followUpRequired: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ followUpRequired: false, followUpNote: null });
  });

  // API-10 — BR-14
  it("creating and updating an Action Taken never changes Ticket.updatedAt", async () => {
    const { ticket, staffACookie } = await setup();
    const before = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;

    const created = await request(app)
      .post(`/api/tickets/${ticket.id}/actions-taken`)
      .set("Cookie", staffACookie)
      .send(validBody());
    await request(app)
      .patch(`/api/tickets/${ticket.id}/actions-taken/${created.body.id}`)
      .set("Cookie", staffACookie)
      .send({ result: "updated result" });

    const after = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;
    expect(after.getTime()).toBe(before.getTime());
  });

  // API-11
  it("PATCH 404s for an unknown Ticket, an unknown action, or an action belonging to another Ticket", async () => {
    const { ticket, staffA, staffACookie } = await setup();
    const otherTicket = await seedTicket(ticket.requesterId);
    const existing = await getPrisma().actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffA.id, description: "d", result: "r", idempotencyKey: randomUUID() },
    });

    const patch = (t: number | string, a: number | string) =>
      request(app).patch(`/api/tickets/${t}/actions-taken/${a}`).set("Cookie", staffACookie).send({ result: "x" });

    expect((await patch(999999, existing.id)).status).toBe(404);
    expect((await patch(ticket.id, 999999)).status).toBe(404);
    expect((await patch(otherTicket.id, existing.id)).status).toBe(404);
    expect((await patch("abc", existing.id)).status).toBe(404);
  });

  it("POST and GET 404 for a nonexistent Ticket", async () => {
    const { staffACookie } = await setup();
    expect((await request(app).post("/api/tickets/999999/actions-taken").set("Cookie", staffACookie).send(validBody())).status).toBe(404);
    expect((await request(app).get("/api/tickets/999999/actions-taken").set("Cookie", staffACookie)).status).toBe(404);
  });

  it("an Administrator may create and update like IT Staff", async () => {
    const { ticket } = await setup();
    const admin = await seedUser("Admin", "ADMINISTRATOR");
    const adminCookie = await sessionCookieFor(admin.id);

    const created = await request(app).post(`/api/tickets/${ticket.id}/actions-taken`).set("Cookie", adminCookie).send(validBody());
    expect(created.status).toBe(201);
    expect(created.body.performedById).toBe(admin.id);
    const updated = await request(app)
      .patch(`/api/tickets/${ticket.id}/actions-taken/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ result: "admin edit" });
    expect(updated.status).toBe(200);
  });

  // API-12
  it("every Actions Taken endpoint returns 401 with no session", async () => {
    const { ticket, staffA } = await setup();
    const existing = await getPrisma().actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffA.id, description: "d", result: "r", idempotencyKey: randomUUID() },
    });

    expect((await request(app).post(`/api/tickets/${ticket.id}/actions-taken`).send(validBody())).status).toBe(401);
    expect((await request(app).get(`/api/tickets/${ticket.id}/actions-taken`)).status).toBe(401);
    expect(
      (await request(app).patch(`/api/tickets/${ticket.id}/actions-taken/${existing.id}`).send({ result: "x" })).status,
    ).toBe(401);
  });
});
