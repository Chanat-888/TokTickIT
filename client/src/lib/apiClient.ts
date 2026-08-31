import { getSelectedRequester } from "./requesterContext.js";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// BR-37 / specification.md §11.1: every Ticket/Attachment request carries
// X-Requester-Id from the current selection. Reference-data endpoints don't
// need it, but sending it is harmless — it's simply omitted when nothing is
// selected yet.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requester = getSelectedRequester();
  const headers = new Headers(init.headers);
  if (requester) {
    headers.set("X-Requester-Id", String(requester.id));
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}
