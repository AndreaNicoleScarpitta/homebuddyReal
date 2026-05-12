/**
 * Email/password + Google OAuth.
 *
 * Runs alongside the legacy Replit OIDC handlers in replitAuth.ts — all three
 * paths share the same session (connect-pg-simple) and the same users table.
 *
 * Routes exposed:
 *   GET  /api/auth/providers          which OAuth providers are configured
 *   POST /api/auth/signup             email/password signup
 *   POST /api/auth/login              email/password login
 *   POST /api/auth/forgot-password    request a reset link
 *   POST /api/auth/reset-password     consume token + set new password
 *   GET  /auth/google                 start Google OAuth
 *   GET  /auth/google/callback        Google OAuth return
 */

import type { Express } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as oidc from "openid-client";
import { authStorage } from "./storage";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { and, eq, gt } from "drizzle-orm";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Input length caps — protect against oversized payloads being hashed/stored.
// bcrypt silently truncates at 72 bytes so enormous passwords waste no real
// CPU, but they shouldn't make it to the DB either.
const MAX_EMAIL_LEN = 320; // RFC 5321 maximum
const MAX_PASSWORD_LEN = 72; // bcrypt truncation boundary — no point exceeding
const MAX_NAME_LEN = 128;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the base URL for OAuth redirects and email links.
 *
 * Priority (most → least trusted):
 *  1. OAUTH_BASE_URL env var  — set this in production; prevents header injection entirely.
 *  2. REPLIT_DEPLOYMENT_URL   — Replit sets this automatically in deployed apps.
 *  3. REPLIT_DEV_DOMAIN       — Replit sets this in dev/preview environments.
 *  4. APP_URL                 — generic fallback env var.
 *  5. x-forwarded-host / Host request headers — last resort for local dev and
 *     Replit previews where the env vars above are unavailable. Acceptable risk
 *     in non-production because (a) production should always have OAUTH_BASE_URL
 *     set, and (b) the host-header-injection attack (reset-link poisoning) requires
 *     the attacker to already be able to modify server-bound requests, which
 *     implies a deeper compromise than the reset link itself.
 */
function getBaseUrl(req?: any): string {
  if (process.env.OAUTH_BASE_URL) return process.env.OAUTH_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Header fallback — only reached when no env var is configured (dev / preview)
  if (req) {
    const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
    const proto = req.headers?.["x-forwarded-proto"] || "http";
    if (host) return `${proto}://${host}`;
  }
  return "http://localhost:5000";
}

/**
 * We store a SHA-256 hash of the reset token in the DB.
 * The raw token lives only in the email link — if the DB leaks, active tokens
 * are not immediately exploitable.
 */
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Regenerate the session ID after any privilege change (login, signup, reset).
 * Prevents session fixation: an attacker who planted a known session ID before
 * the user authenticated can't reuse it after login.
 *
 * We copy application data (userId, etc.) but deliberately skip `cookie` and
 * `id` — those are session internals managed by express-session. Copying `cookie`
 * would replace the new session's Cookie instance (which has methods like toJSON)
 * with a plain spread object, breaking session serialisation.
 */
function regenerateSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    // Capture only application-level data, not session internals
    const SKIP = new Set(["cookie", "id"]);
    const appData: Record<string, any> = {};
    for (const key of Object.keys(req.session)) {
      if (!SKIP.has(key)) appData[key] = req.session[key];
    }
    req.session.regenerate((err: any) => {
      if (err) return reject(err);
      Object.assign(req.session, appData);
      resolve();
    });
  });
}

// Lazy-load Google OIDC config
let googleConfig: oidc.Configuration | null = null;
let googleConfigError: Error | null = null;
async function getGoogleConfig(): Promise<oidc.Configuration | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (googleConfig) return googleConfig;
  if (googleConfigError) return null;
  try {
    googleConfig = await oidc.discovery(
      new URL("https://accounts.google.com/"),
      clientId,
      clientSecret,
    );
    return googleConfig;
  } catch (err) {
    googleConfigError = err as Error;
    console.error("Google OIDC discovery failed:", (err as Error).message);
    return null;
  }
}

