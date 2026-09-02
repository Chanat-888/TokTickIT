import "./testDbEnv.js";

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..", "..");

// Imported dynamically, after testDbEnv.js has already pointed
// process.env.DATABASE_URL at toktickit_test (src/prisma.ts's PrismaClient
// singleton is lazy, but this keeps the ordering explicit either way).
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

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop won't power on",
    description: "Screen stays black after the firmware update finished overnight.",
    requestedPriority: "HIGH",
    ...overrides,
  };
}

describe("Create Ticket", () => {
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
    // Prevents this override from leaking into a lab-01 test file that
    // might share this worker's process.env afterward.
    delete process.env.DATABASE_URL;
  });

  // API-01
  it("GET /api/categories returns active Categories only, ordered by id", async () => {
    await seedCategory("Hardware", true);
    await seedCategory("Retired Category", false);
    await seedCategory("Software", true);

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: "Hardware" },
      { id: 3, name: "Software" },
    ]);
  });

  // API-02
  it("GET /api/related-systems returns active Related Systems only, ordered by id", async () => {
    await seedRelatedSystem("Email", true);
    await seedRelatedSystem("Retired System", false);
    await seedRelatedSystem("VPN", true);

    const res = await request(app).get("/api/related-systems");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: "Email" },
      { id: 3, name: "VPN" },
    ]);
  });

  // API-04
  it("POST /api/tickets with a valid body returns 201 with a generated ticket number", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.status).toBe("NEW");
    expect(res.body.requesterId).toBe(requester.id);
  });

  // API-05
  it("POST /api/tickets without X-Requester-Id returns 400", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Idempotency-Key", randomUUID())
      .send(validBody());

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "X-Requester-Id", message: "Missing or invalid requester header" },
    ]);
  });

  // API-06
  it("POST /api/tickets with a header that isn't an active Requester returns 403", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "999")
      .set("Idempotency-Key", randomUUID())
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Selected Requester is not active" });
  });

  // API-07
  it("POST /api/tickets with an empty Summary returns 400 and creates no Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody({ summary: "" }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "summary" })]),
    );
    expect(await getPrisma().ticket.count()).toBe(0);
  });

  // API-08
  it("POST /api/tickets with Description below the 10-char minimum returns 400", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody({ description: "a".repeat(9) }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "description" })]),
    );
  });

  // API-09
  it("POST /api/tickets with a deactivated Category returns 400 on categoryId", async () => {
    const category = await seedCategory("Retired Category", false);
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody({ categoryId: category.id }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "categoryId" })]),
    );
  });

  // API-10
  it("POST /api/tickets with a nonexistent relatedSystemId returns 400", async () => {
    await seedCategory("Hardware");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody({ relatedSystemId: 999 }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "relatedSystemId" })]),
    );
  });

  // API-11
  it('POST /api/tickets with requestedPriority "URGENT" returns 400', async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(validBody({ requestedPriority: "URGENT" }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "requestedPriority" })]),
    );
  });

  // API-12
  it("POST /api/tickets replays an already-used Idempotency-Key as a 200 with the original Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const idempotencyKey = randomUUID();

    const first = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", idempotencyKey)
      .send(validBody());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", idempotencyKey)
      .send(validBody());

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.ticketNumber).toBe(first.body.ticketNumber);
    expect(await getPrisma().ticket.count()).toBe(1);
  });

  // API-13
  it("POST /api/tickets with the same Idempotency-Key from a different Requester creates a distinct Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const alex = await seedRequester("Alex Rivera", "alex@example.com");
    const sam = await seedRequester("Sam Okafor", "sam@example.com");
    const idempotencyKey = randomUUID();

    const first = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(alex.id))
      .set("Idempotency-Key", idempotencyKey)
      .send(validBody());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(sam.id))
      .set("Idempotency-Key", idempotencyKey)
      .send(validBody());

    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(await getPrisma().ticket.count()).toBe(2);
  });

  // API-14 — property test against the real DB unique constraint: two
  // Promise.all-parallel requests sharing one Idempotency-Key. This proves
  // the constraint (not just application logic) enforces BR-11/BR-12; the
  // exact request that "wins" isn't deterministic, but exactly one row
  // must exist afterward regardless of interleaving (tests.md §7).
  it("two concurrent POSTs sharing one Idempotency-Key create exactly one Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const idempotencyKey = randomUUID();

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", String(requester.id))
        .set("Idempotency-Key", idempotencyKey)
        .send(validBody()),
      request(app)
        .post("/api/tickets")
        .set("X-Requester-Id", String(requester.id))
        .set("Idempotency-Key", idempotencyKey)
        .send(validBody()),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
    expect(await getPrisma().ticket.count()).toBe(1);
  });

  // API-15
  it("POST /api/tickets rejects Summary at 121 chars and Description at 2001 chars", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", randomUUID())
      .send(
        validBody({
          summary: "a".repeat(121),
          description: "a".repeat(2001),
        }),
      );

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(["description", "summary"]);
  });

  // API-58
  it("POST /api/tickets without an Idempotency-Key header returns 400 and creates no Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .send(validBody());

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "Idempotency-Key", message: "Missing or invalid idempotency key" },
    ]);
    expect(await getPrisma().ticket.count()).toBe(0);
  });

  // API-59
  it("POST /api/tickets with an Idempotency-Key that isn't a valid UUID returns 400 and creates no Ticket", async () => {
    await seedCategory("Hardware");
    await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requester.id))
      .set("Idempotency-Key", "abc")
      .send(validBody());

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "Idempotency-Key", message: "Missing or invalid idempotency key" },
    ]);
    expect(await getPrisma().ticket.count()).toBe(0);
  });
});
