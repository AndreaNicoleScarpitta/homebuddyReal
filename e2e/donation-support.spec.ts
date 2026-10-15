import { test, expect } from "@playwright/test";

test("donation-only support is visible without login", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("splashShown", "true"));
  await page.goto("/support");
  await expect(page.getByTestId("donation-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Support Home Buddy" })).toBeVisible();
  await expect(page.getByTestId("button-donate-checkout")).toContainText("Donate $10 once");
  await page.getByTestId("donation-amount-25").click();
  await expect(page.getByTestId("button-donate-checkout")).toContainText("Donate $25 once");
  await expect(page.getByText(/no subscriptions, no upgrade tiers/i)).toBeVisible();
});

test("legacy pricing URL cannot sell subscriptions", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("splashShown", "true"));
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByTestId("donation-page")).toBeVisible();
  await expect(page.getByText("Get Plus")).toHaveCount(0);
});
