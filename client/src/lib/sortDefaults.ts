// ui-spec.md §13.2 / OQ-UI-2 — default sortDir when a column is picked as
// sortBy for the first time.
export type SortableTicketField = "createdAt" | "summary" | "requestedPriority" | "status";

const DEFAULT_SORT_DIR: Record<SortableTicketField, "asc" | "desc"> = {
  createdAt: "desc",
  summary: "asc",
  requestedPriority: "desc",
  status: "desc",
};

export function defaultSortDir(sortBy: SortableTicketField): "asc" | "desc" {
  return DEFAULT_SORT_DIR[sortBy];
}
