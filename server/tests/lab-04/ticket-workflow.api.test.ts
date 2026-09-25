import "../lab-02/testDbEnv.js";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { sessionCookieFor } from "../authHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");

const { app } = await import("../../src/app.js");
const { getPrisma } = await import("../../src/prisma.js");
const { UPLOADS_DIR } = await import("../../src/uploads.js");

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

const CONFLICT = "This ticket was changed by someone else. Refresh and try again.";

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

async function seedUser(name: string, role: Role) {
  return getPrisma().user.create({
    data: { name, email: `${randomUUID()}@example.com`, role, passwordHash: "unused", mustChangePassword: false },
  });
}

describe("Ticket workflow: transitions and stale-write protection (BR-15..BR-18)", () => {
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
    const attachments = await getPrisma().attachment.findMany({ select: { storedFilename: true } });
    await Promise.all(
      attachments.map((a) => fs.unlink(path.join(UPLOADS_DIR, a.storedFilename)).catch(() => undefined)),
    );
  });
  afterAll(async () => {
    await getPrisma().$disconnect();
    delete process.env.DATABASE_URL;
  });

  async function setup(status: TicketStatus = "IN_PROGRESS") {
    const category = await getPrisma().category.create({ data: { name: `Hardware-${randomUUID()}` } });
    const relatedSystem = await getPrisma().relatedSystem.create({ data: { name: `Email-${randomUUID()}` } });
    const requester = await seedUser("Alex Rivera", "REQUESTER");
    const staff = await seedUser("Jordan Blake", "IT_STAFF");
    const staff2 = await seedUser("Morgan Silva", "IT_STAFF");
    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNumber: `TKT-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Laptop won't power on after firmware update",
        description: "Default description long enough for validation purposes.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status,
        idempotencyKey: randomUUID(),
      },
    });
    return {
      requester,
      staff,
      staff2,
      ticket,
      token: ticket.updatedAt.toISOString(),
      staffCookie: await sessionCookieFor(staff.id),
      staff2Cookie: await sessionCookieFor(staff2.id),
      requesterCookie: await sessionCookieFor(requester.id),
    };
  }

  const status = (id: number, cookie: string, body: object) =>
    request(app).patch(`/api/staff/tickets/${id}/status`).set("Cookie", cookie).send(body);
  const priority = (id: number, cookie: string, body: object) =>
    request(app).patch(`/api/staff/tickets/${id}/it-priority`).set("Cookie", cookie).send(body);
  const owner = (id: number, cookie: string, body: object) =>
    request(app).post(`/api/staff/tickets/${id}/owner`).set("Cookie", cookie).send(body);

  // API-13 — AC-09, BR-15
  it("New -> Closed is rejected with 409 'Status transition not permitted', not a stale-write conflict", async () => {
    const { ticket, token, staffCookie } = await setup("NEW");
    const res = await status(ticket.id, staffCookie, { status: "CLOSED", expectedUpdatedAt: token });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Status transition not permitted" });
  });

  // API-14 — AC-10, BR-16
  it("In Progress -> Resolved succeeds on a Ticket with zero Actions Taken", async () => {
    const { ticket, token, staffCookie } = await setup("IN_PROGRESS");
    expect(await getPrisma().actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);

    const res = await status(ticket.id, staffCookie, { status: "RESOLVED", expectedUpdatedAt: token });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESOLVED");
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(token).getTime());
  });

  // API-15 — BR-15
  it("a Requester cannot change status, IT priority or owner (403)", async () => {
    const { ticket, token, requesterCookie, requester } = await setup("NEW");
    expect((await status(ticket.id, requesterCookie, { status: "OPEN", expectedUpdatedAt: token })).status).toBe(403);
    expect((await priority(ticket.id, requesterCookie, { itPriority: "HIGH", expectedUpdatedAt: token })).status).toBe(403);
    expect((await owner(ticket.id, requesterCookie, { ownerId: requester.id, expectedUpdatedAt: token })).status).toBe(403);
  });

  // API-16 — AC-08, BR-17
  it("two concurrent status changes with the same expectedUpdatedAt: exactly one 200 and one 409 carrying the current Ticket", async () => {
    const { ticket, token, staffCookie, staff2Cookie } = await setup("IN_PROGRESS");

    const results = await Promise.all([
      status(ticket.id, staffCookie, { status: "RESOLVED", expectedUpdatedAt: token }),
      status(ticket.id, staff2Cookie, { status: "WAITING_FOR_REQUESTER", expectedUpdatedAt: token }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    const winner = results.find((r) => r.status === 200)!;
    expect(loser.body.error).toBe(CONFLICT);
    expect(loser.body.current.status).toBe(winner.body.status);
    expect(loser.body.current.updatedAt).toBe(winner.body.updatedAt);
  });

  // API-17 — BR-17, specification.md §11.15
  it("the same concurrent pair on the owner and IT-priority endpoints also yields exactly one 200 and one 409", async () => {
    const { ticket, token, staff, staff2, staffCookie, staff2Cookie } = await setup("OPEN");

    const ownerPair = await Promise.all([
      owner(ticket.id, staffCookie, { ownerId: staff.id, expectedUpdatedAt: token }),
      owner(ticket.id, staff2Cookie, { ownerId: staff2.id, expectedUpdatedAt: token }),
    ]);
    expect(ownerPair.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(ownerPair.find((r) => r.status === 409)!.body.error).toBe(CONFLICT);

    const fresh = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt.toISOString();
    const priorityPair = await Promise.all([
      priority(ticket.id, staffCookie, { itPriority: "HIGH", expectedUpdatedAt: fresh }),
      priority(ticket.id, staff2Cookie, { itPriority: "LOW", expectedUpdatedAt: fresh }),
    ]);
    expect(priorityPair.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(priorityPair.find((r) => r.status === 409)!.body.current).toBeDefined();
  });

  // API-18 — AC-17, BR-14
  it("an attachment upload bumps updatedAt, so a stale staff write gets 409 with the fresh Ticket and a retry succeeds", async () => {
    const { ticket, token, requesterCookie, staffCookie } = await setup("IN_PROGRESS");

    const upload = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("Cookie", requesterCookie)
      .attach("files", Buffer.alloc(1024, 1), { filename: "photo.png", contentType: "image/png" });
    expect(upload.status).toBe(201);

    const stale = await status(ticket.id, staffCookie, { status: "RESOLVED", expectedUpdatedAt: token });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe(CONFLICT);

    const retry = await status(ticket.id, staffCookie, {
      status: "RESOLVED",
      expectedUpdatedAt: stale.body.current.updatedAt,
    });
    expect(retry.status).toBe(200);
  });

  // API-18 (removal half) — BR-39/BR-14
  it("removing an attachment strictly advances updatedAt, so a stale staff write then gets 409", async () => {
    const { ticket, requesterCookie, staffCookie } = await setup("IN_PROGRESS");
    const attachment = await getPrisma().attachment.create({
      data: {
        ticketId: ticket.id,
        originalFilename: "photo.png",
        storedFilename: `${randomUUID()}.png`,
        mimeType: "image/png",
        sizeBytes: 1024,
      },
    });
    const before = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;
    await new Promise((r) => setTimeout(r, 5));

    const removed = await request(app)
      .delete(`/api/tickets/${ticket.id}/attachments/${attachment.id}`)
      .set("Cookie", requesterCookie)
      .send({ reason: "Wrong file" });
    expect(removed.status).toBe(200);

    const after = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());

    const stale = await priority(ticket.id, staffCookie, { itPriority: "HIGH", expectedUpdatedAt: before.toISOString() });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe(CONFLICT);
  });

  // API-19 — BR-17
  it("the Requester's resolve-indication also bumps updatedAt (409 then successful retry)", async () => {
    const { ticket, token, requesterCookie, staffCookie } = await setup("IN_PROGRESS");

    const indicated = await request(app).post(`/api/tickets/${ticket.id}/resolve-indication`).set("Cookie", requesterCookie);
    expect(indicated.status).toBe(200);

    const stale = await priority(ticket.id, staffCookie, { itPriority: "HIGH", expectedUpdatedAt: token });
    expect(stale.status).toBe(409);
    const retry = await priority(ticket.id, staffCookie, {
      itPriority: "HIGH",
      expectedUpdatedAt: stale.body.current.updatedAt,
    });
    expect(retry.status).toBe(200);
    expect(retry.body.itPriority).toBe("HIGH");
  });

  // API-20 — BR-17
  it("a missing or malformed expectedUpdatedAt is a 400 field error on all three endpoints", async () => {
    const { ticket, staff, staffCookie } = await setup("OPEN");
    const bodies = [{}, { expectedUpdatedAt: "not-a-date" }, { expectedUpdatedAt: 123 }];
    for (const extra of bodies) {
      const results = await Promise.all([
        status(ticket.id, staffCookie, { status: "IN_PROGRESS", ...extra }),
        priority(ticket.id, staffCookie, { itPriority: "HIGH", ...extra }),
        owner(ticket.id, staffCookie, { ownerId: staff.id, ...extra }),
      ]);
      for (const res of results) {
        expect(res.status).toBe(400);
        expect(res.body.errors.map((e: { field: string }) => e.field)).toContain("expectedUpdatedAt");
      }
    }
    const untouched = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(untouched.status).toBe("OPEN");
  });

  // API-21 — BR-18
  it("the Requester's resolve-indication leaves Status unchanged", async () => {
    const { ticket, requesterCookie } = await setup("IN_PROGRESS");
    const res = await request(app).post(`/api/tickets/${ticket.id}/resolve-indication`).set("Cookie", requesterCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.requesterIndicatedResolvedAt).not.toBeNull();
  });

  it("a stale write is not applied", async () => {
    const { ticket, token, staffCookie, staff2Cookie } = await setup("OPEN");
    const first = await priority(ticket.id, staffCookie, { itPriority: "HIGH", expectedUpdatedAt: token });
    expect(first.status).toBe(200);

    const stale = await priority(ticket.id, staff2Cookie, { itPriority: "LOW", expectedUpdatedAt: token });
    expect(stale.status).toBe(409);
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).itPriority).toBe("HIGH");
  });
});
