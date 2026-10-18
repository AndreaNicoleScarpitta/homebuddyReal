import { test, expect } from "@playwright/test";

test.describe("HomeBuddy landing → signup conversion", () => {
  test.beforeEach(async ({ page }) => {
    // The branded splash screen is a separate first-visit experience.
    // Skip it here to isolate the public conversion journey.
    await page.addInitScript(() => sessionStorage.setItem("splashShown", "true"));
  });

  test("communicates the product value and routes each signup CTA directly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /know your home.*stay ahead of what matters/i })).toBeVisible();
    await expect(page.getByTestId("landing-product-preview")).toBeVisible();

    for (const testId of ["button-signup-header", "button-cta-hero", "button-cta-final"]) {
      await expect(page.getByTestId(testId)).toHaveAttribute("href", "/signup");
      await expect(page.getByTestId(testId)).toContainText("Set Up My Home");
    }
    await page.getByTestId("button-cta-hero").click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByTestId("button-signup-email")).toBeVisible();
  });

  test("uses the existing analytics helper for distinct CTA placements", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      (window as any).__trackedConversionEvents = [];
      window.gtag = (...args: any[]) => {
        (window as any).__trackedConversionEvents.push(args);
      };
    });

    await page.getByTestId("button-signup-header").click();
    await expect(page).toHaveURL(/\/signup$/);
    const events = await page.evaluate(() => (window as any).__trackedConversionEvents);
    expect(events.some((entry: any[]) =>
      entry[0] === "event" &&
      entry[1] === "landing_signup_click" &&
      entry[2]?.event_label === "header",
    )).toBe(true);
  });

  test("preview tabs reflect the current product sections", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Plan" }).click();
    await expect(page.getByText("Due / Urgent")).toBeVisible();
    await page.getByRole("tab", { name: "My House" }).click();
    await expect(page.getByRole("heading", { name: "Information worth keeping" })).toBeVisible();
    await page.getByRole("tab", { name: "Assistant" }).click();
    await expect(page.getByText(/get practical guidance, with home context/i)).toBeVisible();
  });

  for (const width of [320, 375, 390, 768, 1440]) {
    test("has no horizontal overflow at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      await page.goto("/");
      await expect(page.getByTestId("landing-product-preview")).toBeVisible();
      const actualWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(actualWidth, "Document must fit mobile viewport").toBeLessThanOrEqual(width + 1);
      if ([320, 390, 1440].includes(width)) {
        await page.screenshot({ path: "test-results/landing-" + width + ".png", fullPage: true });
      }
      await page.goto("/signup");
      await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
      const signupWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(signupWidth, "Signup must fit viewport").toBeLessThanOrEqual(width + 1);
      await page.getByTestId("button-signup-email").click();
      await expect(page.getByTestId("input-signup-email")).toBeVisible();
      const formWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(formWidth, "Email signup form must fit viewport").toBeLessThanOrEqual(width + 1);
      if ([320, 390, 1440].includes(width)) {
        await page.screenshot({ path: "test-results/signup-" + width + ".png", fullPage: true });
      }
    });
  }

  test("public metadata and no-script fallback use the same positioning and domain", async ({ page, request }) => {
    const raw = await request.get("/");
    const html = await raw.text();
    expect(html).toContain("Know your home. Stay ahead of what matters.");
    expect(html).toContain('href="/signup"');
    expect(html).not.toContain("home-buddy.replit.app");
    await page.goto("/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.homebuddy.space/");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://www.homebuddy.space/");
  });
});
