const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
// Issue 2 — call the backend health endpoint.
// Issue 4 — then fetch the seeded categories.
// Throwing on either failure lets the UI show a single Offline/error state.
// The timeout covers the case where the backend accepts the connection but
// never responds — without it the UI would stay on "Checking system" forever.
// Each fetch needs its own signal; a timeout signal cannot be reused.
export async function checkSystem() {
    const res = await fetch(`${API_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
        throw new Error(`Health check failed with status ${res.status}`);
    }
    const categoriesRes = await fetch(`${API_URL}/api/categories`, {
        signal: AbortSignal.timeout(5000),
    });
    if (!categoriesRes.ok) {
        throw new Error(`Category fetch failed with status ${categoriesRes.status}`);
    }
    const categories = (await categoriesRes.json());
    return { online: true, categories };
}
