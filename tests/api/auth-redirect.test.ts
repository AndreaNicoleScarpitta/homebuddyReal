import { describe, it, expect } from "vitest";
import { getExternalUrl } from "../../server/replit_integrations/auth/replitAuth";

describe("getExternalUrl", () => {
  const originalEnv = { ...process.env };

  function clearEnvVars() {
    delete process.env.REPLIT_DEPLOYMENT_URL;
    delete process.env.REPLIT_DEV_DOMAIN;
    delete process.env.REPL_SLUG;
    delete process.env.REPL_OWNER;
  }

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses x-forwarded-host and x-forwarded-proto from request headers when available", () => {
    const result = getExternalUrl({
      host: "internal:5000",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "my-app.replit.app",
    });
    expect(result).toBe("https://my-app.replit.app");
  });

  it("uses host header when x-forwarded-host is absent", () => {
    const result = getExternalUrl({
      host: "my-app.replit.app",
    });
    expect(result).toBe("https://my-app.replit.app");
  });

  it("defaults proto to https when x-forwarded-proto is absent", () => {
    const result = getExternalUrl({
      host: "example.com",
    });
    expect(result).toBe("https://example.com");
  });

  it("falls back to REPLIT_DEPLOYMENT_URL when no request headers", () => {
    clearEnvVars();
    process.env.REPLIT_DEPLOYMENT_URL = "https://deployed-app.replit.app";
    const result = getExternalUrl();
    expect(result).toBe("https://deployed-app.replit.app");
  });

  it("falls back to REPLIT_DEV_DOMAIN when no deployment URL", () => {
    clearEnvVars();
    process.env.REPLIT_DEV_DOMAIN = "abc123.kirk.replit.dev";
    const result = getExternalUrl();
    expect(result).toBe("https://abc123.kirk.replit.dev");
  });

  it("falls back to localhost when no env vars are set", () => {
    clearEnvVars();
    const result = getExternalUrl();
    expect(result).toBe("http://localhost:5000");
  });

  it("prefers request headers over all env vars", () => {
    process.env.REPLIT_DEPLOYMENT_URL = "https://wrong.replit.app";
    process.env.REPLIT_DEV_DOMAIN = "wrong.replit.dev";
    const result = getExternalUrl({
      host: "correct-app.replit.app",
      "x-forwarded-proto": "https",
    });
    expect(result).toBe("https://correct-app.replit.app");
  });

  it("never produces old repl.co URLs", () => {
    clearEnvVars();
    process.env.REPL_SLUG = "workspace";
    process.env.REPL_OWNER = "someuser";
    const result = getExternalUrl();
    expect(result).not.toContain("repl.co");
  });

  it("produces correct callback URL for deployed app", () => {
    const baseUrl = getExternalUrl({
      host: "my-app.replit.app",
      "x-forwarded-proto": "https",
    });
    const callbackUrl = `${baseUrl}/api/callback`;
    expect(callbackUrl).toBe("https://my-app.replit.app/api/callback");
  });
});
