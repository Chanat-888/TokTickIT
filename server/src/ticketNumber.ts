// Issue 18 — Ticket Number generation (BR-01, BR-38).

const MAX_ATTEMPTS = 5;

// BR-01: "TKT-YYYY-NNNNNN", sequence zero-padded to 6 digits.
export function buildTicketNumber(year: number, seq: number): string {
  return `TKT-${year}-${String(seq).padStart(6, "0")}`;
}

export class TicketNumberGenerationError extends Error {
  constructor() {
    super(`Unable to generate a unique ticket number after ${MAX_ATTEMPTS} attempts`);
    this.name = "TicketNumberGenerationError";
  }
}

// BR-38: on a ticketNumber unique-constraint collision, retry with a
// recounted candidate, up to 5 attempts total. `countCandidates` and
// `attemptInsert` are injected so this retry loop is unit-testable without a
// real Prisma client — the caller (POST /api/tickets) supplies an
// `attemptInsert` that performs the real Ticket insert and reports back
// whether it collided (false) or succeeded (true); any other failure should
// reject.
export async function generateTicketNumber(
  year: number,
  countCandidates: (year: number) => Promise<number>,
  attemptInsert: (ticketNumber: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = await countCandidates(year);
    const candidate = buildTicketNumber(year, count + 1);
    const inserted = await attemptInsert(candidate);
    if (inserted) return candidate;
  }
  throw new TicketNumberGenerationError();
}
