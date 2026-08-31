import { API_URL } from "./lib/apiClient.js";

export interface Category {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
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
