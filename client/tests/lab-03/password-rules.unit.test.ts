import { describe, expect, it } from "vitest";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../../src/lib/passwordRules.js";

// UNIT-06 — client-side mirror of BR-07, evaluated with no network call.
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

  it("exposes a non-empty rule message", () => {
    expect(PASSWORD_RULE_MESSAGE.length).toBeGreaterThan(0);
  });
});
