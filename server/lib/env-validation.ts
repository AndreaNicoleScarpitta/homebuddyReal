import { logInfo, logWarn, logError } from "./logger";

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const result: EnvValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!process.env.DATABASE_URL) {
    result.errors.push("DATABASE_URL is required");
    result.valid = false;
  }

  // SESSION_SECRET is security-critical: it signs sessions and calendar tokens.
  // Missing in production means sessions are insecure and calendar URLs are guessable.
  if (!process.env.SESSION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      result.errors.push(
        "SESSION_SECRET must be set in production — sessions and calendar subscription tokens use an insecure dev default without it. Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
      );
      result.valid = false;
    } else {
      result.warnings.push("SESSION_SECRET not set — using insecure dev default (fine for local dev only)");
    }
  }

  if (!process.env.APP_URL && process.env.NODE_ENV === "production") {
    result.warnings.push("APP_URL not set - Stripe checkout redirects and webhook registration will fall back to localhost. Set APP_URL=https://yourdomain.com in production.");
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    result.warnings.push("AI_INTEGRATIONS_OPENAI_API_KEY is not set - AI features will not work");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    result.warnings.push("ANTHROPIC_API_KEY not set - inspection report AI analysis will not work");
  }

  if (!process.env.VITE_GOOGLE_PLACES_API_KEY) {
    result.warnings.push("VITE_GOOGLE_PLACES_API_KEY not set - address autocomplete will be disabled");
  }

  if (!process.env.RESEND_API_KEY) {
    result.warnings.push("RESEND_API_KEY not set - email notifications will be disabled");
  }

  if (!process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
    result.warnings.push("SENTRY_DSN not set - production errors will not be tracked in Sentry");
  }

  const missingR2 = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
    .filter((k) => !process.env[k]);
  if (missingR2.length > 0) {
    result.warnings.push(`R2 object storage not fully configured (missing: ${missingR2.join(", ")}) - file uploads and document storage will fail`);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    result.warnings.push("STRIPE_SECRET_KEY not set - checkout and billing portal will fail");
  }
  if (!process.env.STRIPE_PRICE_PLUS) {
    result.warnings.push("STRIPE_PRICE_PLUS not set - paid plan checkout will be unavailable");
  }
  if (!process.env.STRIPE_PRICE_PREMIUM) {
    // Premium is unlisted, but the webhook still needs this price id to map
    // existing subscribers onto the premium plan.
    result.warnings.push("STRIPE_PRICE_PREMIUM not set - existing Premium subscribers will be treated as free");
  }

  const hasGoogleId = !!process.env.GOOGLE_CLIENT_ID;
  const hasGoogleSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  if (hasGoogleId !== hasGoogleSecret) {
    result.warnings.push("Only one of GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is set - Google login will not work");
  } else if (!hasGoogleId && process.env.NODE_ENV === "production") {
    result.warnings.push("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set - Google login disabled");
  }

  if (process.env.RESEND_API_KEY && !process.env.EMAIL_FROM && process.env.NODE_ENV === "production") {
    result.warnings.push("EMAIL_FROM not set - emails send from Resend's sandbox address (onboarding@resend.dev), which only delivers to the Resend account owner. Set EMAIL_FROM to an address on a domain verified in Resend, e.g. \"Home Buddy <hello@homebuddy.space>\"");
  }


  return result;
}

/**
 * One-line-per-feature config report, logged at boot. This is the audit
 * trail for "which integrations are live on this deploy" — read the deploy
 * logs instead of cross-referencing the Railway variables tab.
 */
function logConfigReport(): void {
  const features: Array<[string, boolean]> = [
    ["database", !!process.env.DATABASE_URL],
    ["sessions (SESSION_SECRET)", !!process.env.SESSION_SECRET],
    ["ai / openai", !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY],
    ["file storage (R2)", !!(process.env.R2_ENDPOINT && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)],
    ["email (Resend)", !!process.env.RESEND_API_KEY],
    ["email sender (EMAIL_FROM)", !!process.env.EMAIL_FROM],
    ["stripe key", !!process.env.STRIPE_SECRET_KEY],
    ["stripe paid plans", !!(process.env.STRIPE_PRICE_PLUS && process.env.STRIPE_PRICE_PREMIUM)],
    ["google login", !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)],
    ["places autocomplete", !!process.env.VITE_GOOGLE_PLACES_API_KEY],
    ["sentry", !!process.env.SENTRY_DSN],
    ["app url (APP_URL)", !!process.env.APP_URL],
  ];
  for (const [name, on] of features) {
    logInfo("env.config", `${on ? "[on ]" : "[OFF]"} ${name}`);
  }
}

export function logEnvironmentStatus(): void {
  const result = validateEnvironment();

  logConfigReport();

  if (result.errors.length > 0) {
    result.errors.forEach(err => logError("env.validation", new Error(err)));
    console.error("FATAL: Required environment variables are missing. Cannot start server.");
    process.exit(1);
  }
  
  if (result.warnings.length > 0) {
    result.warnings.forEach(warn => logWarn("env.validation", warn));
  }
  
  if (result.valid && result.warnings.length === 0) {
    logInfo("env.validation", "All environment variables configured correctly");
  } else if (result.valid) {
    logInfo("env.validation", `Environment validated with ${result.warnings.length} warnings`);
  }
}

export function isFeatureEnabled(feature: "googlePlaces" | "ai" | "email"): boolean {
  switch (feature) {
    case "googlePlaces":
      return !!process.env.VITE_GOOGLE_PLACES_API_KEY;
    case "ai":
      return !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    case "email":
      return !!process.env.RESEND_API_KEY;
    default:
      return false;
  }
}
