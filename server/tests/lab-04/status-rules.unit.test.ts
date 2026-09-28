import { describe, expect, it } from "vitest";
import { STATUS_TRANSITIONS } from "../../src/app.js";
import { TICKET_STATUSES, parseStatusList } from "../../src/statusFilter.js";

// specification.md §5 — the Lab 3 matrix, reconfirmed unchanged for Lab 4.
const ALLOWED: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

describe("Status-transition matrix (BR-15)", () => {
  // UNIT-04
  it("allows exactly the pairs in specification.md §5 and rejects every other pair, including from Cancelled", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        const allowed = (STATUS_TRANSITIONS[from] ?? []).includes(to);
        expect(allowed, `${from} -> ${to}`).toBe(ALLOWED[from].includes(to));
      }
    }
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("parseStatusList (BR-27)", () => {
  // UNIT-05
  it("parses a comma-separated list, and a single value behaves as before", () => {
    expect(parseStatusList("NEW,OPEN")).toEqual({ statuses: ["NEW", "OPEN"] });
    expect(parseStatusList("RESOLVED")).toEqual({ statuses: ["RESOLVED"] });
    expect(parseStatusList(" NEW , OPEN ")).toEqual({ statuses: ["NEW", "OPEN"] });
    expect(parseStatusList("NEW,NEW,OPEN")).toEqual({ statuses: ["NEW", "OPEN"] });
  });

  it("rejects an unknown token, an empty token, and an empty value", () => {
    expect(parseStatusList("NEW,BOGUS").error).toBeDefined();
    expect(parseStatusList("BOGUS").error).toBeDefined();
    expect(parseStatusList("NEW,").error).toBeDefined();
    expect(parseStatusList("").error).toBeDefined();
    expect(parseStatusList("new").error).toBeDefined();
  });
});
