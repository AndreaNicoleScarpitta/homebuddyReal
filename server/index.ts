import "./instrument"; // ← must be first: patches Node built-ins before anything else loads
import "dotenv/config";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { v2Router } from "./routes_v2";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes, registerLocalAuthRoutes } from "./replit_integrations/auth";
import { logEnvironmentStatus } from "./lib/env-validation";
import { verifyDatabaseConnection } from "./lib/db-check";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { registerBillingRoutes } from "./billing-routes";
import { shouldInitializeLegacyStripeSync } from "./lib/stripe-startup";
import { registerMeRoutes } from "./me-routes";
import { registerCalendarRoutes } from "./calendar-routes";
import { startNotificationScheduler, stopNotificationScheduler } from "./jobs/notificationScheduler";
import { pool } from "./db";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import compression from "compression";
import { csrfProtection, registerCsrfRoute } from "./lib/csrf";
import { registerOpenApiRoute } from "./openapi";

const app = express();
// Railway terminates TLS at its reverse proxy. Trust the immediate hop (not
// arbitrary X-Forwarded-For entries), otherwise every visitor is rate-limited
// as one proxy IP and shared households can exhaust a common login quota.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error.message }, "Webhook error");
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(cookieParser());

// Gzip/brotli compression — production only (interferes with Vite HMR in dev)
if (process.env.NODE_ENV === "production") {
  app.use(compression());
}

// Health check — no auth, no rate limit, lightweight
app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ status: "healthy", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "unhealthy", db: "disconnected", error: (err as Error).message });
  }
});

// Public, non-sensitive deployment provenance for the staging promotion gate.
// Never return secrets, runtime variable values, or customer information.
app.get("/api/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "unknown",
  });
});

const isDev = process.env.NODE_ENV !== "production";

// Generate a per-request nonce for CSP to avoid 'unsafe-inline'
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ((_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`) as any, "https://www.googletagmanager.com", "https://www.google-analytics.com"],
        styleSrc: ["'self'", ((_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`) as any, "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://www.google-analytics.com"],
        connectSrc: ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://checkout.stripe.com", "https://api.stripe.com", "https://maps.googleapis.com", "https://places.googleapis.com", "https://*.ingest.sentry.io"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    frameguard: false,
    hsts: isDev ? false : {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    if (path.startsWith("/api") || path.startsWith("/v2")) {
      // Never emit response bodies: they can contain personal data or tokens.
      log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });

  next();
});

