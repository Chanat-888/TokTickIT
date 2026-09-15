// Lab 3 request-gating middleware — docs/lab-03/api-spec.md §0.1/§0.2.
// Order per §0.1/§0.2: requireAuth (401) -> requirePasswordChanged (403)
// -> requireRole (403).

import type { Request, Response, NextFunction } from "express";
import type { Role, User } from "@prisma/client";
import { SESSION_COOKIE_NAME, getSessionUser } from "./auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const user = await getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = user;
  next();
}

// Must run after requireAuth. Blocks every route except the three exempted
// by api-spec.md §0.1 (those routes simply don't apply this middleware).
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (req.user!.mustChangePassword) {
    return res.status(403).json({ error: "Password change required" });
  }
  next();
}

// Must run after requireAuth.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
