import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { v2Router } from "./routes_v2";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes, registerLocalAuthRoutes } from "./replit_integrations/auth";
import { logEnvironmentStatus } from "./lib/env-validation";
import { logger } from "./lib/logger";
import { bootstrapMigrationTracking } from "./lib/db-bootstrap";
import { WebhookHandlers } from "./webhookHandlers";
import { registerDonationRoutes } from "./donation-routes";
import { registerBillingRoutes } from "./billing-routes";
import { registerMeRoutes } from "./me-routes";
import { startNotificationScheduler, stopNotificationScheduler } from "./jobs/notificationScheduler";
import { startAgentScheduler, stopAgentScheduler } from "./jobs/agentScheduler";
import { pool } from "./db";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import compression from "compression";
import { csrfProtection, registerCsrfRoute } from "./lib/csrf";
import { registerOpenApiRoute } from "./openapi";
import { agentRouter } from "./agents/routes";
// Register all agent handlers at startup
import "./agents/index";

const app = express();
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
        connectSrc: ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://checkout.stripe.com", "https://api.stripe.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", "https://*.replit.dev", "https://*.replit.app"],
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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/v2")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  logEnvironmentStatus();
  
  // Bootstrap migration tracking for deployments
  await bootstrapMigrationTracking();
  
  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const { getStripeSync } = await import('./stripeClient');
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      logger.info("Initializing Stripe schema...");
      await runMigrations({ databaseUrl });
      logger.info("Stripe schema ready");
      const stripeSync = await getStripeSync();
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
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

  // Setup auth BEFORE registering other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  registerLocalAuthRoutes(app);
  registerCsrfRoute(app);
  registerOpenApiRoute(app);

  // CSRF protection for all mutation routes (after auth so session is available)
  app.use("/api", csrfProtection);
  app.use("/v2", csrfProtection);

  registerDonationRoutes(app);
  registerBillingRoutes(app);
  registerMeRoutes(app);

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

  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many messages. Please wait a minute before sending another." },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later" },
  });

  app.use("/api/contact", contactLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api", mutationLimiter);
  app.use("/api", readLimiter);
  app.use("/v2", mutationLimiter);
  app.use("/v2", readLimiter);

  app.use("/v2", v2Router);
  app.use("/api/agents", agentRouter);
  await registerRoutes(httpServer, app);

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
      startAgentScheduler();
    },
  );

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log(`${signal} received — shutting down gracefully`);
    stopNotificationScheduler();
    stopAgentScheduler();
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
