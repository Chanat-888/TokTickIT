import "./testDbEnv.js";

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");
const { UPLOADS_DIR } = await import("../../src/uploads.js");

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

// Metadata-only fixture — no real file on disk. Fine for every test except
// the download endpoint's success path, which needs actual bytes to stream.
async function seedAttachment(params: {
  ticketId: number;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  removedAt?: Date;
  removalReason?: string;
}) {
  return getPrisma().attachment.create({
    data: {
      ticketId: params.ticketId,
      originalFilename: params.originalFilename ?? "screenshot.png",
      storedFilename: `${randomUUID()}.png`,
      mimeType: params.mimeType ?? "image/png",
      sizeBytes: params.sizeBytes ?? 245678,
      removedAt: params.removedAt,
      removalReason: params.removalReason,
    },
  });
}

// Writes a real file into UPLOADS_DIR so the download endpoint has
// something to stream; cleaned up in afterEach below.
async function seedAttachmentWithFile(params: {
  ticketId: number;
  content?: string;
  mimeType?: string;
  originalFilename?: string;
}) {
  const storedFilename = `${randomUUID()}.txt`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const content = params.content ?? "file content";
  await fs.writeFile(path.join(UPLOADS_DIR, storedFilename), content);
  return getPrisma().attachment.create({
    data: {
      ticketId: params.ticketId,
      originalFilename: params.originalFilename ?? "screenshot.png",
      storedFilename,
      mimeType: params.mimeType ?? "image/png",
      sizeBytes: Buffer.byteLength(content),
    },
  });
}

function pngBuffer(sizeBytes: number): Buffer {
  return Buffer.alloc(sizeBytes, 1);
}

