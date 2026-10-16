/**
 * Real browser + real API + isolated CI PostgreSQL. No network stubs.
 * Production is deliberately NOT targeted by this suite.
 */
import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

const password = "HomeBuddy-QA-" + crypto.randomUUID();

async function registerAndOnboard(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByTestId("button-signup-email").click();
  await page.getByTestId("input-signup-email").fill(email);
  await page.getByTestId("input-signup-password").fill(password);
  await page.getByTestId("input-signup-confirm").fill(password);
  const response = page.waitForResponse(r => r.url().endsWith("/api/auth/signup") && r.request().method() === "POST");
  await page.getByTestId("button-submit-signup").click();
  const signup = await response;
  expect(signup.status(), "Signup API must return 200; auth reads must not exhaust the login rate limit").toBe(200);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  await page.getByTestId("input-zip").fill("99201");
  await page.getByTestId("input-year").fill("2005");
  await page.getByTestId("button-continue").click();
  await expect(page.getByTestId("text-selected-count")).toContainText("0 selected");
  for (const category of ["hvac", "plumbing", "electrical", "roof"]) {
    await page.getByTestId(`chip-system-${category}`).click();
  }
  await expect(page.getByTestId("text-selected-count")).toContainText("4 selected");
  await page.getByTestId("button-generate-plan").click();
  await expect(page).toHaveURL(/maintenance-log/, { timeout: 20000 });
  await expect(page.getByTestId("quick-guide-1")).toBeVisible();
  const home = await (await page.request.get("/v2/home")).json();
  const systems = await (await page.request.get("/v2/homes/" + home.id + "/systems")).json();
  const tasks = await (await page.request.get("/v2/homes/" + home.id + "/tasks")).json();
  expect(systems).toHaveLength(4);
  expect(tasks).toHaveLength(15);
  expect(new Set(tasks.map((t: {id: string}) => t.id)).size).toBe(15);
  expect(tasks.filter((t: {urgency: string}) => t.urgency === "now")).toHaveLength(2);
  await page.getByTestId("task-list").getByTestId(/^button-expand-task-/).first().locator("p").first().click();
  await expect(page.getByTestId("quick-guide-2")).toBeVisible();
  await expect(page.getByText("Task ID", { exact: true })).toHaveCount(0);
  await page.getByTestId("quick-guide-2").getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByTestId("quick-guide-3").getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("quick-guide-3")).toHaveCount(0);
  await expect(page).toHaveURL(/maintenance-log/);
  return { home, systems, tasks };
}

async function closeAccount(page: Page) {
  await page.goto("/profile");
  await page.getByTestId("button-delete-account").click();
  await page.getByTestId("input-confirm-delete-account").fill("DELETE");
  await page.getByTestId("input-delete-account-password").fill(password);
  await page.getByTestId("button-confirm-delete-account").click();
  await expect(page).toHaveURL(/\/login\?account_deleted=1/, { timeout: 15000 });
  expect((await page.request.get("/v2/home")).status()).toBe(401);
}

for (const width of [320, 375, 390, 1440]) {
  test("signup -> onboarding -> plan -> logout/login -> closure at " + width + "px", async ({ page }) => {
    test.setTimeout(90_000);
    const email = "homebuddy-qa-" + crypto.randomUUID() + "@example.test";
    await page.setViewportSize({ width, height: 844 });
    const { home } = await registerAndOnboard(page, email);
    await page.goto("/maintenance-log");
    await expect(page.getByTestId("text-due-count")).toHaveText("2");
    await expect(page.getByTestId("text-upcoming-count")).toHaveText("13");
    // Plan must not promote contractor search/quotes/scheduling that the task cards no longer offer.
    await expect(page.locator('section[aria-label="Contractor assistance"]')).toHaveCount(0);
    await expect(page.getByText(/tasks? need a contractor/i)).toHaveCount(0);
    await expect(page.getByText(/search, quote, and schedule all from the card/i)).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("text-upcoming-count")).toHaveText("13");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, "Unexpected horizontal overflow at " + width + "px").toBe(false);

    // A fresh unauthenticated session cannot fetch this homeowner's data.
    const session = await page.context().browser()!.newContext();
    try {
      expect((await session.request.get("http://localhost:5000/v2/homes/" + home.id + "/tasks")).status()).toBe(401);
    } finally {
      await session.close();
    }

    await page.goto("/api/logout");
    await page.goto("/login");
    await page.getByTestId("button-login-email").click();
    await page.getByTestId("input-login-email").fill(email);
    await page.getByTestId("input-login-password").fill(password);
    await page.getByTestId("button-submit-login").click();
    await expect(page).not.toHaveURL(/\/login$/);
    const restored = await (await page.request.get("/v2/home")).json();
    expect(restored.id).toBe(home.id);

    await closeAccount(page);
    const deleted = await db.execute(sql`SELECT count(*) AS n FROM users WHERE email = ${email}`);
    expect(Number((deleted.rows[0] as any).n)).toBe(0);
    const old = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(old.status()).toBe(401);
  });
}

test("two accounts cannot read or erase each other's homes", async ({ browser }) => {
  test.setTimeout(120_000);
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const aPage = await aContext.newPage();
  const bPage = await bContext.newPage();
  try {
    const emailA = "homebuddy-qa-a-" + crypto.randomUUID() + "@example.test";
    const emailB = "homebuddy-qa-b-" + crypto.randomUUID() + "@example.test";
    const a = await registerAndOnboard(aPage, emailA);
    const b = await registerAndOnboard(bPage, emailB);
    expect((await aPage.request.get("/v2/homes/" + b.home.id + "/tasks")).status()).toBe(403);
    expect((await bPage.request.get("/v2/homes/" + a.home.id + "/tasks")).status()).toBe(403);

    await closeAccount(aPage);
    const still = await (await bPage.request.get("/v2/home")).json();
    expect(still.id).toBe(b.home.id);
    const remainingTasks = await (await bPage.request.get("/v2/homes/" + still.id + "/tasks")).json();
    expect(remainingTasks).toHaveLength(15);
    await closeAccount(bPage);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
