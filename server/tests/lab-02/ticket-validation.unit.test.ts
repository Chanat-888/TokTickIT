import { describe, expect, it } from "vitest";
import { validateTicketInput, type ValidTicketInput } from "../../src/ticketValidation.js";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop won't power on",
    description: "Screen stays black after the firmware update.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

function fieldNames(result: ReturnType<typeof validateTicketInput>): string[] {
  if (!("errors" in result)) return [];
  return result.errors.map((e) => e.field);
}

describe("validateTicketInput", () => {
  // UNIT-03
  it("trims Summary/Description before measuring length (BR-14)", () => {
    const result = validateTicketInput(
      validBody({ summary: "  hi  ", description: "a".repeat(10) }),
    );

    // Trimmed "hi" is length 2, below the 5-char minimum — fails.
    expect(fieldNames(result)).toContain("summary");
  });

  it("stores the trimmed value on success", () => {
    const result = validateTicketInput(validBody({ summary: "  Hello there  " }));

    expect("value" in result).toBe(true);
    expect((result as { value: ValidTicketInput }).value.summary).toBe("Hello there");
  });

  // UNIT-04
  it("enforces the Summary length boundary: 4 fails, 5 passes, 120 passes, 121 fails", () => {
    expect(fieldNames(validateTicketInput(validBody({ summary: "a".repeat(4) })))).toContain(
      "summary",
    );
    expect(fieldNames(validateTicketInput(validBody({ summary: "a".repeat(5) })))).not.toContain(
      "summary",
    );
    expect(fieldNames(validateTicketInput(validBody({ summary: "a".repeat(120) })))).not.toContain(
      "summary",
    );
    expect(fieldNames(validateTicketInput(validBody({ summary: "a".repeat(121) })))).toContain(
      "summary",
    );
  });

  // UNIT-05
  it("enforces the Description length boundary: 9 fails, 10 passes, 2000 passes, 2001 fails", () => {
    expect(
      fieldNames(validateTicketInput(validBody({ description: "a".repeat(9) }))),
    ).toContain("description");
    expect(
      fieldNames(validateTicketInput(validBody({ description: "a".repeat(10) }))),
    ).not.toContain("description");
    expect(
      fieldNames(validateTicketInput(validBody({ description: "a".repeat(2000) }))),
    ).not.toContain("description");
    expect(
      fieldNames(validateTicketInput(validBody({ description: "a".repeat(2001) }))),
    ).toContain("description");
  });

  it("returns every failing field in one pass, not just the first", () => {
    const result = validateTicketInput({
      categoryId: "not-a-number",
      relatedSystemId: null,
      summary: "",
      description: "too short",
      requestedPriority: "URGENT",
    });

    expect(fieldNames(result).sort()).toEqual(
      ["categoryId", "description", "relatedSystemId", "requestedPriority", "summary"].sort(),
    );
  });

  it("requires requestedPriority to be LOW, MEDIUM, or HIGH", () => {
    expect(fieldNames(validateTicketInput(validBody({ requestedPriority: "URGENT" })))).toContain(
      "requestedPriority",
    );
    expect(fieldNames(validateTicketInput(validBody({ requestedPriority: "LOW" })))).not.toContain(
      "requestedPriority",
    );
  });
});
