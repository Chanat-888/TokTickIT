import { describe, expect, it } from "vitest";
import { STATUS_TRANSITIONS } from "../../src/app.js";

// UNIT-05 — BR-19 / specification.md §5's transition matrix, mirrored here
// so a future edit to STATUS_TRANSITIONS that silently drops or adds a pair
// is caught without going through the API.
const ALL_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const EXPECTED_MATRIX: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

describe("STATUS_TRANSITIONS", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const allowed = EXPECTED_MATRIX[from].includes(to);
      it(`${from} -> ${to} is ${allowed ? "allowed" : "not allowed"}`, () => {
        expect((STATUS_TRANSITIONS[from] ?? []).includes(to)).toBe(allowed);
      });
    }
  }

  it("Cancelled has no legal outgoing transitions at all", () => {
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