(async () => {
  logEnvironmentStatus();

  // Fail the boot loudly if the database is unreachable or rejects our
  // credentials — otherwise the server comes up "healthy-looking" and every
  // request 500s. Exits the process on failure.
  await verifyDatabaseConnection();

  // Subscription synchronization is a legacy, opt-in integration.
  // Donation checkout uses the Stripe SDK directly and does not require this
  // boot-time migration, webhook creation, or historical subscription backfill.
  if (shouldInitializeLegacyStripeSync()) {
    try {
      const { runMigrations } = await import('stripe-replit-sync');
      const { getStripeSync } = await import('./stripeClient');
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl) {
        logger.info("Initializing Stripe schema...");
        await runMigrations({ databaseUrl });
        logger.info("Stripe schema ready");
        const stripeSync = await getStripeSync();
        const webhookBaseUrl =
          process.env.APP_URL?.replace(/\/$/, "") ||
          (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null) ||
          "http://localhost:5000";
        const webhookResult = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        logger.info({ url: webhookResult?.webhook?.url || "OK" }, "Stripe webhook configured");
        stripeSync.syncBackfill()
          .then(() => logger.info("Stripe data synced"))
          .catch((err: any) => logger.error({ err: err.message }, "Error syncing Stripe data"));
      }
    } catch (error) {
      logger.error({ err: (error as Error).message }, "Failed to initialize Stripe (non-fatal)");
    }
  } else {
    logger.info("Legacy Stripe subscription sync disabled; donation checkout remains independent.");
  }

  // ── Rate limiters ─────────────────────────────────────────────────────────
  // IMPORTANT: these MUST be registered before route handlers so they run first.
  // Express processes middleware in registration order; a limiter added after a
  // matching route handler is never reached.

  // Scope brute-force protection to sensitive authentication writes. In the
  // previous release a single shared 20-request bucket was applied to ALL
  // /api/auth traffic, including GET /api/auth/user and /providers. Those
  // routine reads burned through the quota and caused valid sessions to appear
  // logged out. Separate buckets also prevent a failed login from blocking an
  // otherwise valid signup or recovery attempt on the same shared IP.
  const credentialLimiter = (max: number, skipSuccessfulRequests = true) => rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: "Too many authentication attempts. Please try again later." },
  });

  const loginLimiter = credentialLimiter(12);
  // Count even successful signups and recovery-link requests to prevent
  // account-creation/email abuse. Valid logins and successful token resets
  // can be safely omitted from the failure quota.
  const signupLimiter = credentialLimiter(12, false);
  const recoveryRequestLimiter = credentialLimiter(6, false);
  const resetLimiter = credentialLimiter(12);
  const testLoginLimiter = credentialLimiter(12);

  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many messages. Please wait a minute before sending another." },
  });

  const mutationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    skip: (req) => req.method === "GET",
  });

  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    skip: (req) => req.method !== "GET",
  });

  // Apply limiters before routes so they are guaranteed to run
  app.post("/api/auth/login", loginLimiter);
  app.post("/api/auth/signup", signupLimiter);
  app.post("/api/auth/forgot-password", recoveryRequestLimiter);
  app.post("/api/auth/reset-password", resetLimiter);
  app.post("/api/auth/test-login", testLoginLimiter);
  app.use("/api/contact", contactLimiter);
  app.use("/api", mutationLimiter);
  app.use("/api", readLimiter);
  app.use("/v2", mutationLimiter);
  app.use("/v2", readLimiter);

  // ── Auth + CSRF ────────────────────────────────────────────────────────────
  // Setup auth BEFORE registering other routes
  await setupAuth(app);
  // Cross-site POSTs to authentication endpoints must never modify a session.
  app.use("/api/auth", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const fetchSite = req.get("sec-fetch-site");
    if (fetchSite === "cross-site") return res.status(403).json({ error: "Cross-site authentication request blocked" });
    const origin = req.get("origin");
    if (origin) {
      const configured = process.env.OAUTH_BASE_URL || process.env.APP_URL || process.env.REPLIT_DEPLOYMENT_URL;
      const allowedOrigin = configured ? new URL(configured).origin : `${req.protocol}://${req.get("host")}`;
      if (origin !== allowedOrigin) return res.status(403).json({ error: "Untrusted request origin" });
    }
    next();
  });
  registerAuthRoutes(app);
  registerLocalAuthRoutes(app);
  registerCsrfRoute(app);
  registerOpenApiRoute(app);

  // CSRF protection for all mutation routes (after auth so session is available)
  app.use("/api", csrfProtection);
  app.use("/v2", csrfProtection);

  registerBillingRoutes(app);
  registerMeRoutes(app);
  registerCalendarRoutes(app);

  app.use("/v2", v2Router);
  await registerRoutes(httpServer, app);

  // Sentry error handler — must come BEFORE our own error handler so Sentry
  // sees the raw error object before we sanitise the response.
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Never leak internal error details (DB codes, stack traces) to clients
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Internal Server Error");
    logger.error({ err: err.message, stack: err.stack, code: err.code, status }, "Unhandled route error");
    res.status(status).json({ message });
  });

  app.get("/downloads/Home-Buddy-UX-Workflow.pdf", (_req, res) => {
    const pdfPath = `${process.cwd()}/public/Home-Buddy-UX-Workflow.pdf`;
    res.download(pdfPath, "Home-Buddy-UX-Workflow.pdf");
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else if (process.env.NODE_ENV === "test") {
    // In test mode: skip both Vite (slow) and serveStatic (needs a built dist/).
    // Integration tests only hit /api/* and /v2/* — no frontend serving needed.
    app.use("*", (req, res) => {
      const p = req.originalUrl;
      if (p.startsWith("/api/") || p.startsWith("/v2/")) {
        res.status(404).json({ message: "Not found" });
      } else {
        res.status(404).send("Not found");
      }
    });
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startNotificationScheduler();
    },
  );

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log(`${signal} received — shutting down gracefully`);
    stopNotificationScheduler();
    httpServer.close(() => {
      log("HTTP server closed");
      pool.end().then(() => {
        log("Database pool drained");
        process.exit(0);
      }).catch((err) => {
        logger.error({ err: err.message }, "Error draining pool");
        process.exit(1);
      });
    });
    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
