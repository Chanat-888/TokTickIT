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

async function seedUser(name: string, email: string, role: Role) {
  return getPrisma().user.create({
    data: { name, email, role, isActive: true, passwordHash: "unused-in-lab3-tests", mustChangePassword: false },
  });
}

async function seedCategory(name = `Hardware-${randomUUID()}`) {
  return getPrisma().category.create({ data: { name } });
}

async function seedRelatedSystem(name = `Email-${randomUUID()}`) {
  return getPrisma().relatedSystem.create({ data: { name } });
}

async function seedTicket(params: {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  status?: TicketStatus;
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
      status: params.status ?? "NEW",
      idempotencyKey: randomUUID(),
    },
  });
}

describe("Public Comments and Problem Appears Resolved", () => {
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

  async function seedOwnedTicket(status?: TicketStatus) {
    const category = await seedCategory();
    const relatedSystem = await seedRelatedSystem();
    const requester = await seedUser("Alex Rivera", `alex-${randomUUID()}@example.com`, "REQUESTER");
    const ticket = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      status,
    });
    return { requester, ticket };
  }

  // API-38
  it("POST /api/tickets/:id/comments by the owning Requester returns 201 with the Requester's name/role", async () => {
    const { requester, ticket } = await seedOwnedTicket();

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", await sessionCookieFor(requester.id))
      .send({ body: "The screen flickers on boot." });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      authorId: requester.id,
      authorName: "Alex Rivera",
      authorRole: "REQUESTER",
      body: "The screen flickers on boot.",
    });
  });

  // API-39
  it("POST /api/tickets/:id/comments by IT Staff on a Ticket they don't own returns 201 (no ownership requirement for staff)", async () => {
    const { ticket } = await seedOwnedTicket();
    const staff = await seedUser("Jordan Blake", "jordan@example.com", "IT_STAFF");

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ body: "Looking into this now." });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ authorId: staff.id, authorName: "Jordan Blake", authorRole: "IT_STAFF" });
  });

  // API-40
  it("GET /api/tickets/:id/comments returns an identical list to the Requester, IT Staff, and Administrator", async () => {
    const { requester, ticket } = await seedOwnedTicket();
    const staff = await seedUser("Jordan Blake", "jordan@example.com", "IT_STAFF");
    const admin = await seedUser("Robin Park", "robin@example.com", "ADMINISTRATOR");
    await getPrisma().publicComment.create({
      data: { ticketId: ticket.id, authorId: requester.id, body: "Still happening." },
    });

    const [reqRes, staffRes, adminRes] = await Promise.all([
      request(app).get(`/api/tickets/${ticket.id}/comments`).set("Cookie", await sessionCookieFor(requester.id)),
      request(app).get(`/api/tickets/${ticket.id}/comments`).set("Cookie", await sessionCookieFor(staff.id)),
      request(app).get(`/api/tickets/${ticket.id}/comments`).set("Cookie", await sessionCookieFor(admin.id)),
    ]);

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.data).toHaveLength(1);
    expect(JSON.stringify(reqRes.body)).toBe(JSON.stringify(staffRes.body));
    expect(JSON.stringify(reqRes.body)).toBe(JSON.stringify(adminRes.body));
  });

  // API-43
  it("POST /api/tickets/:id/comments with an empty or whitespace-only body returns 400", async () => {
    const { requester, ticket } = await seedOwnedTicket();
    const cookie = await sessionCookieFor(requester.id);

    const empty = await request(app).post(`/api/tickets/${ticket.id}/comments`).set("Cookie", cookie).send({ body: "" });
    const whitespace = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookie)
      .send({ body: "   " });

    expect(empty.status).toBe(400);
    expect(whitespace.status).toBe(400);
  });

  // API-44
  it("POST /api/tickets/:id/comments accepts a 2000-char body and rejects 2001 chars", async () => {
    const { requester, ticket } = await seedOwnedTicket();
    const cookie = await sessionCookieFor(requester.id);

    const atLimit = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookie)
      .send({ body: "a".repeat(2000) });
    const overLimit = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookie)
      .send({ body: "a".repeat(2001) });

    expect(atLimit.status).toBe(201);
    expect(overLimit.status).toBe(400);
  });

  // API-45, API-46
  it("POST /api/tickets/:id/resolve-indication by the owning Requester on a New Ticket sets requesterIndicatedResolvedAt without changing status", async () => {
    const { requester, ticket } = await seedOwnedTicket("NEW");

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/resolve-indication`)
      .set("Cookie", await sessionCookieFor(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("NEW");
    expect(res.body.requesterIndicatedResolvedAt).not.toBeNull();

    const refetch = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", await sessionCookieFor(requester.id));
    expect(refetch.body.status).toBe("NEW");
    expect(refetch.body.requesterIndicatedResolvedAt).toBe(res.body.requesterIndicatedResolvedAt);
  });

  // API-47
  it("POST /api/tickets/:id/resolve-indication on a Closed or Cancelled Ticket returns 404", async () => {
    const closed = await seedOwnedTicket("CLOSED");
    const cancelled = await seedOwnedTicket("CANCELLED");

    const closedRes = await request(app)
      .post(`/api/tickets/${closed.ticket.id}/resolve-indication`)
      .set("Cookie", await sessionCookieFor(closed.requester.id));
    const cancelledRes = await request(app)
      .post(`/api/tickets/${cancelled.ticket.id}/resolve-indication`)
      .set("Cookie", await sessionCookieFor(cancelled.requester.id));

    expect(closedRes.status).toBe(404);
    expect(cancelledRes.status).toBe(404);
  });

  // API-48
  it("POST /api/tickets/:id/comments ignores a client-supplied authorId and stores the session's user", async () => {
    const { requester, ticket } = await seedOwnedTicket();
    const impersonated = await seedUser("Sam Okafor", "sam@example.com", "REQUESTER");

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", await sessionCookieFor(requester.id))
      .send({ body: "Not impersonating anyone.", authorId: impersonated.id });

    expect(res.status).toBe(201);
    expect(res.body.authorId).toBe(requester.id);
  });

  // API-41
  it("POST /api/tickets/:id/notes by IT Staff returns 201 with the Note representation", async () => {
    const { ticket } = await seedOwnedTicket();
    const staff = await seedUser("Jordan Blake", `jordan-${randomUUID()}@example.com`, "IT_STAFF");

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", await sessionCookieFor(staff.id))
      .send({ body: "Escalated to hardware vendor." });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      authorId: staff.id,
      authorName: "Jordan Blake",
      authorRole: "IT_STAFF",
      body: "Escalated to hardware vendor.",
    });
  });

  // API-42
  it("No Requester-reachable response for a Ticket with Internal Notes includes note content anywhere in the body", async () => {
    const { requester, ticket } = await seedOwnedTicket();
    const staff = await seedUser("Jordan Blake", `jordan-${randomUUID()}@example.com`, "IT_STAFF");
    await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: staff.id, body: "SECRET-INTERNAL-NOTE-CONTENT" },
    });

    const cookie = await sessionCookieFor(requester.id);
    const ticketRes = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookie);
    const commentsRes = await request(app).get(`/api/tickets/${ticket.id}/comments`).set("Cookie", cookie);
    const notesRes = await request(app).get(`/api/tickets/${ticket.id}/notes`).set("Cookie", cookie);

    expect(JSON.stringify(ticketRes.body)).not.toContain("SECRET-INTERNAL-NOTE-CONTENT");
    expect(JSON.stringify(commentsRes.body)).not.toContain("SECRET-INTERNAL-NOTE-CONTENT");
    // BR-23/AC-04: the notes endpoint itself rejects a Requester with 403
    // and no note content in the body.
    expect(notesRes.status).toBe(403);
    expect(JSON.stringify(notesRes.body)).not.toContain("SECRET-INTERNAL-NOTE-CONTENT");
  });
});
