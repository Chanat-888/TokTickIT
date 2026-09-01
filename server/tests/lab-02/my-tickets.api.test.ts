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

let ticketCounter = 1;
async function seedTicket(params: {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary?: string;
  requestedPriority?: "LOW" | "MEDIUM" | "HIGH";
  createdAt?: Date;
}) {
  const n = ticketCounter++;
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `TKT-2026-${String(n).padStart(6, "0")}`,
      requesterId: params.requesterId,
      categoryId: params.categoryId,
      relatedSystemId: params.relatedSystemId,
      summary: params.summary ?? `Ticket summary ${n}`,
      description: "Default description long enough for validation purposes.",
      requestedPriority: params.requestedPriority ?? "MEDIUM",
      status: "NEW",
      idempotencyKey: randomUUID(),
      createdAt: params.createdAt,
    },
  });
}

describe("My Tickets", () => {
  beforeAll(() => {
    execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
    });
  });

  beforeEach(async () => {
    ticketCounter = 1;
    await truncateAll();
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
    // Prevents this override from leaking into a lab-01 test file that
    // might share this worker's process.env afterward.
    delete process.env.DATABASE_URL;
  });

  // API-16
  it("GET /api/tickets without X-Requester-Id returns 400", async () => {
    const res = await request(app).get("/api/tickets");

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: "X-Requester-Id", message: "Missing or invalid requester header" },
    ]);
  });

  // API-17
  it("scopes results to the calling Requester only", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const alex = await seedRequester("Alex Rivera", "alex@example.com");
    const sam = await seedRequester("Sam Okafor", "sam@example.com");
    await seedTicket({ requesterId: alex.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    await seedTicket({ requesterId: sam.id, categoryId: category.id, relatedSystemId: relatedSystem.id });

    const alexRes = await request(app).get("/api/tickets").set("X-Requester-Id", String(alex.id));
    const samRes = await request(app).get("/api/tickets").set("X-Requester-Id", String(sam.id));

    expect(alexRes.body.data).toHaveLength(1);
    expect(alexRes.body.data[0].requesterId).toBe(alex.id);
    expect(samRes.body.data).toHaveLength(1);
    expect(samRes.body.data[0].requesterId).toBe(sam.id);
  });

  // API-18
  it("returns page 1 of 10 by default for a 25-Ticket Requester", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const base = new Date("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 25; i++) {
      await seedTicket({
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        createdAt: new Date(base.getTime() + i * 1000),
      });
    }

    const res = await request(app).get("/api/tickets").set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.totalCount).toBe(25);
    expect(res.body.totalPages).toBe(3);
  });

  // API-19
  it("returns the correct slice for page=2 and page=3", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const base = new Date("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 25; i++) {
      await seedTicket({
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        createdAt: new Date(base.getTime() + i * 1000),
      });
    }

    const page2 = await request(app).get("/api/tickets?page=2").set("X-Requester-Id", String(requester.id));
    const page3 = await request(app).get("/api/tickets?page=3").set("X-Requester-Id", String(requester.id));

    expect(page2.body.data).toHaveLength(10);
    expect(page3.body.data).toHaveLength(5);
  });

  // API-20
  it("returns an empty data array, not an error, for a page beyond the last", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });

    const res = await request(app).get("/api/tickets?page=99").set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // API-21
  it("clamps pageSize=999 to 50", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });

    const res = await request(app).get("/api/tickets?pageSize=999").set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(50);
  });

  // API-22
  it("clamps page=0 to 1", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });

    const res = await request(app).get("/api/tickets?page=0").set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });

  // API-23
  it("search matches Ticket Number by prefix", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const ticket = await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id });

    const res = await request(app)
      .get(`/api/tickets?search=${ticket.ticketNumber}`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticketNumber).toBe(ticket.ticketNumber);
  });

  // API-24
  it("search matches Summary by case-insensitive substring", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop won't power on",
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Printer jam on floor 3",
    });

    const res = await request(app).get("/api/tickets?search=POWER").set("X-Requester-Id", String(requester.id));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].summary).toBe("Laptop won't power on");
  });

  // API-25
  it("filters by categoryId", async () => {
    const hardware = await seedCategory("Hardware");
    const software = await seedCategory("Software");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: hardware.id, relatedSystemId: relatedSystem.id });
    await seedTicket({ requesterId: requester.id, categoryId: software.id, relatedSystemId: relatedSystem.id });

    const res = await request(app)
      .get(`/api/tickets?categoryId=${hardware.id}`)
      .set("X-Requester-Id", String(requester.id));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].categoryId).toBe(hardware.id);
  });

  // API-26
  it("filters by requestedPriority=HIGH", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "HIGH",
    });
    await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "LOW",
    });

    const res = await request(app)
      .get("/api/tickets?requestedPriority=HIGH")
      .set("X-Requester-Id", String(requester.id));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].requestedPriority).toBe("HIGH");
  });

  // API-27
  it("returns 400 for a categoryId that references no Category row", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app).get("/api/tickets?categoryId=999").set("X-Requester-Id", String(requester.id));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "categoryId" })]),
    );
  });

  // API-28
  it("returns 400 for invalid sortBy, invalid sortDir, and status=RESOLVED", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const badSortBy = await request(app)
      .get("/api/tickets?sortBy=notAField")
      .set("X-Requester-Id", String(requester.id));
    const badSortDir = await request(app)
      .get("/api/tickets?sortDir=sideways")
      .set("X-Requester-Id", String(requester.id));
    const badStatus = await request(app)
      .get("/api/tickets?status=RESOLVED")
      .set("X-Requester-Id", String(requester.id));

    expect(badSortBy.status).toBe(400);
    expect(badSortBy.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sortBy" })]),
    );
    expect(badSortDir.status).toBe(400);
    expect(badSortDir.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sortDir" })]),
    );
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.errors).toEqual([{ field: "status", message: "Status must be NEW" }]);
  });

  // API-29
  it("sorts by requestedPriority descending (HIGH-first) and ascending (LOW-first)", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "LOW" });
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "HIGH" });
    await seedTicket({ requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id, requestedPriority: "MEDIUM" });

    const desc = await request(app)
      .get("/api/tickets?sortBy=requestedPriority&sortDir=desc")
      .set("X-Requester-Id", String(requester.id));
    const asc = await request(app)
      .get("/api/tickets?sortBy=requestedPriority&sortDir=asc")
      .set("X-Requester-Id", String(requester.id));

    expect(desc.body.data.map((t: { requestedPriority: string }) => t.requestedPriority)).toEqual([
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
    expect(asc.body.data.map((t: { requestedPriority: string }) => t.requestedPriority)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
    ]);
  });

  // API-30
  it("tiebreaks equal createdAt values by id descending, deterministically", async () => {
    const category = await seedCategory("Hardware");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    const sameCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const first = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      createdAt: sameCreatedAt,
    });
    const second = await seedTicket({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      createdAt: sameCreatedAt,
    });

    const res1 = await request(app).get("/api/tickets").set("X-Requester-Id", String(requester.id));
    const res2 = await request(app).get("/api/tickets").set("X-Requester-Id", String(requester.id));

    expect(res1.body.data.map((t: { id: number }) => t.id)).toEqual([second.id, first.id]);
    expect(res2.body.data.map((t: { id: number }) => t.id)).toEqual([second.id, first.id]);
  });

  // API-31
  it("returns data: [] and totalCount: 0 for a Requester with zero Tickets", async () => {
    const requester = await seedRequester("Alex Rivera", "alex@example.com");

    const res = await request(app).get("/api/tickets").set("X-Requester-Id", String(requester.id));

    expect(res.body.data).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  // API-32
  it("returns an empty filtered list while an unfiltered request for the same Requester is non-empty", async () => {
    const hardware = await seedCategory("Hardware");
    const software = await seedCategory("Software");
    const relatedSystem = await seedRelatedSystem("Email");
    const requester = await seedRequester("Alex Rivera", "alex@example.com");
    await seedTicket({ requesterId: requester.id, categoryId: hardware.id, relatedSystemId: relatedSystem.id });

    const unfiltered = await request(app).get("/api/tickets").set("X-Requester-Id", String(requester.id));
    const filtered = await request(app)
      .get(`/api/tickets?categoryId=${software.id}`)
      .set("X-Requester-Id", String(requester.id));

    expect(unfiltered.body.data.length).toBeGreaterThan(0);
    expect(filtered.body.data).toEqual([]);
  });
});
