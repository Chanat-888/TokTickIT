import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { Prisma, type Ticket, type Attachment } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticketNumber.js";
import { validateTicketInput } from "./ticketValidation.js";
import { storeUploadedFile } from "./uploads.js";
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
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    // Log the real error server-side; send the client a message that leaks
    // nothing about the database or the query.
    console.error("GET /api/categories failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
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

// ---------------------------------------------------------------------------
// Issue 18 — Create Ticket
// Shared helpers used by every Ticket/Attachment endpoint below.
// ---------------------------------------------------------------------------

// api-spec.md §0.1 — the same X-Requester-Id check for every Ticket/
// Attachment endpoint: 400 if missing/non-integer, 403 if not an active
// RequesterUser, otherwise proceeds scoped to that Requester.
type RequesterCheck =
  | { ok: true; requesterId: number }
  | {
      ok: false;
      status: 400 | 403;
      body: { errors: { field: string; message: string }[] } | { error: string };
    };

async function checkRequester(req: Request): Promise<RequesterCheck> {
  const raw = req.header("X-Requester-Id");
  const requesterId = raw !== undefined && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(requesterId)) {
    return {
      ok: false,
      status: 400,
      body: {
        errors: [{ field: "X-Requester-Id", message: "Missing or invalid requester header" }],
      },
    };
  }
  const requester = await getPrisma().requesterUser.findUnique({ where: { id: requesterId } });
  if (!requester || !requester.isActive) {
    return { ok: false, status: 403, body: { error: "Selected Requester is not active" } };
  }
  return { ok: true, requesterId };
}

// api-spec.md §0.3 — the shared Ticket representation (no idempotencyKey,
// no attachments field on this endpoint's shape).
function ticketToJSON(t: Ticket) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    requesterId: t.requesterId,
    categoryId: t.categoryId,
    relatedSystemId: t.relatedSystemId,
    summary: t.summary,
    description: t.description,
    requestedPriority: t.requestedPriority,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// api-spec.md §0.3 — the shared Attachment representation (no
// storedFilename; isRemoved is derived from removedAt, not a stored column).
function attachmentToJSON(a: Attachment) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
    isRemoved: a.removedAt !== null,
    removedAt: a.removedAt ? a.removedAt.toISOString() : null,
    removalReason: a.removalReason,
  };
}

function isUniqueConstraintViolation(err: unknown, ...fields: string[]): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targetFields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return fields.every((f) => targetFields.includes(f));
}

// Signals that a concurrent identical request won the (requesterId,
// idempotencyKey) insert race — not a ticketNumber collision, so it must not
// be retried by generateTicketNumber; the route re-fetches and returns 200.
class IdempotencyRaceError extends Error {}

