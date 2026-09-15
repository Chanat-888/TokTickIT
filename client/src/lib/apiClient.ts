export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// docs/lab-03/specification.md §11.3/§11.4 — identity now comes from the
// httpOnly session cookie, not a client-supplied header; credentials:
// "include" is required for the browser to send/receive it across the
// client's different port (same-site, cross-origin).
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
}
