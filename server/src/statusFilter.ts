// docs/lab-04/specification.md BR-27 — the `status` list-filter parameter
// accepts one status or a comma-separated list.

export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

const KNOWN = new Set<string>(TICKET_STATUSES);

export function parseStatusList(raw: string): { statuses?: TicketStatusValue[]; error?: string } {
  const tokens = raw.split(",").map((t) => t.trim());
  if (tokens.some((t) => !KNOWN.has(t))) {
    return { error: "status must be one or more recognized Ticket statuses, comma-separated" };
  }
  return { statuses: [...new Set(tokens)] as TicketStatusValue[] };
}
