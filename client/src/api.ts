const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 — call the backend health endpoint.
// Throwing on failure lets the UI show a single Offline/error state.
// The timeout covers the case where the backend accepts the connection but
// never responds — without it the UI would stay on "Checking system" forever.
// TODO(Issue 4): after GET /api/categories exists, fetch it here and return
// the real list instead of the empty array below.
export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }

  return { online: true, categories: [] };
}
