/**
 * Idempotency Middleware — enforces Idempotency-Key on all /v2 mutation endpoints.
 *
 * Every POST/PUT/PATCH/DELETE to /v2 must include an `Idempotency-Key` header.
 * This middleware rejects requests without it (400) and passes the key through
 * to downstream handlers via `req.idempotencyKey`.
 */

import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  const key = req.headers["idempotency-key"];
  if (!key || typeof key !== "string" || key.trim().length === 0) {
    res.status(400).json({
      error: "Idempotency-Key header is required for all mutation requests",
    });
    return;
  }

  req.idempotencyKey = key.trim();
  next();
}
