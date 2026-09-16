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

async function seedUser(params: { name: string; email?: string; role: Role; isActive?: boolean }) {
  return getPrisma().user.create({
    data: {
      name: params.name,
      email: params.email ?? `${params.name.toLowerCase().replace(/\s+/g, "-")}-${randomUUID()}@example.com`,
      role: params.role,
      isActive: params.isActive ?? true,
      passwordHash: "unused-in-lab3-tests",
      mustChangePassword: false,
    },
  });
}

describe("Administrator User Management", () => {
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

  // API-49
  it("GET /api/admin/users unfiltered returns 200 with all seeded users", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    await seedUser({ name: "Alex Rivera", role: "REQUESTER" });

    const res = await request(app).get("/api/admin/users").set("Cookie", await sessionCookieFor(admin.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  // API-50
  it("GET /api/admin/users?search=<partial email> returns only matching users", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const target = await seedUser({ name: "Jordan Blake", email: "jordan.blake@example.com", role: "IT_STAFF" });
    await seedUser({ name: "Alex Rivera", email: "alex.rivera@example.com", role: "REQUESTER" });

    const res = await request(app)
      .get("/api/admin/users")
      .query({ search: "jordan.blake" })
      .set("Cookie", await sessionCookieFor(admin.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(target.id);
  });

  // API-51
  it("GET /api/admin/users?role=IT_STAFF returns only IT Staff users", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const staff = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    await seedUser({ name: "Alex Rivera", role: "REQUESTER" });

    const res = await request(app)
      .get("/api/admin/users")
      .query({ role: "IT_STAFF" })
      .set("Cookie", await sessionCookieFor(admin.id));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(staff.id);
  });

  // API-52
  it("POST /api/admin/users with a valid body returns 201 with mustChangePassword true", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({
        name: "Sam Okafor",
        email: "sam.okafor@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "Password1",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Sam Okafor",
      email: "sam.okafor@example.com",
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: true,
    });
    expect(res.body.passwordHash).toBeUndefined();
  });

  // API-53
  it("POST /api/admin/users with an email already in use returns 409 and creates no user", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    await seedUser({ name: "Existing User", email: "taken@example.com", role: "REQUESTER" });

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({
        name: "Sam Okafor",
        email: "taken@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "Password1",
      });

    expect(res.status).toBe(409);
    const count = await getPrisma().user.count({ where: { email: "taken@example.com" } });
    expect(count).toBe(1);
  });

  // API-54
  it("POST /api/admin/users returns 400 for an invalid role or a weak initialPassword", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const cookie = await sessionCookieFor(admin.id);

    const badRole = await request(app).post("/api/admin/users").set("Cookie", cookie).send({
      name: "Sam Okafor",
      email: "sam1@example.com",
      role: "SUPERUSER",
      isActive: true,
      initialPassword: "Password1",
    });
    const weakPassword = await request(app).post("/api/admin/users").set("Cookie", cookie).send({
      name: "Sam Okafor",
      email: "sam2@example.com",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "weak",
    });

    expect(badRole.status).toBe(400);
    expect(weakPassword.status).toBe(400);
  });

  // API-55
  it("PATCH /api/admin/users/:id changes name/email/role/isActive and leaves the password untouched", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const target = await seedUser({ name: "Jordan Blake", email: "jordan@example.com", role: "IT_STAFF" });
    const originalHash = target.passwordHash;

    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({ name: "Jordan B. Blake", email: "jordan.b@example.com", role: "ADMINISTRATOR", isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Jordan B. Blake",
      email: "jordan.b@example.com",
      role: "ADMINISTRATOR",
      isActive: false,
    });

    const refetched = await getPrisma().user.findUniqueOrThrow({ where: { id: target.id } });
    expect(refetched.passwordHash).toBe(originalHash);
  });

  // API-56
  it("PATCH /api/admin/users/:id to an email already used by another user returns 409", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    await seedUser({ name: "Existing User", email: "taken@example.com", role: "REQUESTER" });
    const target = await seedUser({ name: "Jordan Blake", email: "jordan@example.com", role: "IT_STAFF" });

    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({ email: "taken@example.com" });

    expect(res.status).toBe(409);
  });

  // API-57
  it("PATCH /api/admin/users/:id deactivating the caller's own account returns 409 and the account remains active", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    await seedUser({ name: "Other Admin", role: "ADMINISTRATOR" });

    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({ isActive: false });

    expect(res.status).toBe(409);
    const refetched = await getPrisma().user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(refetched.isActive).toBe(true);
  });

  // API-58 — a distinct HTTP caller can't be constructed here: any account
  // that can pass requireAdmin is itself an active Administrator, so a
  // second active Administrator besides the target means the target isn't
  // "sole" (BR-26 permits dropping from 2 active Admins to 1 — see API-57,
  // which covers that case via BR-25's self-check instead). The only
  // reachable way to observe BR-26 guarding a truly-sole active
  // Administrator is that Administrator acting on their own row, with no
  // other active Administrator anywhere in the system.
  it("PATCH /api/admin/users/:id deactivating the sole active Administrator returns 409 and the account remains active", async () => {
    const soleAdmin = await seedUser({ name: "Only Admin", role: "ADMINISTRATOR" });
    await seedUser({ name: "Former Admin", role: "ADMINISTRATOR", isActive: false });

    const res = await request(app)
      .patch(`/api/admin/users/${soleAdmin.id}`)
      .set("Cookie", await sessionCookieFor(soleAdmin.id))
      .send({ isActive: false });

    expect(res.status).toBe(409);
    const refetched = await getPrisma().user.findUniqueOrThrow({ where: { id: soleAdmin.id } });
    expect(refetched.isActive).toBe(true);
  });

  // API-59 — same reachability constraint as API-58 above: the acting
  // Administrator must itself be active, so it must be the sole active
  // Administrator's own session for the target to genuinely be "sole".
  // This still isolates BR-26 from BR-25 (self-deactivation): the request
  // body only changes `role`, never `isActive`, so BR-25's self-check
  // (which only fires on `isActive === false`) never applies here.
  it("PATCH /api/admin/users/:id changing the sole active Administrator's role away from ADMINISTRATOR returns 409", async () => {
    const soleAdmin = await seedUser({ name: "Only Admin", role: "ADMINISTRATOR" });

    const res = await request(app)
      .patch(`/api/admin/users/${soleAdmin.id}`)
      .set("Cookie", await sessionCookieFor(soleAdmin.id))
      .send({ role: "IT_STAFF" });

    expect(res.status).toBe(409);
    const refetched = await getPrisma().user.findUniqueOrThrow({ where: { id: soleAdmin.id } });
    expect(refetched.role).toBe("ADMINISTRATOR");
  });

  // API-60
  it("POST /api/admin/users/:id/password with a valid new password returns 200 with mustChangePassword true", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const target = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });

    const res = await request(app)
      .post(`/api/admin/users/${target.id}/password`)
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({ newPassword: "NewPassword1" });

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
  });

  // PR #53 review: an admin-initiated reset has no session of the target's
  // own to preserve, unlike a self-initiated change (BR-35) — every
  // existing session for the target must end.
  it("POST /api/admin/users/:id/password invalidates the target's existing sessions", async () => {
    const admin = await seedUser({ name: "Robin Park", role: "ADMINISTRATOR" });
    const target = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    await sessionCookieFor(target.id);
    expect(await getPrisma().session.count({ where: { userId: target.id } })).toBe(1);

    const res = await request(app)
      .post(`/api/admin/users/${target.id}/password`)
      .set("Cookie", await sessionCookieFor(admin.id))
      .send({ newPassword: "NewPassword1" });

    expect(res.status).toBe(200);
    expect(await getPrisma().session.count({ where: { userId: target.id } })).toBe(0);
  });

  // API-61
  it("Every /api/admin/users... endpoint called with an IT Staff or Requester session returns 403", async () => {
    const staff = await seedUser({ name: "Jordan Blake", role: "IT_STAFF" });
    const requester = await seedUser({ name: "Alex Rivera", role: "REQUESTER" });
    const target = await seedUser({ name: "Some User", role: "REQUESTER" });

    for (const caller of [staff, requester]) {
      const cookie = await sessionCookieFor(caller.id);

      const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
      const create = await request(app)
        .post("/api/admin/users")
        .set("Cookie", cookie)
        .send({ name: "X", email: `x-${randomUUID()}@example.com`, role: "REQUESTER", isActive: true, initialPassword: "Password1" });
      const patch = await request(app).patch(`/api/admin/users/${target.id}`).set("Cookie", cookie).send({ name: "Y" });
      const password = await request(app)
        .post(`/api/admin/users/${target.id}/password`)
        .set("Cookie", cookie)
        .send({ newPassword: "NewPassword1" });

      expect(list.status).toBe(403);
      expect(create.status).toBe(403);
      expect(patch.status).toBe(403);
      expect(password.status).toBe(403);
    }
  });
});
