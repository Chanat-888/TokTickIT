export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Lets authContext learn that a session died server-side (expiry, or an
// Admin deactivating the account mid-session — BR-36) without apiClient
// importing React. apiFetch is a plain module, not a hook, so authContext
// registers a callback here instead.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// docs/lab-03/specification.md §11.3/§11.4 — identity now comes from the
// httpOnly session cookie, not a client-supplied header; credentials:
// "include" is required for the browser to send/receive it across the
// client's different port (same-site, cross-origin).
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  // /auth/* routes are excluded: their own 401s are already meaningful
  // application responses (not logged in yet, wrong current password), not a
  // signal that a previously-valid session just ended — routing them through
  // here too would also risk a refresh()/apiFetch("/auth/me") loop.
  if (res.status === 401 && !path.startsWith("/auth/")) {
    onUnauthorized?.();
  }
  return res;
}
