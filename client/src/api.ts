import { API_URL, apiFetch } from "./lib/apiClient.js";
import { getSelectedRequester } from "./lib/requesterContext.js";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH";

// api-spec.md §0.3 — the shared Ticket representation.
export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
  status: "NEW";
  createdAt: string;
  updatedAt: string;
}

// api-spec.md §0.3 — the shared Attachment representation.
export interface Attachment {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

// Issue 17 — active Development Requesters, for the Requester Selection
// screen. No X-Requester-Id header required (api-spec.md §0.1): this is the
// endpoint that runs before a Requester is chosen, so it deliberately uses a
// plain fetch rather than the apiClient wrapper.
// The timeout covers the case where the backend accepts the connection but
// never responds — without it the screen would stay on "Loading Requesters…"
// forever.
export async function getRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Requesters fetch failed with status ${res.status}`);
  }
  return (await res.json()) as Requester[];
}

// Issue 18 — active Categories, for the Create Ticket category dropdown. No
// X-Requester-Id header required (api-spec.md §0.1).
export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Categories fetch failed with status ${res.status}`);
  }
  return (await res.json()) as Category[];
}

// Issue 18 — active Related Systems, for the Create Ticket related-system
// dropdown. No X-Requester-Id header required (api-spec.md §0.1).
export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Related systems fetch failed with status ${res.status}`);
  }
  return (await res.json()) as RelatedSystem[];
}

// Issue 18 — create a Ticket (api-spec.md §4). 400 (field validation) is
// returned to the caller as data, not thrown, so CreateTicketForm can render
// per-field messages; any other non-2xx status throws, since it's not a
// form-correctable failure (BR-19, AC-23).
export type CreateTicketResult =
  | { status: 201 | 200; ticket: Ticket }
  | { status: 400; errors: FieldError[] };

export async function createTicket(
  input: CreateTicketInput,
  idempotencyKey: string,
): Promise<CreateTicketResult> {
  const res = await apiFetch("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });

  if (res.status === 201 || res.status === 200) {
    return { status: res.status, ticket: (await res.json()) as Ticket };
  }
  if (res.status === 400) {
    const body = (await res.json()) as { errors: FieldError[] };
    return { status: 400, errors: body.errors };
  }
  throw new Error(`Create ticket failed with status ${res.status}`);
}

// api-spec.md §5 — the shared pagination-metadata shape.
export interface TicketListResult {
  data: Ticket[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface TicketListParams {
  search?: string;
  categoryId?: number;
  requestedPriority?: Priority;
  status?: "NEW";
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// Issue 19 — My Tickets list (api-spec.md §5). Every control on this screen
// only ever sends values it itself defined, so a 400 here is a programming
// error, not user input to fix inline — thrown like any other non-2xx
// status rather than returned as data.
export async function getTickets(params: TicketListParams): Promise<TicketListResult> {
  const query = new URLSearchParams();
  if (params.search !== undefined) query.set("search", params.search);
  if (params.categoryId !== undefined) query.set("categoryId", String(params.categoryId));
  if (params.requestedPriority !== undefined) query.set("requestedPriority", params.requestedPriority);
  if (params.status !== undefined) query.set("status", params.status);
  if (params.sortBy !== undefined) query.set("sortBy", params.sortBy);
  if (params.sortDir !== undefined) query.set("sortDir", params.sortDir);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const res = await apiFetch(`/api/tickets${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`Tickets fetch failed with status ${res.status}`);
  }
  return (await res.json()) as TicketListResult;
}

// Issue 18 — upload up to 5 files to an existing owned Ticket
// (api-spec.md §7, upload only). Throws on any non-2xx status; a failed
// upload doesn't fail the Ticket that was already created (BR-20).
export async function uploadAttachments(ticketId: number, files: File[]): Promise<Attachment[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await apiFetch(`/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Attachment upload failed with status ${res.status}`);
  }
  return (await res.json()) as Attachment[];
}

// api-spec.md §0.3, §6 — the Ticket representation plus its Attachments.
export interface TicketDetail extends Ticket {
  attachments: Attachment[];
}

// Issue 20 — thrown by getTicket on a 404, so the screen can render the
// not-found panel specifically rather than the generic failure banner
// (BR-10, BR-36: missing vs. cross-Requester are indistinguishable).
export class NotFoundError extends Error {}

export async function getTicket(id: number): Promise<TicketDetail> {
  const res = await apiFetch(`/api/tickets/${id}`);
  if (res.status === 404) {
    throw new NotFoundError("Not found");
  }
  if (!res.ok) {
    throw new Error(`Ticket fetch failed with status ${res.status}`);
  }
  return (await res.json()) as TicketDetail;
}

// Issue 21 — one Attachment's metadata (api-spec.md §8). Used before a
// Preview/Download navigation to check whether the attachment was removed
// since the Ticket was last loaded (ui-spec.md §17 "Unavailable" state).
export class AttachmentNotFoundError extends Error {}

export async function getAttachment(ticketId: number, attachmentId: number): Promise<Attachment> {
  const res = await apiFetch(`/api/tickets/${ticketId}/attachments/${attachmentId}`);
  if (res.status === 404) {
    throw new AttachmentNotFoundError("Not found");
  }
  if (!res.ok) {
    throw new Error(`Attachment fetch failed with status ${res.status}`);
  }
  return (await res.json()) as Attachment;
}

// Issue 21 — builds the absolute download URL (api-spec.md §9), used as a
// plain <a href> so the file opens/downloads directly in the browser rather
// than being fetched-then-blobbed (BR-35). A plain link navigation can't
// carry the X-Requester-Id header apiFetch normally attaches, so — as a
// deviation scoped to this one endpoint only — the requester id is appended
// as a `requesterId` query param instead; the server route accepts either
// (api-spec.md §9, TASK 4 of Issue #21).
export function downloadAttachmentUrl(ticketId: number, attachmentId: number): string {
  const requester = getSelectedRequester();
  const query = requester ? `?requesterId=${requester.id}` : "";
  return `${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}/download${query}`;
}

// Issue 21 — thrown by removeAttachment on a 409, so the UI can show a
// specific "already removed" message if that race occurs.
export class AlreadyRemovedError extends Error {}

// Issue 21 — soft-remove an Attachment (api-spec.md §10, BR-31/BR-34).
export async function removeAttachment(
  ticketId: number,
  attachmentId: number,
  reason?: string,
): Promise<Attachment> {
  const res = await apiFetch(`/api/tickets/${ticketId}/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason !== undefined ? { reason } : {}),
  });
  if (res.status === 409) {
    throw new AlreadyRemovedError("Attachment already removed");
  }
  if (!res.ok) {
    throw new Error(`Attachment removal failed with status ${res.status}`);
  }
  return (await res.json()) as Attachment;
}
