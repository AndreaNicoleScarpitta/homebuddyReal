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

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    result.warnings.push("AI_INTEGRATIONS_OPENAI_API_KEY is not set - AI chat will not work");
  }

  if (!process.env.VITE_GOOGLE_PLACES_API_KEY) {
    result.warnings.push("VITE_GOOGLE_PLACES_API_KEY not set - address autocomplete will be disabled");
  }

  if (!process.env.RESEND_API_KEY) {
    result.warnings.push("RESEND_API_KEY not set - email notifications will be disabled");
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
