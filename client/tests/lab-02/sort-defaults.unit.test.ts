import { describe, expect, it } from "vitest";
import { defaultSortDir } from "../../src/lib/sortDefaults.js";

describe("defaultSortDir", () => {
  // UNIT-09
  it("returns desc for createdAt", () => {
    expect(defaultSortDir("createdAt")).toBe("desc");
  });

  it("returns asc for summary", () => {
    expect(defaultSortDir("summary")).toBe("asc");
  });

  it("returns desc for requestedPriority", () => {
    expect(defaultSortDir("requestedPriority")).toBe("desc");
  });

  it("returns desc for status", () => {
    expect(defaultSortDir("status")).toBe("desc");
  });
});
