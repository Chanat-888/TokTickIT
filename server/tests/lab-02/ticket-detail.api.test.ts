import "./testDbEnv.js";

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "RequesterUser", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedCategory(name: string, isActive = true) {
  return getPrisma().category.create({ data: { name, isActive } });
}

async function seedRelatedSystem(name: string, isActive = true) {
  return getPrisma().relatedSystem.create({ data: { name, isActive } });
}

async function seedRequester(name: string, email: string, isActive = true) {
  return getPrisma().requesterUser.create({ data: { name, email, isActive } });
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

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("X-Requester-Id", String(requester.id));

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

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("X-Requester-Id", String(requester.id));

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

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("X-Requester-Id", String(other.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-35
  it("GET /api/tickets/:id for a nonexistent id returns a body byte-identical to the cross-Requester 404", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const crossRequesterRes = await request(app)
      .get("/api/tickets/999999")
      .set("X-Requester-Id", String(requester.id));

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
      .set("X-Requester-Id", String(requester.id));

    expect(crossRequesterRes.status).toBe(404);
    expect(notOwnedRes.status).toBe(404);
    expect(JSON.stringify(crossRequesterRes.body)).toBe(JSON.stringify(notOwnedRes.body));
    expect(crossRequesterRes.body).toEqual({ error: "Not found" });
  });

  // API-36
  it("GET /api/tickets/:id without X-Requester-Id returns 400", async () => {
    const res = await request(app).get("/api/tickets/1");

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "X-Requester-Id", message: "Missing or invalid requester header" },
    ]);
  });

  // API-37
  it("GET /api/tickets/:id with a header that is not an active Requester returns 403", async () => {
    const inactive = await seedRequester("Inactive Person", "inactive@example.com", false);

    const res = await request(app).get("/api/tickets/1").set("X-Requester-Id", String(inactive.id));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Selected Requester is not active" });
  });
});
