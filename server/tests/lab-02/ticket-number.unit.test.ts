import { describe, expect, it } from "vitest";
import {
  buildTicketNumber,
  generateTicketNumber,
  TicketNumberGenerationError,
} from "../../src/ticketNumber.js";

describe("buildTicketNumber", () => {
  // UNIT-01
  it("zero-pads the sequence to 6 digits and includes the correct year", () => {
    expect(buildTicketNumber(2026, 1)).toBe("TKT-2026-000001");
    expect(buildTicketNumber(2026, 42)).toBe("TKT-2026-000042");
    expect(buildTicketNumber(2026, 123456)).toBe("TKT-2026-123456");
  });
});

describe("generateTicketNumber", () => {
  // UNIT-02
  it("retries on a mocked unique-constraint collision, up to 5 attempts, then gives up", async () => {
    let attempts = 0;
    const countCandidates = async () => 0; // always proposes seq 1
    const attemptInsert = async () => {
      attempts += 1;
      return false; // every attempt collides
    };

    await expect(generateTicketNumber(2026, countCandidates, attemptInsert)).rejects.toThrow(
      TicketNumberGenerationError,
    );
    expect(attempts).toBe(5);
  });

  it("returns the winning candidate once attemptInsert reports success", async () => {
    let attempts = 0;
    const countCandidates = async () => attempts; // count grows as retries happen
    const attemptInsert = async () => {
      attempts += 1;
      return attempts === 3; // succeeds on the 3rd try
    };

    const result = await generateTicketNumber(2026, countCandidates, attemptInsert);

    expect(result).toBe("TKT-2026-000003");
    expect(attempts).toBe(3);
  });
});
