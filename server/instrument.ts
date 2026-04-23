/**
 * Sentry instrumentation — must be the first import in server/index.ts
 * so the SDK can patch Node.js built-ins (http, https, pg) before they
 * are used by any other module.
 *
 * In production (Railway) SENTRY_DSN is already in process.env from the
 * OS environment, so it's available before dotenv/config runs.
 * In local dev SENTRY_DSN is typically absent, which is intentional —
 * you don't want dev noise in your production error dashboard.
 */
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Sample 10% of requests for performance tracing.
    // Raise to 1.0 if you want full traces (higher cost).
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
