/**
 * Sentry client-side error tracking.
 *
 * Call initSentry() once at the top of App.tsx (before any renders) so
 * the SDK is ready to capture errors from the first paint.
 *
 * Set VITE_SENTRY_DSN in Railway env vars (and in .env.local for any
 * developer who wants to track local errors — most won't).
 */
import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // 10% of page loads traced for performance monitoring.
    tracesSampleRate: 0.1,
    // Capture a full session replay for every session that has an error —
    // invaluable for reproducing bugs. No normal-session recording.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
  });
}

/** Re-export so callers can use Sentry directly (e.g. captureException). */
export { Sentry };