const IDEMPOTENCY_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Issue 18 — Related System list
// RelatedSystem mirrors the Category shape (api-spec.md §2): active rows
// only, ordered by id. No header required (§0.1).
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(relatedSystems);
  } catch (err) {
    console.error("GET /api/related-systems failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

// ---------------------------------------------------------------------------
// Issue 18 — Create Ticket (api-spec.md §4)
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requesterCheck = await checkRequester(req);
    if (!requesterCheck.ok) {
      return res.status(requesterCheck.status).json(requesterCheck.body);
    }
    const { requesterId } = requesterCheck;

    // BR-11: Idempotency-Key is required and must be a valid UUID (any
    // version).
    const idempotencyKey = req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      return res.status(400).json({
        errors: [{ field: "Idempotency-Key", message: "Missing or invalid idempotency key" }],
      });
    }

    // BR-11/BR-12: a replay of an already-used key returns the original
    // Ticket — checked before body validation, since a replay must succeed
    // even if the replayed body happens to be malformed.
    const existing = await getPrisma().ticket.findUnique({
      where: { requesterId_idempotencyKey: { requesterId, idempotencyKey } },
    });
    if (existing) {
      return res.status(200).json(ticketToJSON(existing));
    }

    const validation = validateTicketInput(req.body);
    if ("errors" in validation) {
      return res.status(400).json({ errors: validation.errors });
    }
    const { value } = validation;

    // BR-17: categoryId/relatedSystemId must reference a currently active
    // row — an existence/active check, so it needs the DB and lives here
    // rather than in ticketValidation.ts.
    const [category, relatedSystem] = await Promise.all([
      getPrisma().category.findUnique({ where: { id: value.categoryId } }),
      getPrisma().relatedSystem.findUnique({ where: { id: value.relatedSystemId } }),
    ]);
    const fieldErrors: { field: string; message: string }[] = [];
    if (!category || !category.isActive) {
      fieldErrors.push({ field: "categoryId", message: "Category is not active" });
    }
    if (!relatedSystem || !relatedSystem.isActive) {
      fieldErrors.push({ field: "relatedSystemId", message: "Related System is not active" });
    }
    if (fieldErrors.length > 0) {
      return res.status(400).json({ errors: fieldErrors });
    }

    const year = new Date().getFullYear();
    let createdTicket: Ticket | null = null;

    const countCandidates = (y: number) =>
      getPrisma().ticket.count({ where: { ticketNumber: { startsWith: `TKT-${y}-` } } });

    const attemptInsert = async (candidate: string): Promise<boolean> => {
      try {
        createdTicket = await getPrisma().ticket.create({
          data: {
            ticketNumber: candidate,
            requesterId,
            categoryId: value.categoryId,
            relatedSystemId: value.relatedSystemId,
            summary: value.summary,
            description: value.description,
            requestedPriority: value.requestedPriority,
            status: "NEW",
            idempotencyKey,
          },
        });
        return true;
      } catch (err) {
        // BR-38: a ticketNumber collision is retried with a new candidate.
        if (isUniqueConstraintViolation(err, "ticketNumber")) return false;
        // A different concurrent request won the idempotency race — not a
        // ticketNumber collision, so don't retry; surface it to the outer
        // catch below.
        if (isUniqueConstraintViolation(err, "requesterId", "idempotencyKey")) {
          throw new IdempotencyRaceError();
        }
        throw err;
      }
    };

    try {
      await generateTicketNumber(year, countCandidates, attemptInsert);
    } catch (err) {
      if (err instanceof IdempotencyRaceError) {
        const raced = await getPrisma().ticket.findUnique({
          where: { requesterId_idempotencyKey: { requesterId, idempotencyKey } },
        });
        if (raced) {
          return res.status(200).json(ticketToJSON(raced));
        }
      }
      throw err;
    }

    return res.status(201).json(ticketToJSON(createdTicket!));
  } catch (err) {
    console.error("POST /api/tickets failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

// ---------------------------------------------------------------------------
// Issue 18 — Upload Attachments (api-spec.md §7)
// Upload only; download/preview/removal are a later Issue.
// ---------------------------------------------------------------------------

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_REQUEST = 5;
const MAX_ACTIVE_ATTACHMENTS = 5;

// limits.files is set generously above 5 so a >5-file request reaches the
// handler intact and can be reported as a 409, rather than being silently
// truncated by multer. limits.fileSize is a coarse abuse guard well above
// the real 5MB limit below, so a file this large is rejected by multer
// before being fully buffered into memory; anything between 5MB and 20MB
// still passes multer and is caught by the manual 413 check.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 20 * 1024 * 1024 },
});

// A malformed multipart body (or a non-multipart Content-Type) makes multer
// call back with an error; treated as the 400 "malformed request" case
// rather than an unhandled server error. This also covers a LIMIT_FILE_SIZE
// error from the fileSize guard above — from the client's perspective it's
// still just a bad request, not the 413 business-rule response below.
function handleAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  upload.array("files", 20)(req, res, (err: unknown) => {
    if (err) {
      return res.status(400).json({
        errors: [{ field: "files", message: "Malformed upload request" }],
      });
    }
    next();
  });
}

