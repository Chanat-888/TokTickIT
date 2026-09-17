// Lab 3 authentication foundation — docs/lab-03/specification.md §7/§11,
// docs/lab-03/api-spec.md §0.1/§1.
//
// Sessions are DB-backed (Session table), not JWT, so logout and
// password-change invalidation are simple row deletes (specification.md
// §11.3). The cookie carries only an opaque random token; the DB stores a
// SHA-256 hash of it, never the raw token (specification.md §7).

import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "sid";

// BR-12: sessions expire 12 hours after login, no sliding renewal.
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

const BCRYPT_COST = 12; // BR-08

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// BR-09: an unknown email must cost the same as a known email with the wrong
// password, or response timing leaks which emails have accounts (a real
// bcrypt.compare at cost 12 is ~300ms; skipping it entirely is ~1ms). Hashed
// lazily once, from random bytes with no corresponding real password, and
// reused for every unknown-email attempt.
let dummyPasswordHash: Promise<string> | null = null;

export async function verifyPasswordForUnknownEmail(password: string): Promise<void> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));
  }
  await verifyPassword(password, await dummyPasswordHash);
}

// BR-07: at least 8 characters, at least one letter and one digit.
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

// Exported (rather than a private helper) so session.unit.test.ts (UNIT-03)
// can assert its hashing behavior without going through the database.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// BR-12, extracted as a pure function so session.unit.test.ts (UNIT-04) can
// test the expiry boundary directly, without seeding a Session row.
export function isSessionExpired(expiresAt: Date): boolean {
  return expiresAt <= new Date();
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  // Sweep this user's own already-expired sessions on every login, so the
  // Session table doesn't grow unbounded from repeat logins. Uses the
  // expiresAt index PR #48 added. Scoped to expired rows only — invalidating
  // this user's other still-active sessions is BR-35's job at password
  // change, not login.
  await getPrisma().session.deleteMany({
    where: { userId, expiresAt: { lte: new Date() } },
  });
  await getPrisma().session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// BR-35: a successful password change invalidates the user's other active
// sessions; only the session that made the request stays valid.
export async function deleteOtherSessions(userId: number, keepToken: string): Promise<void> {
  await getPrisma().session.deleteMany({
    where: { userId, tokenHash: { not: hashToken(keepToken) } },
  });
}

// api-spec.md §4 — an Administrator setting a new initial password for
// another user (BR-29) has no session of the target's own to preserve
// (unlike deleteOtherSessions above, self-initiated via BR-35): every
// existing session for that user must end, or someone already signed in
// stays signed in for up to 12 hours after their password was reset.
export async function deleteAllSessions(userId: number): Promise<void> {
  await getPrisma().session.deleteMany({ where: { userId } });
}

// Returns the authenticated User for a session token, or null if the token
// is missing, unknown, expired, or belongs to a now-inactive user (BR-01,
// BR-12, BR-36 — isActive is checked on every request, not only at login).
export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (isSessionExpired(session.expiresAt)) return null;
  if (!session.user.isActive) return null;
  return session.user;
}

// api-spec.md §0.4 — never includes passwordHash or any session token.
export function toUserRepresentation(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
