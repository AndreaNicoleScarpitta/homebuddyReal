/**
 * Simple double-submit CSRF protection.
 *
 * Strategy: On every authenticated response we set a `csrf-token` cookie
 * (non-httpOnly so JS can read it). Mutating requests (POST/PUT/PATCH/DELETE)
 * must include an `x-csrf-token` header whose value matches the cookie.
 *
 * Combined with SameSite=Lax cookies this gives solid CSRF protection.
 */
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Middleware: ensure a CSRF token cookie exists, enforce on mutations. */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Ensure token cookie exists
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // JS must read this to send back in header
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  // Safe methods don't need verification
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Skip CSRF for webhook endpoints (they use their own signature verification)
  if (req.path.startsWith("/api/stripe/webhook")) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  if (!headerToken || headerToken !== token) {
    logger.warn({ path: req.path, method: req.method }, "CSRF token mismatch");
    res.status(403).json({ message: "Invalid or missing CSRF token" });
    return;
  }

  next();
}

/** Expose the CSRF token via a lightweight endpoint so the SPA can fetch it. */
export function registerCsrfRoute(app: import("express").Express): void {
  app.get("/api/csrf-token", (req, res) => {
    let token = req.cookies?.[CSRF_COOKIE];
    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    res.json({ token });
  });
}
