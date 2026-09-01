// Issue 18 — POST /api/tickets body validation (api-spec.md §4).
// categoryId/relatedSystemId existence and active-row checks happen in the
// route (server/src/app.ts), since they need the database.

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
}

const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function validateTicketInput(
  body: unknown,
): { errors: FieldError[] } | { value: ValidTicketInput } {
  const errors: FieldError[] = [];
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  let categoryId: number | undefined;
  if (!isPositiveInteger(b.categoryId)) {
    errors.push({ field: "categoryId", message: "Category is required" });
  } else {
    categoryId = b.categoryId;
  }

  let relatedSystemId: number | undefined;
  if (!isPositiveInteger(b.relatedSystemId)) {
    errors.push({ field: "relatedSystemId", message: "Related System is required" });
  } else {
    relatedSystemId = b.relatedSystemId;
  }

  // BR-14: trimmed before measuring length.
  let summary: string | undefined;
  if (typeof b.summary !== "string") {
    errors.push({ field: "summary", message: "Summary is required" });
  } else {
    const trimmed = b.summary.trim();
    if (trimmed.length === 0) {
      errors.push({ field: "summary", message: "Summary is required" });
    } else if (trimmed.length < 5 || trimmed.length > 120) {
      errors.push({ field: "summary", message: "Summary must be between 5 and 120 characters" });
    } else {
      summary = trimmed;
    }
  }

  let description: string | undefined;
  if (typeof b.description !== "string") {
    errors.push({ field: "description", message: "Description is required" });
  } else {
    const trimmed = b.description.trim();
    if (trimmed.length === 0) {
      errors.push({ field: "description", message: "Description is required" });
    } else if (trimmed.length < 10 || trimmed.length > 2000) {
      errors.push({
        field: "description",
        message: "Description must be between 10 and 2000 characters",
      });
    } else {
      description = trimmed;
    }
  }

  let requestedPriority: ValidTicketInput["requestedPriority"] | undefined;
  if (typeof b.requestedPriority !== "string" || !PRIORITIES.has(b.requestedPriority)) {
    errors.push({
      field: "requestedPriority",
      message: "Requested Priority must be LOW, MEDIUM, or HIGH",
    });
  } else {
    requestedPriority = b.requestedPriority as ValidTicketInput["requestedPriority"];
  }

  if (errors.length > 0) return { errors };

  return {
    value: {
      categoryId: categoryId!,
      relatedSystemId: relatedSystemId!,
      summary: summary!,
      description: description!,
      requestedPriority: requestedPriority!,
    },
  };
}