app.post(
  "/api/tickets/:id/attachments",
  handleAttachmentUpload,
  async (req: Request, res: Response) => {
    try {
      const requesterCheck = await checkRequester(req);
      if (!requesterCheck.ok) {
        return res.status(requesterCheck.status).json(requesterCheck.body);
      }
      const { requesterId } = requesterCheck;

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      // 400 — malformed request only, checked before ownership/count/type/
      // size (api-spec.md §7).
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({
          errors: [{ field: "id", message: "Ticket id must be an integer" }],
        });
      }
      if (files.length === 0) {
        return res.status(400).json({
          errors: [{ field: "files", message: "At least one file is required" }],
        });
      }
      const ticketId = Number(req.params.id);

      // 404 — checked second, after 400, before 409 (api-spec.md §12 OQ-9).
      const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
      if (!ticket || ticket.requesterId !== requesterId) {
        return res.status(404).json({ error: "Not found" });
      }

      // 409 → 415 → 413 precedence (api-spec.md §7).
      if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
        return res.status(409).json({ error: "Too many files in this request" });
      }

      const activeCount = await getPrisma().attachment.count({
        where: { ticketId, removedAt: null },
      });
      if (activeCount + files.length > MAX_ACTIVE_ATTACHMENTS) {
        return res.status(409).json({ error: "Attachment limit reached" });
      }

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext) || !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
          return res.status(415).json({ error: "Unsupported file type" });
        }
      }

      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          return res.status(413).json({ error: "File exceeds 5 MB" });
        }
      }

      // BR-30: nothing is stored or inserted until every check above passes.
      const created: Attachment[] = [];
      for (const file of files) {
        const storedFilename = await storeUploadedFile(file.buffer, file.originalname);
        const attachment = await getPrisma().attachment.create({
          data: {
            ticketId,
            originalFilename: file.originalname,
            storedFilename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
        created.push(attachment);
      }

      // BR-39: a successful upload touches the parent Ticket's updatedAt.
      await getPrisma().ticket.update({ where: { id: ticketId }, data: {} });

      return res.status(201).json(created.map(attachmentToJSON));
    } catch (err) {
      console.error(`POST /api/tickets/${req.params.id}/attachments failed:`, err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// Issue 19 — My Tickets list (api-spec.md §5)
// ---------------------------------------------------------------------------

const SORTABLE_FIELDS = new Set(["createdAt", "summary", "requestedPriority", "status"]);
const SORT_DIRS = new Set(["asc", "desc"]);
const PRIORITIES_FOR_FILTER = new Set(["LOW", "MEDIUM", "HIGH"]);
const PAGE_SIZES = [10, 20, 50];

function clampPageSize(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return 10;
  // On an exact tie (e.g. 15, equidistant from 10 and 20), reduce keeps
  // whichever candidate it reaches first, which is the smaller one since
  // PAGE_SIZES is ascending. Rounding down on a tie has no basis in
  // api-spec.md §12 OQ-8 beyond "nearest allowed value" — it's simply this
  // implementation's tie-break, made explicit here rather than left implicit
  // in reduce's iteration order.
  return PAGE_SIZES.reduce((closest, candidate) =>
    Math.abs(candidate - n) < Math.abs(closest - n) ? candidate : closest,
  );
}

function clampPage(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return 1;
  const truncated = Math.trunc(n);
  return truncated < 1 ? 1 : truncated;
}

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requesterCheck = await checkRequester(req);
    if (!requesterCheck.ok) {
      return res.status(requesterCheck.status).json(requesterCheck.body);
    }
    const { requesterId } = requesterCheck;

    const errors: { field: string; message: string }[] = [];

    // categoryId — 400 if not an integer, or an integer that doesn't
    // reference ANY existing Category row, active or not (api-spec.md §12
    // OQ-2 — different from POST /api/tickets' active-row check).
    let categoryId: number | undefined;
    if (req.query.categoryId !== undefined) {
      const raw = String(req.query.categoryId);
      if (!/^\d+$/.test(raw)) {
        errors.push({ field: "categoryId", message: "categoryId must be an integer" });
      } else {
        const id = Number(raw);
        const category = await getPrisma().category.findUnique({ where: { id } });
        if (!category) {
          errors.push({ field: "categoryId", message: "categoryId does not reference a known Category" });
        } else {
          categoryId = id;
        }
      }
    }

    let requestedPriority: "LOW" | "MEDIUM" | "HIGH" | undefined;
    if (req.query.requestedPriority !== undefined) {
      const raw = String(req.query.requestedPriority);
      if (!PRIORITIES_FOR_FILTER.has(raw)) {
        errors.push({ field: "requestedPriority", message: "Requested Priority must be LOW, MEDIUM, or HIGH" });
      } else {
        requestedPriority = raw as "LOW" | "MEDIUM" | "HIGH";
      }
    }

    let status: "NEW" | undefined;
    if (req.query.status !== undefined) {
      const raw = String(req.query.status);
      if (raw !== "NEW") {
        errors.push({ field: "status", message: "Status must be NEW" });
      } else {
        status = "NEW";
      }
    }

    let sortBy: "createdAt" | "summary" | "requestedPriority" | "status" = "createdAt";
    if (req.query.sortBy !== undefined) {
      const raw = String(req.query.sortBy);
      if (!SORTABLE_FIELDS.has(raw)) {
        errors.push({ field: "sortBy", message: "sortBy must be one of createdAt, summary, requestedPriority, status" });
      } else {
        sortBy = raw as typeof sortBy;
      }
    }

    let sortDir: "asc" | "desc" = "desc";
    if (req.query.sortDir !== undefined) {
      const raw = String(req.query.sortDir);
      if (!SORT_DIRS.has(raw)) {
        errors.push({ field: "sortDir", message: "sortDir must be asc or desc" });
      } else {
        sortDir = raw as typeof sortDir;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // BR-24, api-spec.md §12 OQ-8 — clamped, never rejected.
    const page = clampPage(req.query.page !== undefined ? String(req.query.page) : undefined);
    const pageSize = clampPageSize(req.query.pageSize !== undefined ? String(req.query.pageSize) : undefined);

    const search = req.query.search !== undefined ? String(req.query.search) : undefined;

    const where: Prisma.TicketWhereInput = { requesterId };
    if (categoryId !== undefined) where.categoryId = categoryId;
    if (requestedPriority !== undefined) where.requestedPriority = requestedPriority;
    if (status !== undefined) where.status = status;
    if (search) {
      where.OR = [
        { ticketNumber: { startsWith: search } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    // api-spec.md §12 OQ-7 — id-descending tiebreaker on every sort, not
    // only the default.
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
      { [sortBy]: sortDir },
      { id: "desc" },
    ];

    const [totalCount, tickets] = await Promise.all([
      getPrisma().ticket.count({ where }),
      getPrisma().ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return res.status(200).json({
      data: tickets.map(ticketToJSON),
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (err) {
    console.error("GET /api/tickets failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

// ---------------------------------------------------------------------------
// Issue 20 — Ticket Detail (api-spec.md §6)
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const requesterCheck = await checkRequester(req);
    if (!requesterCheck.ok) {
      return res.status(requesterCheck.status).json(requesterCheck.body);
    }
    const { requesterId } = requesterCheck;

    // Not an integer id — treated as not-found, not a 400 (api-spec.md §6,
    // this endpoint defines no 400 case).
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const ticketId = Number(req.params.id);

    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.requesterId !== requesterId) {
      return res.status(404).json({ error: "Not found" });
    }

    const attachments = await getPrisma().attachment.findMany({
      where: { ticketId },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({
      ...ticketToJSON(ticket),
      attachments: attachments.map(attachmentToJSON),
    });
  } catch (err) {
    console.error(`GET /api/tickets/${req.params.id} failed:`, err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

export default app;
