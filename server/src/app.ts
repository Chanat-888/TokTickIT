import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB.

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Returns every seeded category as { id, name }, ordered by id so the list is
// deterministic for both the UI and the Supertest assertion.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    // Log the real error server-side; send the client a message that leaks
    // nothing about the database or the query.
    console.error("GET /api/categories failed:", err);
    res.status(500).json({ error: "Unable to load categories" });
  }
});

// ---------------------------------------------------------------------------
// Issue 17 — Development Requester list
// Active Requesters only, { id, name } — email is never returned
// (api-spec.md §12 OQ-6). No X-Requester-Id header required (§0.1): this is
// the endpoint that runs before a Requester is chosen.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("GET /api/requesters failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

export default app;
