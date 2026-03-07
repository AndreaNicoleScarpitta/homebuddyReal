import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const swSource = readFileSync(join(__dirname, "../../client/public/sw.js"), "utf-8");

function extractAuthPaths(source: string): string[] {
  const match = source.match(/const authPaths\s*=\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/['"]/g, ""))
    .filter(Boolean);
}

describe("Service Worker auth path bypass", () => {
  it("does not intercept /api/login", () => {
    expect(swSource).toContain("authPaths");
    const paths = extractAuthPaths(swSource);
    expect(paths).toContain("/api/login");
  });

  it("does not intercept /api/callback", () => {
    const paths = extractAuthPaths(swSource);
    expect(paths).toContain("/api/callback");
  });

  it("does not intercept /api/logout", () => {
    const paths = extractAuthPaths(swSource);
    expect(paths).toContain("/api/logout");
  });

  it("checks auth paths before the general /api/ handler", () => {
    const authCheckIndex = swSource.indexOf("authPaths");
    const apiHandlerIndex = swSource.indexOf("event.request.url.includes('/api/')");
    expect(authCheckIndex).toBeGreaterThan(-1);
    expect(apiHandlerIndex).toBeGreaterThan(-1);
    expect(authCheckIndex).toBeLessThan(apiHandlerIndex);
  });

  it("returns early (no respondWith) for auth paths", () => {
    const authBlock = swSource.slice(
      swSource.indexOf("authPaths"),
      swSource.indexOf("event.request.url.includes('/api/')")
    );
    expect(authBlock).toContain("return");
    expect(authBlock).not.toContain("respondWith");
  });
});
