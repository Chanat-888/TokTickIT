import { describe, expect, it } from "vitest";
import { hashPassword, isValidPassword, verifyPassword } from "../../src/auth.js";

// UNIT-01 — BR-08: bcrypt hash-then-compare round trip.
describe("hashPassword / verifyPassword", () => {
  it("a correct password compares true against its own hash", async () => {
    const hash = await hashPassword("CorrectPassword1");
    expect(await verifyPassword("CorrectPassword1", hash)).toBe(true);
  });

  it("a wrong password compares false against a different hash", async () => {
    const hash = await hashPassword("CorrectPassword1");
    expect(await verifyPassword("WrongPassword1", hash)).toBe(false);
  });
});

// UNIT-02 — BR-07 boundary: at least 8 characters, at least one letter and
// one digit.
describe("isValidPassword", () => {
  it("rejects 7 characters even with a letter and a digit", () => {
    expect(isValidPassword("Passwo1")).toBe(false);
  });

  it("accepts 8 characters with a letter and a digit", () => {
    expect(isValidPassword("Passwor1")).toBe(true);
  });

  it("rejects all-letters", () => {
    expect(isValidPassword("Password")).toBe(false);
  });

  it("rejects all-digits", () => {
    expect(isValidPassword("12345678")).toBe(false);
  });
});
