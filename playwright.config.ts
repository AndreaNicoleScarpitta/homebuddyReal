import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5000/api/health",
    // Always reuse an existing server if one is up.
    // In CI the production server is started manually before playwright runs;
    // reuseExistingServer: false would throw because the port is already taken.
    // Locally, if no server is running playwright starts one via the command above.
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      NODE_ENV: "development",
      // Port 5433 on purpose — see scripts/dev-start.cjs
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/home_buddy",
    },
  },
});
