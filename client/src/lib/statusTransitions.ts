import type { TicketStatus } from "../api.js";

// specification.md §5 "Status transition matrix" (BR-19) — mirrors the
// server-side STATUS_TRANSITIONS in server/src/app.ts exactly, so the
// Status select only ever offers legally-reachable targets (ui-spec.md
// §5.6): illegal targets are absent from the DOM, not disabled options.
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

export function allowedStatusTargets(current: TicketStatus): TicketStatus[] {
  return STATUS_TRANSITIONS[current];
}

// specification.md §5 — transitions to these two require a confirmation
// step before the request is sent.
export function statusRequiresConfirmation(status: TicketStatus): boolean {
  return status === "CANCELLED" || status === "CLOSED";
}
