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
const { hashPassword } = await import("../../src/auth.js");

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

async function truncateAll() {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`,
  );
}

// Unlike most other lab-03 seed helpers, this one hashes a real password —
// auth.api.test.ts exercises POST /auth/login itself, so it needs
// credentials that actually verify, not the "unused-in-lab3-tests"
// placeholder used everywhere sessionCookieFor bypasses login.
async function seedUser(params: {
  name: string;
  email?: string;
  password: string;
  role: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
}) {
  const passwordHash = await hashPassword(params.password);
  return getPrisma().user.create({
    data: {
      name: params.name,
      email: params.email ?? `${params.name.toLowerCase().replace(/\s+/g, "-")}-${randomUUID()}@example.com`,
      role: params.role,
      isActive: params.isActive ?? true,
      mustChangePassword: params.mustChangePassword ?? false,
      passwordHash,
    },
  });
}

describe("Authentication", () => {
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

  // API-01
  it("POST /auth/login with valid credentials returns 200, the User representation, and sets the sid cookie", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER" });

    const res = await request(app).post("/auth/login").send({ email: user.email, password: "Password1" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, name: "Alex Rivera", email: user.email, role: "REQUESTER" });
    expect(res.body.passwordHash).toBeUndefined();
    expect(String(res.headers["set-cookie"])).toContain("sid=");
  });

  // API-02
  it("POST /auth/login with the correct email and a wrong password returns a generic 401 with no cookie", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER" });

    const res = await request(app).post("/auth/login").send({ email: user.email, password: "WrongPassword1" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  // API-03
  it("POST /auth/login with correct credentials for an inactive account returns a distinct 403 with no cookie", async () => {
    const user = await seedUser({
      name: "Alex Rivera",
      password: "Password1",
      role: "REQUESTER",
      isActive: false,
    });

    const res = await request(app).post("/auth/login").send({ email: user.email, password: "Password1" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "This account is inactive" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  // API-04
  it("POST /auth/login with a nonexistent email returns a byte-identical body to the wrong-password case", async () => {
    await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER", email: "alex@example.com" });

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "alex@example.com", password: "WrongPassword1" });
    const nonexistent = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "WrongPassword1" });

    expect(nonexistent.status).toBe(401);
    expect(JSON.stringify(nonexistent.body)).toBe(JSON.stringify(wrongPassword.body));
  });

  // API-05
  it("POST /auth/login with a missing email or password returns 400", async () => {
    const missingEmail = await request(app).post("/auth/login").send({ password: "Password1" });
    const missingPassword = await request(app).post("/auth/login").send({ email: "alex@example.com" });

    expect(missingEmail.status).toBe(400);
    expect(missingPassword.status).toBe(400);
  });

  // API-06
  it("GET /auth/me when authenticated returns 200 with the User representation and no passwordHash key", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER" });

    const res = await request(app).get("/auth/me").set("Cookie", await sessionCookieFor(user.id));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, name: "Alex Rivera" });
    expect(Object.keys(res.body)).not.toContain("passwordHash");
  });

  // API-07
  it("GET /auth/me when unauthenticated returns 401", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  // API-08
  it("POST /auth/logout then reusing the same cookie on GET /auth/me returns 401", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER" });
    const cookie = await sessionCookieFor(user.id);

    const logoutRes = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(401);
  });

  // API-09
  it("POST /auth/change-password with a valid new password returns 200 with mustChangePassword false, and the same session can then reach a normal route", async () => {
    const user = await seedUser({
      name: "Alex Rivera",
      password: "OldPassword1",
      role: "REQUESTER",
      mustChangePassword: true,
    });
    const cookie = await sessionCookieFor(user.id);

    const res = await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "OldPassword1", newPassword: "NewPassword1" });

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(false);

    const ticketsRes = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(ticketsRes.status).toBe(200);
  });

  // API-10
  it("POST /auth/change-password with the wrong currentPassword returns 401", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "OldPassword1", role: "REQUESTER" });
    const cookie = await sessionCookieFor(user.id);

    const res = await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "WrongPassword1", newPassword: "NewPassword1" });

    expect(res.status).toBe(401);
  });

  // API-11
  it("POST /auth/change-password rejects a newPassword at 7 characters and one missing a digit", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "OldPassword1", role: "REQUESTER" });
    const cookie = await sessionCookieFor(user.id);

    const tooShort = await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "OldPassword1", newPassword: "Passwo1" });
    const noDigit = await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "OldPassword1", newPassword: "PasswordOnly" });

    expect(tooShort.status).toBe(400);
    expect(noDigit.status).toBe(400);
  });

  // API-12
  it("a session with mustChangePassword true is blocked from a normal route with 403, but GET /auth/me still succeeds", async () => {
    const user = await seedUser({
      name: "Alex Rivera",
      password: "Password1",
      role: "REQUESTER",
      mustChangePassword: true,
    });
    const cookie = await sessionCookieFor(user.id);

    const ticketsRes = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(ticketsRes.status).toBe(403);
    expect(ticketsRes.body).toEqual({ error: "Password change required" });

    const meRes = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(200);
  });

  // API-13
  it("a session past its 12-hour expiresAt is treated as unauthenticated", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "Password1", role: "REQUESTER" });
    const cookie = await sessionCookieFor(user.id);

    await getPrisma().session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  // API-65
  it("BR-35: changing password on one session invalidates the user's other session", async () => {
    const user = await seedUser({ name: "Alex Rivera", password: "OldPassword1", role: "REQUESTER" });
    const cookieA = await sessionCookieFor(user.id);
    const cookieB = await sessionCookieFor(user.id);

    const changeRes = await request(app)
      .post("/auth/change-password")
      .set("Cookie", cookieA)
      .send({ currentPassword: "OldPassword1", newPassword: "NewPassword1" });
    expect(changeRes.status).toBe(200);

    const sessionBRes = await request(app).get("/auth/me").set("Cookie", cookieB);
    expect(sessionBRes.status).toBe(401);

    const sessionARes = await request(app).get("/auth/me").set("Cookie", cookieA);
    expect(sessionARes.status).toBe(200);
  });
});
