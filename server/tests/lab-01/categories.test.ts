import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Issue 4 — requires the database to be migrated and seeded before running.
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);

    // Assert on names, not literal ids: wiping and re-seeding preserves this
    // order but does not restart the autoincrement sequence at 1.
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);

    // Ordering criterion, checked independently of the names.
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));

    // The route exposes only id and name — createdAt must not be returned.
    expect(Object.keys(res.body[0]).sort()).toEqual(["id", "name"]);
  });
});