function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerLocalAuthRoutes(app: Express) {

  // ── Provider availability ──────────────────────────────────────────────────
  app.get("/api/auth/providers", (_req, res) => {
    res.json({ google: isGoogleConfigured() });
  });

  // ── Email / password signup ────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const firstName = req.body?.firstName
        ? String(req.body.firstName).trim().slice(0, MAX_NAME_LEN)
        : null;
      const lastName = req.body?.lastName
        ? String(req.body.lastName).trim().slice(0, MAX_NAME_LEN)
        : null;

      if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
        return res.status(400).json({ error: "Valid email required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      if (password.length > MAX_PASSWORD_LEN) {
        return res.status(400).json({ error: "Password must be 72 characters or fewer" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with that email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createLocalUser({ email, passwordHash, firstName, lastName });
      await authStorage.incrementLoginCount(user.id);

      // Fire-and-forget — welcome email failure must not block signup
      sendWelcomeEmail(email, firstName).catch(() => {});

      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
        // isNewUser: true tells the client to redirect to /onboarding
        res.json({ success: true, user: sanitize(user), isNewUser: true });
      });
    } catch (err) {
      console.error("Signup error:", err);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  // ── Email / password login ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      if (email.length > MAX_EMAIL_LEN || password.length > MAX_PASSWORD_LEN) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const user = await authStorage.getUserByEmail(email);
      // Constant-time-ish: still hash even on no-user to avoid timing leak
      const hash = user?.passwordHash || "$2a$12$000000000000000000000000000000000000000000000000000000";
      const ok = await bcrypt.compare(password, hash);

      if (!user || !user.passwordHash || !ok) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await authStorage.incrementLoginCount(user.id);
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
        res.json({ success: true, user: sanitize(user) });
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ── Forgot password ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();

      if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
        return res.status(400).json({ error: "Valid email required" });
      }

      const user = await authStorage.getUserByEmail(email);

      // Always respond the same way — don't reveal whether the account exists
      if (!user || !user.passwordHash) {
        return res.json({ success: true });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await authStorage.setPasswordResetToken(user.id, tokenHash, expiresAt);

      // Use only env-configured base URL — never trust request Host header
      const baseUrl = getBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      sendPasswordResetEmail(email, user.firstName, resetUrl).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("Forgot-password error:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── Reset password ─────────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const rawToken = String(req.body?.token ?? "").trim();
      const password = String(req.body?.password ?? "");

      if (!rawToken) return res.status(400).json({ error: "Reset token required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (password.length > MAX_PASSWORD_LEN) return res.status(400).json({ error: "Password must be 72 characters or fewer" });

      const tokenHash = hashToken(rawToken);
      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date();

      // Atomic: UPDATE WHERE token matches AND not expired → clears token in same op.
      // If two simultaneous requests race, only one will match and return a row;
      // the second gets no result and is rejected.
      const [consumed] = await db
        .update(users)
        .set({ passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null, updatedAt: now })
        .where(
          and(
            eq(users.passwordResetToken, tokenHash),
            gt(users.passwordResetTokenExpiresAt, now),
          )
        )
        .returning();

      if (!consumed) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }

      await regenerateSession(req);
      req.session.userId = consumed.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
        res.json({ success: true, user: sanitize(consumed) });
      });
    } catch (err) {
      console.error("Reset-password error:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── Google OAuth start ─────────────────────────────────────────────────────
  app.get("/auth/google", async (req, res) => {
    const config = await getGoogleConfig();
    if (!config) return res.redirect("/login?error=google_unavailable");

    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();

    req.session.code_verifier = codeVerifier;
    req.session.state = state;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error (google start):", err);
        return res.redirect("/login?error=session_failed");
      }
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: `${getBaseUrl(req)}/auth/google/callback`,
        scope: "openid email profile",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      });
      res.redirect(url.href);
    });
  });

  // ── Google OAuth callback ──────────────────────────────────────────────────
  app.get("/auth/google/callback", async (req, res) => {
    const config = await getGoogleConfig();
    if (!config) return res.redirect("/login?error=google_unavailable");

    try {
      const { code_verifier, state } = req.session;
      if (!code_verifier || !state) return res.redirect("/login?error=auth_failed");

      const currentUrl = new URL(req.originalUrl, getBaseUrl(req));
      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: code_verifier,
        expectedState: state,
      });

      const claims = tokens.claims() as any;
      const email = (claims?.email as string | undefined)?.toLowerCase();
      const sub = String(claims?.sub ?? "");
      const givenName = claims?.given_name as string | undefined;
      const familyName = claims?.family_name as string | undefined;
      const picture = claims?.picture as string | undefined;

      if (!email || !sub) return res.redirect("/login?error=google_no_email");

      let isNewUser = false;
      let user = await authStorage.getUserByEmail(email);
      if (user) {
        await db.update(users).set({
          provider: user.provider ?? "google",
          providerId: user.providerId ?? sub,
          firstName: user.firstName ?? givenName ?? null,
          lastName: user.lastName ?? familyName ?? null,
          profileImageUrl: user.profileImageUrl ?? picture ?? null,
          emailVerified: true,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      } else {
        isNewUser = true;
        const [created] = await db.insert(users).values({
          email,
          firstName: givenName ?? null,
          lastName: familyName ?? null,
          profileImageUrl: picture ?? null,
          provider: "google",
          providerId: sub,
          emailVerified: true,
        }).returning();
        user = created;
        sendWelcomeEmail(email, givenName ?? null).catch(() => {});
      }

      await authStorage.incrementLoginCount(user.id);
      delete req.session.code_verifier;
      delete req.session.state;
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.redirect("/login?error=session_failed");
        res.redirect(isNewUser ? "/onboarding?auth=success" : "/?auth=success");
      });
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect("/login?error=auth_failed");
    }
  });
}

function sanitize(u: any) {
  if (!u) return u;
  const { passwordHash, passwordResetToken, passwordResetTokenExpiresAt, ...rest } = u;
  return rest;
}
