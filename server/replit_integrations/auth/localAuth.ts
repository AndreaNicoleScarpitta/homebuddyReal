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
import { eq } from "drizzle-orm";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getBaseUrl(req: any): string {
  const envBase = process.env.OAUTH_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
  const proto = req?.headers?.["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${proto}://${host}` : "http://localhost:5000";
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

export function registerLocalAuthRoutes(app: Express) {

  // ──────────────── Provider availability ─────────────────────────────────────
  // Used by the frontend to decide which sign-in buttons to render.
  // Never exposes keys — only boolean availability.
  app.get("/api/auth/providers", (_req, res) => {
    res.json({ google: isGoogleConfigured() });
  });

  // ──────────────── Email / password signup ────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const firstName = req.body?.firstName ? String(req.body.firstName).trim() : null;
      const lastName = req.body?.lastName ? String(req.body.lastName).trim() : null;

      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
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

  // ──────────────── Email / password login ─────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await authStorage.getUserByEmail(email);
      // Constant-time-ish: still hash even on no-user to avoid timing leak
      const hash = user?.passwordHash || "$2a$12$000000000000000000000000000000000000000000000000000000";
      const ok = await bcrypt.compare(password, hash);

      if (!user || !user.passwordHash || !ok) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await authStorage.incrementLoginCount(user.id);
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

  // ──────────────── Forgot password ────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();

      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
      }

      const user = await authStorage.getUserByEmail(email);

      // Always respond the same way — don't reveal whether the account exists
      if (!user || !user.passwordHash) {
        // No local account (or OAuth-only) — still return 200 to avoid enumeration
        return res.json({ success: true });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await authStorage.setPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = getBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      sendPasswordResetEmail(email, user.firstName, resetUrl).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("Forgot-password error:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ──────────────── Reset password ─────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const token = String(req.body?.token ?? "").trim();
      const password = String(req.body?.password ?? "");

      if (!token) return res.status(400).json({ error: "Reset token required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const user = await authStorage.getUserByResetToken(token);

      if (!user || !user.passwordResetToken || !user.passwordResetTokenExpiresAt) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      if (new Date() > user.passwordResetTokenExpiresAt) {
        await authStorage.clearPasswordResetToken(user.id);
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await authStorage.updatePassword(user.id, passwordHash);

      // Log the user in immediately after reset
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
        res.json({ success: true, user: sanitize(user) });
      });
    } catch (err) {
      console.error("Reset-password error:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ──────────────── Google OAuth start ─────────────────────────────────────────
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

  // ──────────────── Google OAuth callback ──────────────────────────────────────
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

      // If an existing user has this email (from email/password signup), link Google to them.
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
        // Fire-and-forget welcome email for new Google sign-ups
        sendWelcomeEmail(email, givenName ?? null).catch(() => {});
      }

      await authStorage.incrementLoginCount(user.id);
      delete req.session.code_verifier;
      delete req.session.state;
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.redirect("/login?error=session_failed");
        // New Google users go to onboarding; returning users go to dashboard
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
