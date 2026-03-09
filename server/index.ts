import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { v2Router } from "./routes_v2";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { logEnvironmentStatus } from "./lib/env-validation";
import { bootstrapMigrationTracking } from "./lib/db-bootstrap";
import { WebhookHandlers } from "./webhookHandlers";
import { registerDonationRoutes } from "./donation-routes";
import { startNotificationScheduler } from "./jobs/notificationScheduler";

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
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "15mb" }));

const isDev = process.env.NODE_ENV !== "production";
app.use(
  helmet({
    contentSecurityPolicy: isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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
    hsts: false,
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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
      console.log('Initializing Stripe schema...');
      await runMigrations({ databaseUrl });
      console.log('Stripe schema ready');
      const stripeSync = await getStripeSync();
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log('Stripe webhook configured:', webhookResult?.webhook?.url || 'OK');
      stripeSync.syncBackfill()
        .then(() => console.log('Stripe data synced'))
        .catch((err: any) => console.error('Error syncing Stripe data:', err));
    }
  } catch (error) {
    console.error('Failed to initialize Stripe (non-fatal):', error);
  }

  // Setup auth BEFORE registering other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  registerDonationRoutes(app);

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
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startNotificationScheduler();
    },
  );
})();
