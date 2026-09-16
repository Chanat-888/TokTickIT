import { describe, expect, it } from "vitest";
import { hashToken, isSessionExpired } from "../../src/auth.js";

// UNIT-03 — specification.md §7: the raw session token is never stored,
// only a SHA-256 hash of it.
describe("hashToken", () => {
  it("hashes the same raw token identically every time", () => {
    const token = "a-raw-session-token";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("does not collide across a small sample of distinct tokens", () => {
    const tokens = Array.from({ length: 50 }, (_, i) => `token-${i}`);
    const hashes = new Set(tokens.map(hashToken));
    expect(hashes.size).toBe(tokens.length);
  });
});

// UNIT-04 — BR-12: a session expires 12 hours after login, no sliding
// renewal.
describe("isSessionExpired", () => {
  it("treats an expiresAt in the past as expired", () => {
    expect(isSessionExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("treats an expiresAt in the future as not expired", () => {
    expect(isSessionExpired(new Date(Date.now() + 1000))).toBe(false);
  });
});
