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

  return result;
}

export function logEnvironmentStatus(): void {
  const result = validateEnvironment();
  
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
