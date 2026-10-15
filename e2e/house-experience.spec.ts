import { expect, test, type Page } from "@playwright/test";

const home = {
  id: "house-uuid", legacyId: 41, userId: "owner-1",
  address: "14 Cedar Lane", city: "Spokane", state: "WA",
  builtYear: 2003, sqFt: 1850, healthScore: 82,
  waterShutoffLocation: "Garage",
};
const system = {
  id: "heat-pump-uuid", legacyId: 7, homeId: "house-uuid",
  category: "HVAC", name: "Heat Pump", condition: "Good", make: "Carrier",
};
let files = [{
  id: 9, homeId: 41, systemId: null as number | null, name: "Insurance Policy.pdf",
  fileType: "application/pdf", fileSize: 7500, objectPath: "/objects/known-file",
  category: "insurance", createdAt: "2026-01-01",
}];

async function mockAuthenticatedHome(page: Page) {
  files = files.map(f => ({ ...f, systemId: null }));
  await page.addInitScript(() => sessionStorage.setItem("splashShown", "true"));
  await page.route("**/api/auth/user", r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ id: "owner-1", email: "owner@example.test", firstName: "Owner", disclaimerAccepted: true }),
  }));
  await page.route("**/v2/home", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(home) }));
  await page.route("**/api/home", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 41, ...home }) }));
  await page.route("**/v2/homes/house-uuid/systems", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([system]) }));
  await page.route("**/v2/homes/house-uuid/tasks", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }));
  await page.route("**/api/home/41/documents", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(files) }));
  await page.route("**/v2/homes/41/timeline*", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v2/homes/41/warranties", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/home/41/insurance", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/home/41/utilities", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/documents/9/system", async r => {
    const body = r.request().postDataJSON() as { systemId: number | null };
    files[0] = { ...files[0], systemId: body.systemId };
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(files[0]) });
  });
}

test("authenticated homeowner has three primary destinations and a global AI action", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await expect(page.getByTestId("page-my-house")).toBeVisible();
  const primary = page.locator('aside nav > div:first-child > a');
  await expect(primary).toHaveCount(3);
  await expect(primary.nth(0)).toContainText("Overview");
  await expect(primary.nth(1)).toContainText("My House");
  await expect(primary.nth(2)).toContainText("Plan");
  await expect(page.locator("aside nav").getByText("Records")).toHaveCount(0);
  await expect(page.getByTestId("button-ask-ai-desktop")).toBeVisible();
  await expect(page.getByText("Heat Pump").first()).toBeVisible();
});

test("home files remain findable, and a homeowner can associate a file with their system", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await page.getByTestId("input-house-search").fill("Insurance Policy");
  await expect(page.getByTestId("house-search-results")).toContainText("Insurance Policy.pdf");
  await page.goto("/house?section=files");
  await expect(page.getByTestId("text-house-section")).toContainText("House files");
  await expect(page.getByTestId("card-document-9")).toBeVisible();
  await page.getByTestId("select-file-system-9").selectOption("7");
  await expect.poll(() => files[0].systemId).toBe(7);
});

test("old Records deep links resolve to their new context", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/records?type=insurance");
  await expect(page.getByTestId("text-house-section")).toContainText("Coverage");
  await expect(page).toHaveURL(/house\?section=coverage/);
});

test("mobile shows three destinations and global AI without a Records tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await expect(page.getByTestId("page-my-house")).toBeVisible();
  const bottomNav = page.locator("nav.fixed.bottom-0 a");
  await expect(bottomNav).toHaveCount(3);
  await expect(bottomNav.nth(0)).toContainText("Overview");
  await expect(bottomNav.nth(1)).toContainText("My House");
  await expect(bottomNav.nth(2)).toContainText("Plan");
  await expect(page.getByTestId("button-ask-ai-mobile")).toBeVisible();
});
