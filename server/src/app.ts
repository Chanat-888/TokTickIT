import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Prisma, type Ticket, type Attachment, type PublicComment, type User } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticketNumber.js";
import { validateTicketInput } from "./ticketValidation.js";
import { storeUploadedFile, UPLOADS_DIR } from "./uploads.js";
import {
  SESSION_COOKIE_NAME,
  createSession,
  deleteSession,
  deleteOtherSessions,
  hashPassword,
  isValidPassword,
  toUserRepresentation,
  verifyPassword,
  verifyPasswordForUnknownEmail,
} from "./auth.js";
import { requireAuth, requirePasswordChanged, requireRole } from "./middleware.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB.

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// docs/lab-03/specification.md §11.3 — the client runs on a different port
// (same site, cross-origin), so cookies need an explicit allowed origin and
// credentials:true; a wildcard origin cannot be combined with credentials.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

// docs/lab-03/api-spec.md §0.1/§0.2 — applied per-route below, not as a
// blanket /api mount: /api/health, /api/categories, and /api/related-systems
// stay unauthenticated, unchanged from Lab 2 (categories.test.ts and the
// reference-data checks in create-ticket.api.test.ts depend on this). Every
// Ticket/Attachment route gets [requireAuth, requirePasswordChanged,
// requireRole("REQUESTER")] explicitly; /auth/logout, /auth/me, and
// /auth/change-password get requireAuth alone, since those three must stay
// reachable while mustChangePassword is still true.
const requireRequester = [requireAuth, requirePasswordChanged, requireRole("REQUESTER")];
// docs/lab-03/api-spec.md §2 — Public Comment endpoints are reachable by
// every role (Requester owner, IT Staff, Administrator); ownership is
// enforced separately in-handler only for a Requester caller.
const requireAnyRole = [
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"),
];

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Lab 3 — Authentication (docs/lab-03/api-spec.md §1)
// ---------------------------------------------------------------------------

// BR-09: unknown email and wrong password return the identical message.
const INVALID_CREDENTIALS_BODY = { error: "Invalid email or password" };

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) {
      return res.status(400).json({
        errors: [{ field: "email", message: "Email and password are required" }],
      });
    }

    const user = await getPrisma().user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    if (!user) {
      // BR-09: run the same-cost dummy compare so timing doesn't reveal that
      // this email has no account.
      await verifyPasswordForUnknownEmail(body.password);
      return res.status(401).json(INVALID_CREDENTIALS_BODY);
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return res.status(401).json(INVALID_CREDENTIALS_BODY);
    }
    // BR-10: correct credentials, inactive account — distinct 403, checked
    // only once credentials are confirmed correct (never reveals inactive
    // state for a wrong password).
    if (!user.isActive) {
      return res.status(403).json({ error: "This account is inactive" });
    }

    const { token, expiresAt } = await createSession(user.id);
    res.cookie(SESSION_COOKIE_NAME, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
    return res.status(200).json(toUserRepresentation(user));
  } catch (err) {
    console.error("POST /auth/login failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.post("/auth/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (token) await deleteSession(token);
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /auth/logout failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.status(200).json(toUserRepresentation(req.user!));
});