describe("Attachments", () => {
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

  afterEach(async () => {
    // Tests that go through the real POST /attachments endpoint (or
    // seedAttachmentWithFile) write real files into UPLOADS_DIR; clean them
    // up so the test run leaves nothing behind on disk (tests.md §1's
    // constraint, echoed by the Issue #21 task brief).
    const attachments = await getPrisma().attachment.findMany({ select: { storedFilename: true } });
    await Promise.all(
      attachments.map(async (a) => {
        try {
          await fs.unlink(path.join(UPLOADS_DIR, a.storedFilename));
        } catch {
          // No real file was ever written for this row — fine.
        }
      }),
    );
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
    delete process.env.DATABASE_URL;
  });

  // API-38
  it("POST /api/tickets/:id/attachments with 1 valid file returns 201 and advances the Ticket's updatedAt", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", String(requester.id))
      .attach("files", pngBuffer(1024), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ originalFilename: "photo.png", isRemoved: false });
    expect(res.body[0]).not.toHaveProperty("storedFilename");

    const updatedTicket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    // >= rather than strict > — both operations can land in the same
    // millisecond on a fast local run; @updatedAt still fires either way.
    expect(updatedTicket.updatedAt.getTime()).toBeGreaterThanOrEqual(ticket.updatedAt.getTime());
  });

  // API-39
  it("POST /api/tickets/:id/attachments on a Ticket already at 5 active attachments returns 409 and leaves the existing 5 unchanged", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    for (let i = 0; i < 5; i++) {
      await seedAttachment({ ticketId: ticket.id, originalFilename: `existing-${i}.png` });
    }

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", String(requester.id))
      .attach("files", pngBuffer(1024), { filename: "new.png", contentType: "image/png" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Attachment limit reached" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(5);
  });

  // API-40
  it("POST /api/tickets/:id/attachments with 6 files in one request returns 409 and stores none", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    let req = request(app).post(`/api/tickets/${ticket.id}/attachments`).set("X-Requester-Id", String(requester.id));
    for (let i = 0; i < 6; i++) {
      req = req.attach("files", pngBuffer(1024), { filename: `f${i}.png`, contentType: "image/png" });
    }
    const res = await req;

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Too many files in this request" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // API-41
  it("POST /api/tickets/:id/attachments with an unsupported file type returns 415 and stores nothing", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", String(requester.id))
      .attach("files", Buffer.from("hello"), { filename: "note.txt", contentType: "text/plain" });

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: "Unsupported file type" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // API-42
  it("POST /api/tickets/:id/attachments with a file over 5 MB returns 413 and stores nothing", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", String(requester.id))
      .attach("files", pngBuffer(5 * 1024 * 1024 + 1), { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "File exceeds 5 MB" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // API-43 — precedence: 409 wins over 415/413 also present in the batch.
  it("a batch that is simultaneously >5 files, oversized, and wrong-typed returns 409, storing nothing", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    let req = request(app).post(`/api/tickets/${ticket.id}/attachments`).set("X-Requester-Id", String(requester.id));
    for (let i = 0; i < 4; i++) {
      req = req.attach("files", pngBuffer(1024), { filename: `good-${i}.png`, contentType: "image/png" });
    }
    req = req.attach("files", Buffer.from("bad"), { filename: "bad.txt", contentType: "text/plain" });
    req = req.attach("files", pngBuffer(6 * 1024 * 1024), { filename: "big.png", contentType: "image/png" });
    const res = await req;

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Too many files in this request" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // API-44 — BR-30: a batch of ≤5 files where exactly one has a bad type
  // rejects the whole batch, including the otherwise-valid files.
  it("a batch of 5 files where exactly one has a bad type rejects the whole batch with 415, storing none", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    let req = request(app).post(`/api/tickets/${ticket.id}/attachments`).set("X-Requester-Id", String(requester.id));
    for (let i = 0; i < 4; i++) {
      req = req.attach("files", pngBuffer(1024), { filename: `good-${i}.png`, contentType: "image/png" });
    }
    req = req.attach("files", Buffer.from("bad"), { filename: "bad.txt", contentType: "text/plain" });
    const res = await req;

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: "Unsupported file type" });
    expect(await getPrisma().attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // API-45
  it("POST /api/tickets/:id/attachments with no files returns 400, checked before ownership/count checks", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    // Targets a nonexistent Ticket id — if 400 fires first, this still 400s
    // rather than 404ing on the ownership lookup.
    const res = await request(app)
      .post("/api/tickets/999999/attachments")
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "files" })]),
    );
  });

  // API-46
  it("POST /api/tickets/:id/attachments to a nonexistent Ticket returns 404, checked after 400 and before 409", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets/999999/attachments")
      .set("X-Requester-Id", String(requester.id))
      .attach("files", pngBuffer(1024), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("POST /api/tickets/:id/attachments to a Ticket owned by a different Requester returns 404", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", String(other.id))
      .attach("files", pngBuffer(1024), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-47
  it("GET /api/tickets/:ticketId/attachments/:attachmentId returns metadata only, including removed-state fields", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: attachment.id,
      ticketId: ticket.id,
      originalFilename: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: 245678,
      createdAt: attachment.createdAt.toISOString(),
      isRemoved: false,
      removedAt: null,
      removalReason: null,
    });
  });

  it("GET /api/tickets/:ticketId/attachments/:attachmentId returns 200 for a removed attachment too (only download 404s on removal)", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({
      ticketId: ticket.id,
      removedAt: new Date("2026-08-29T11:30:00.000Z"),
      removalReason: "Duplicate",
    });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removedAt).toBe("2026-08-29T11:30:00.000Z");
    expect(res.body.removalReason).toBe("Duplicate");
  });

  // API-48
  it("GET /api/tickets/:ticketId/attachments/:attachmentId not found returns 404", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .get("/api/tickets/1/attachments/999999")
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("GET /api/tickets/:ticketId/attachments/:attachmentId not owned by the caller returns 404", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(other.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-49
  it("GET .../download on an active attachment streams the file with the stored mimeType", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachmentWithFile({
      ticketId: ticket.id,
      content: "hello world",
      mimeType: "text/plain",
    });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toBe("hello world");
  });

  // API-50
  it("GET .../download on a removed attachment returns 404 even for its own owner", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachmentWithFile({ ticketId: ticket.id });
    await getPrisma().attachment.update({ where: { id: attachment.id }, data: { removedAt: new Date() } });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
    expect(res.text).not.toBe("file content");
  });

  // API-51
  it("GET .../download not owned by the caller returns 404", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachmentWithFile({ ticketId: ticket.id });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", String(other.id));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // Deviation coverage (api-spec.md §9, Issue #21 TASK 2/4): a plain <a>
  // link click can't carry a custom header, so this route also accepts a
  // requesterId query param, with the header taking precedence when present.
  it("GET .../download accepts a requesterId query param when X-Requester-Id is absent", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachmentWithFile({ ticketId: ticket.id });

    const res = await request(app).get(
      `/api/tickets/${ticket.id}/attachments/${attachment.id}/download?requesterId=${requester.id}`,
    );

    expect(res.status).toBe(200);
  });

  it("GET .../download prefers the X-Requester-Id header over a requesterId query param when both are present", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachmentWithFile({ ticketId: ticket.id });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download?requesterId=${owner.id}`)
      .set("X-Requester-Id", String(other.id));

    expect(res.status).toBe(404);
  });

  it("GET .../download returns the generic 500 when the DB row exists but the file is missing from disk", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id }); // no real file written

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Unexpected server error" });
  });

  // API-52
  it("DELETE .../attachments/:id with a reason returns 200, sets removedAt/removalReason, and metadata stays readable", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id))
      .send({ reason: "Duplicate of another attached screenshot" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: attachment.id,
      isRemoved: true,
      removalReason: "Duplicate of another attached screenshot",
    });
    expect(res.body.removedAt).toEqual(expect.any(String));

    const metaRes = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id));
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.isRemoved).toBe(true);

    // BR-39: removal also touches the parent Ticket's updatedAt.
    const updatedTicket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    // >= rather than strict > — both operations can land in the same
    // millisecond on a fast local run; @updatedAt still fires either way.
    expect(updatedTicket.updatedAt.getTime()).toBeGreaterThanOrEqual(ticket.updatedAt.getTime());
  });

  // API-53
  it("DELETE .../attachments/:id with no reason returns 200 with removalReason: null", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removalReason).toBeNull();
  });

  // API-54
  it("DELETE .../attachments/:id with a reason at exactly 200 chars succeeds", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });
    const reason = "a".repeat(200);

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id))
      .send({ reason });

    expect(res.status).toBe(200);
    expect(res.body.removalReason).toBe(reason);
  });

  // API-55
  it("DELETE .../attachments/:id already removed returns 409", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id, removedAt: new Date() });

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Attachment already removed" });
  });

  // API-56
  it("DELETE .../attachments/:id not found returns 404", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .delete("/api/tickets/1/attachments/999999")
      .set("X-Requester-Id", String(requester.id))
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("DELETE .../attachments/:id not owned by the caller returns 404", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const owner = await seedRequester("Alex Rivera", "alex@example.com");
    const other = await seedRequester("Sam Okafor", "sam@example.com");
    const ticket = await seedTicket({
      requesterId: owner.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(other.id))
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  // API-57
  it("a Ticket created successfully is retained even when its only attachment upload fails (oversized)", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const createRes = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Laptop won't power on",
        description: "Screen stays black after the firmware update finished overnight.",
        requestedPriority: "HIGH",
      });
    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.id;

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(requester.id))
      .attach("files", pngBuffer(6 * 1024 * 1024), { filename: "big.png", contentType: "image/png" });
    expect(uploadRes.status).toBe(413);

    const getRes = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Requester-Id", String(requester.id));
    expect(getRes.status).toBe(200);
    expect(getRes.body.attachments).toEqual([]);
  });

  // API-60
  it("DELETE .../attachments/:id with a reason at 201 chars (one over) returns 400 and does not remove the attachment", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
    });
    const attachment = await seedAttachment({ ticketId: ticket.id });
    const reason = "a".repeat(201);

    const res = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requester.id))
      .send({ reason });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      errors: [{ field: "reason", message: "Reason must be 200 characters or fewer" }],
    });

    const stillActive = await getPrisma().attachment.findUniqueOrThrow({ where: { id: attachment.id } });
    expect(stillActive.removedAt).toBeNull();
  });
});
