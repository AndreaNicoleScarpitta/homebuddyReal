import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("health endpoint returns healthy", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.status).toBe("healthy");
    expect(body.db).toBe("connected");
  });

  test("landing page loads for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    // Should see the splash or landing page
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("test login works in dev mode", async ({ request }) => {
    const resp = await request.post("/api/auth/test-login", {
      data: { username: "test", password: "password123" },
    });
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test("authenticated user can view dashboard", async ({ page, request }) => {
    // Log in first
    await request.post("/api/auth/test-login", {
      data: { username: "test", password: "password123" },
    });

    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated API returns 401", async ({ request }) => {
    // Use a fresh context (no cookies)
    const resp = await request.get("/api/home", {
      headers: { cookie: "" },
    });
    expect(resp.status()).toBe(401);
  });

  test("CSRF token endpoint returns a token", async ({ request }) => {
    const resp = await request.get("/api/csrf-token");
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe("string");
  });

  test("OpenAPI spec is served", async ({ request }) => {
    const resp = await request.get("/api/docs/openapi.json");
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Home Buddy API");
  });
});
