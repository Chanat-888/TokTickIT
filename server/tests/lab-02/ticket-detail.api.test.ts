import "./testDbEnv.js";

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

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedCategory(name: string, isActive = true) {
  return getPrisma().category.create({ data: { name, isActive } });
}

async function seedRelatedSystem(name: string, isActive = true) {
  return getPrisma().relatedSystem.create({ data: { name, isActive } });
}

async function seedRequester(name: string, email: string, isActive = true) {
  return getPrisma().user.create({
    data: { name, email, isActive, passwordHash: "unused-in-lab2-tests", role: "REQUESTER", mustChangePassword: false },
  });
}

async function seedTicket(params: {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
}) {
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

async function seedAttachment(params: {
  ticketId: number;
  originalFilename?: string;
  removedAt?: Date;
  removalReason?: string;
}) {
  return getPrisma().attachment.create({
    data: {
      ticketId: params.ticketId,
      originalFilename: params.originalFilename ?? "screenshot.png",
      storedFilename: randomUUID(),
      mimeType: "image/png",
      sizeBytes: 245678,
      removedAt: params.removedAt,
      removalReason: params.removalReason,
    },
  });
}

describe("Ticket Detail", () => {
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

  // API-33
  it("GET /api/tickets/:id owned returns 200 with the Ticket representation plus attachments", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const removed = await seedAttachment({
      ticketId: ticket.id,
      originalFilename: "old-screenshot.png",
      removedAt: new Date("2026-08-29T11:30:00.000Z"),
      removalReason: "Duplicate",
    });
    const active = await seedAttachment({ ticketId: ticket.id, originalFilename: "screenshot.png" });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", await sessionCookieFor(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
    expect(res.body.ticketNumber).toBe(ticket.ticketNumber);
    expect(res.body.requesterId).toBe(requester.id);

    // Ordered by id ascending, removed attachments included with isRemoved: true.
    expect(res.body.attachments).toHaveLength(2);
    expect(res.body.attachments[0]).toMatchObject({
      id: removed.id,
      originalFilename: "old-screenshot.png",
      isRemoved: true,
      removedAt: "2026-08-29T11:30:00.000Z",
      removalReason: "Duplicate",
    });
    expect(res.body.attachments[1]).toMatchObject({
      id: active.id,
      originalFilename: "screenshot.png",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
    });
  });

  it("GET /api/tickets/:id owned with no attachments returns an empty attachments array", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", await sessionCookieFor(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.attachments).toEqual([]);
  });

  // API-34
  it("GET /api/tickets/:id owned by a different Requester returns 404", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", await sessionCookieFor(other.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-35
  it("GET /api/tickets/:id for a nonexistent id returns a body byte-identical to the cross-Requester 404", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const crossRequesterRes = await request(app)
      .get("/api/tickets/999999")
      .set("Cookie", await sessionCookieFor(requester.id));

    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const notOwnedRes = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set("Cookie", await sessionCookieFor(requester.id));

    expect(crossRequesterRes.status).toBe(404);
    expect(notOwnedRes.status).toBe(404);
    expect(JSON.stringify(crossRequesterRes.body)).toBe(JSON.stringify(notOwnedRes.body));
    expect(crossRequesterRes.body).toEqual({ error: "Not found" });
  });

  it("GET /api/tickets/abc (non-numeric id) returns 404 with the same body as the other not-found cases", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app).get("/api/tickets/abc").set("Cookie", await sessionCookieFor(requester.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-36 (Lab 3 auth foundation superseded the header check with session
  // auth — docs/lab-03/api-spec.md §0.1)
  it("GET /api/tickets/:id without a session cookie returns 401", async () => {
    const res = await request(app).get("/api/tickets/1");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  // API-37 (Lab 3: an inactive user's session is rejected outright — BR-01,
  // BR-36 — rather than the Lab 2 header-validity 403)
  it("GET /api/tickets/:id with an inactive Requester's session returns 401", async () => {
    const inactive = await seedRequester("Inactive Person", "inactive@example.com", false);

    const res = await request(app).get("/api/tickets/1").set("Cookie", await sessionCookieFor(inactive.id));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });
});