app.post("/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      return res.status(400).json({
        errors: [{ field: "newPassword", message: "Current and new password are required" }],
      });
    }

    const user = req.user!;
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    if (!isValidPassword(body.newPassword) || body.newPassword === body.currentPassword) {
      return res.status(400).json({
        errors: [
          {
            field: "newPassword",
            message:
              body.newPassword === body.currentPassword
                ? "New password must be different from the current password"
                : "Password must be at least 8 characters and include a letter and a digit",
          },
        ],
      });
    }

    const passwordHash = await hashPassword(body.newPassword);
    const updated = await getPrisma().user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    // BR-35: invalidate the user's other active sessions; keep this one.
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string;
    await deleteOtherSessions(user.id, token);

    return res.status(200).json(toUserRepresentation(updated));
  } catch (err) {
    console.error("POST /auth/change-password failed:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
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
// Issue 18 — Create Ticket
// Shared helpers used by every Ticket/Attachment endpoint below.
// ---------------------------------------------------------------------------

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
    // api-spec.md §0.4 — the only field the Requester-facing shape gains in
    // Lab 3; ownerId internals stay off this representation (§0.4).
    requesterIndicatedResolvedAt: t.requesterIndicatedResolvedAt
      ? t.requesterIndicatedResolvedAt.toISOString()
      : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// api-spec.md §0.4 — shared representation for PublicComment and
// InternalNote rows.
function commentToJSON(c: PublicComment & { author: User }) {
  return {
    id: c.id,
    ticketId: c.ticketId,
    authorId: c.authorId,
    authorName: c.author.name,
    authorRole: c.author.role,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
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
app.post("/api/tickets", requireRequester, async (req: Request, res: Response) => {
  try {
    const requesterId = req.user!.id;

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
            // BR-17: IT Priority starts equal to Requested Priority.
            itPriority: value.requestedPriority,
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
  requireRequester,
  handleAttachmentUpload,
  async (req: Request, res: Response) => {
    try {
      const requesterId = req.user!.id;

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

app.get("/api/tickets", requireRequester, async (req: Request, res: Response) => {
  try {
    const requesterId = req.user!.id;

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
app.get("/api/tickets/:id", requireRequester, async (req: Request, res: Response) => {
  try {
    const requesterId = req.user!.id;

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

// ---------------------------------------------------------------------------
// Issue 21 — Attachment metadata, download/preview, soft-removal
// (api-spec.md §8, §9, §10)
// ---------------------------------------------------------------------------

// Shared by all three routes below: resolves the Attachment (with its parent
// Ticket) and checks it exists, belongs to the caller, and that the
// ticketId in the URL actually matches the attachment's own ticket — a
// malformed/non-integer id is treated as not-found, matching the existing
// GET /api/tickets/:id convention.
async function findOwnedAttachment(
  ticketIdParam: string,
  attachmentIdParam: string,
  requesterId: number,
): Promise<(Attachment & { ticket: Ticket }) | null> {
  if (!/^\d+$/.test(ticketIdParam) || !/^\d+$/.test(attachmentIdParam)) {
    return null;
  }
  const ticketId = Number(ticketIdParam);
  const attachmentId = Number(attachmentIdParam);
  const attachment = await getPrisma().attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: true },
  });
  if (!attachment || attachment.ticketId !== ticketId || attachment.ticket.requesterId !== requesterId) {
    return null;
  }
  return attachment;
}

// api-spec.md §8 — metadata only, never the file body; a removed Attachment
// still 404s BR-10's ownership checks the same as any other, but does NOT
// 404 for being removed (that rule is download-specific, §9).
app.get(
  "/api/tickets/:ticketId/attachments/:attachmentId",
  requireRequester,
  async (req: Request, res: Response) => {
    try {
      const attachment = await findOwnedAttachment(
        req.params.ticketId,
        req.params.attachmentId,
        req.user!.id,
      );
      if (!attachment) {
        return res.status(404).json({ error: "Not found" });
      }

      return res.status(200).json(attachmentToJSON(attachment));
    } catch (err) {
      console.error(
        `GET /api/tickets/${req.params.ticketId}/attachments/${req.params.attachmentId} failed:`,
        err,
      );
      res.status(500).json({ error: "Unexpected server error" });
    }
  },
);

// api-spec.md §9 — streams the file; also serves as "preview" per BR-35. A
// removed Attachment 404s here even for its own owner (BR-32, AC-21) — the
// only one of the three routes where isRemoved changes the response. The
// Lab 2 `?requesterId=` query fallback for plain `<a href>` navigation is
// gone: the session cookie is sent automatically on same-site navigation,
// so the header-only workaround it existed for no longer applies.
app.get(
  "/api/tickets/:ticketId/attachments/:attachmentId/download",
  requireRequester,
  async (req: Request, res: Response) => {
    try {
      const attachment = await findOwnedAttachment(
        req.params.ticketId,
        req.params.attachmentId,
        req.user!.id,
      );
      if (!attachment || attachment.removedAt !== null) {
        return res.status(404).json({ error: "Not found" });
      }

      const filePath = path.join(UPLOADS_DIR, attachment.storedFilename);
      try {
        await stat(filePath);
      } catch {
        // A DB row with no matching file on disk is an unexpected server-side
        // inconsistency, not "no such attachment for you" — 500, not 404.
        console.error(`Attachment file missing from disk: ${filePath}`);
        return res.status(500).json({ error: "Unexpected server error" });
      }

      res.setHeader("Content-Type", attachment.mimeType);
      const stream = createReadStream(filePath);
      stream.on("error", (streamErr) => {
        console.error(`Attachment stream failed for ${filePath}:`, streamErr);
        if (!res.headersSent) res.status(500).json({ error: "Unexpected server error" });
      });
      stream.pipe(res);
    } catch (err) {
      console.error(
        `GET /api/tickets/${req.params.ticketId}/attachments/${req.params.attachmentId}/download failed:`,
        err,
      );
      res.status(500).json({ error: "Unexpected server error" });
    }
  },
);

// api-spec.md §10 — soft-remove: sets removedAt/removalReason, never deletes
// the underlying file (BR-31), and never touches server/src/uploads.ts.
app.delete(
  "/api/tickets/:ticketId/attachments/:attachmentId",
  requireRequester,
  async (req: Request, res: Response) => {
    try {
      // BR-34 — checked on the raw length, no trimming (api-spec.md §8
      // OQ-TEST-2 / API-60); checked before the 404 ownership lookup, same
      // 400-before-404 convention as upload (api-spec.md §12 OQ-9).
      const body = (req.body ?? {}) as { reason?: unknown };
      const reason = typeof body.reason === "string" ? body.reason : undefined;
      if (reason !== undefined && reason.length > 200) {
        return res.status(400).json({
          errors: [{ field: "reason", message: "Reason must be 200 characters or fewer" }],
        });
      }

      const attachment = await findOwnedAttachment(
        req.params.ticketId,
        req.params.attachmentId,
        req.user!.id,
      );
      if (!attachment) {
        return res.status(404).json({ error: "Not found" });
      }

      if (attachment.removedAt !== null) {
        return res.status(409).json({ error: "Attachment already removed" });
      }

      const updated = await getPrisma().attachment.update({
        where: { id: attachment.id },
        data: { removedAt: new Date(), removalReason: reason ?? null },
      });
      // BR-39: removal also touches the parent Ticket's updatedAt.
      await getPrisma().ticket.update({ where: { id: attachment.ticketId }, data: {} });

      return res.status(200).json(attachmentToJSON(updated));
    } catch (err) {
      console.error(
        `DELETE /api/tickets/${req.params.ticketId}/attachments/${req.params.attachmentId} failed:`,
        err,
      );
      res.status(500).json({ error: "Unexpected server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// Issue 39 — Public Comments and "Problem Appears Resolved"
// (docs/lab-03/api-spec.md §2)
// ---------------------------------------------------------------------------

// Shared by POST/GET .../comments: resolves the Ticket and, for a
// Requester caller only, enforces ownership (BR-03) — IT Staff and
// Administrator may act on any Ticket (FR-14).
async function findAccessibleTicket(idParam: string, user: User): Promise<Ticket | null> {
  if (!/^\d+$/.test(idParam)) return null;
  const ticket = await getPrisma().ticket.findUnique({ where: { id: Number(idParam) } });
  if (!ticket) return null;
  if (user.role === "REQUESTER" && ticket.requesterId !== user.id) return null;
  return ticket;
}

// BR-21: empty/whitespace-only (after trimming) or over 2000 raw characters.
function commentBodyError(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return "Comment cannot be empty";
  }
  if (raw.length > 2000) {
    return "Comment must be 2000 characters or fewer";
  }
  return null;
}

app.post("/api/tickets/:id/comments", requireAnyRole, async (req: Request, res: Response) => {
  try {
    const ticket = await findAccessibleTicket(req.params.id, req.user!);
    if (!ticket) {
      return res.status(404).json({ error: "Not found" });
    }

    // BR-22: authorId always comes from the session; any client-supplied
    // authorId in the body is ignored.
    const body = (req.body ?? {}) as { body?: unknown };
    const error = commentBodyError(body.body);
    if (error) {
      return res.status(400).json({ errors: [{ field: "body", message: error }] });
    }

    const created = await getPrisma().publicComment.create({
      // BR-21 trims for the empty/length check; trim for storage too so a
      // comment's saved body matches what was actually validated.
      data: { ticketId: ticket.id, authorId: req.user!.id, body: (body.body as string).trim() },
      include: { author: true },
    });

    return res.status(201).json(commentToJSON(created));
  } catch (err) {
    console.error(`POST /api/tickets/${req.params.id}/comments failed:`, err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/tickets/:id/comments", requireAnyRole, async (req: Request, res: Response) => {
  try {
    const ticket = await findAccessibleTicket(req.params.id, req.user!);
    if (!ticket) {
      return res.status(404).json({ error: "Not found" });
    }

    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { author: true },
    });

    return res.status(200).json({ data: comments.map(commentToJSON) });
  } catch (err) {
    console.error(`GET /api/tickets/${req.params.id}/comments failed:`, err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

// BR-24/AC-11: records a flag/timestamp without changing Status; a
// Closed/Cancelled Ticket has nothing actionable left for the Requester, so
// it 404s the same as a nonexistent or unowned Ticket rather than leaking
// terminal-state detail (api-spec.md §2).
app.post(
  "/api/tickets/:id/resolve-indication",
  requireRequester,
  async (req: Request, res: Response) => {
    try {
      const requesterId = req.user!.id;
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(404).json({ error: "Not found" });
      }
      const ticket = await getPrisma().ticket.findUnique({ where: { id: Number(req.params.id) } });
      if (
        !ticket ||
        ticket.requesterId !== requesterId ||
        ticket.status === "CLOSED" ||
        ticket.status === "CANCELLED"
      ) {
        return res.status(404).json({ error: "Not found" });
      }

      // BR-24 records *when the Requester first indicated this* — a second
      // call (the client already hides the control, but the endpoint stays
      // reachable directly) returns the Ticket unchanged rather than
      // overwriting the original timestamp.
      const updated = ticket.requesterIndicatedResolvedAt
        ? ticket
        : await getPrisma().ticket.update({
            where: { id: ticket.id },
            data: { requesterIndicatedResolvedAt: new Date() },
          });

      return res.status(200).json(ticketToJSON(updated));
    } catch (err) {
      console.error(`POST /api/tickets/${req.params.id}/resolve-indication failed:`, err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  },
);

export default app;
