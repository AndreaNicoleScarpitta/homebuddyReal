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
const electricalSystem = {
  id: "electrical-uuid", legacyId: 8, homeId: "house-uuid",
  category: "Electrical", name: "Main Electrical Panel", condition: "Good",
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
  await page.route("**/v2/guidance", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: 1, status: "dismissed", moment: 3 }) }));
  await page.route("**/v2/home", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(home) }));
  await page.route("**/api/home", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 41, ...home }) }));
  await page.route("**/v2/homes/house-uuid/systems", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([system, electricalSystem]) }));
  await page.route("**/v2/homes/house-uuid/tasks", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }));
  await page.route("**/v2/homes/house-uuid/intelligence", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ insight: { overallHealthScore: 82, missingCriticalData: [] }, systems: [] }),
  }));
  await page.route("**/v2/homes/house-uuid/circuit-maps", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/home/41/documents", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(files) }));
  // Plan and system profiles use additional authenticated endpoints. Intercept
  // them individually so a real 401 from the unseeded CI backend cannot cause
  // a redirect to /login during this mocked-authentication browser test.
  await page.route("**/api/home/41/log-entries", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v2/homes/41/repairs", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v2/homes/41/recommendations", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v2/systems/*/components", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/v2/systems/*/insight", r => r.fulfill({ status: 404, contentType: "application/json", body: '{"message":"No insight yet"}' }));
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


test("mobile Overview prioritizes the maintenance plan instead of permanent reference data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedHome(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Maintenance Plan")).toBeVisible();
  await expect(page.getByTestId("overview-property-link")).toBeVisible();
  await expect(page.getByText("Emergency Shutoffs")).toHaveCount(0);
  await expect(page.getByText("Circuit Panel Map")).toHaveCount(0);
  await expect(page.getByText("Home Information")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("entire Needs Attention card opens Plan and urgent tasks are excluded from Upcoming", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedHome(page);
  const tasks = [
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `urgent-${i}`, homeId: "house-uuid", title: `Urgent ${i + 1}`,
      status: "pending", state: "pending", urgency: "now", dueDate: null,
    })),
    ...Array.from({ length: 13 }, (_, i) => ({
      id: `future-${i}`, homeId: "house-uuid", title: `Upcoming ${i + 1}`,
      status: "pending", state: "pending", urgency: "later", dueDate: null,
    })),
  ];
  await page.route("**/v2/homes/house-uuid/tasks", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tasks) })
  );
  await page.goto("/dashboard");

  const attentionCard = page.getByTestId("link-needs-attention-card");
  await expect(attentionCard).toBeVisible();
  await expect(attentionCard).toContainText("2 urgent tasks");
  await expect(attentionCard).toContainText("15 total open tasks (including urgent)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await attentionCard.click({ force: true });
  await expect(page).toHaveURL(/maintenance-log/);
  await expect(page.getByTestId("text-due-count")).toHaveText("2");
  await expect(page.getByTestId("text-upcoming-count")).toHaveText("13");
  await expect(page.getByTestId("filter-due")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Urgent 1")).toBeVisible();
  await expect(page.getByTestId("filter-tabs")).toHaveCount(0);
  await page.getByTestId("filter-upcoming").click();
  await expect(page.getByTestId("filter-upcoming")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("task-list").getByTestId(/^row-task-/)).toHaveCount(13);
  await expect(page.getByText("Urgent 1", { exact: true })).toHaveCount(0);
  await page.getByTestId("filter-completed").click();
  await expect(page.getByText("No completed tasks yet")).toBeVisible();
  await page.getByTestId("filter-past_due").click();
  await expect(page.getByText("No overdue tasks")).toBeVisible();
  await page.getByTestId("filter-due").click();
  await expect(page.getByTestId("task-list").getByTestId(/^row-task-/)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("shutoff locations are editable in My House, not the dashboard", async ({ page }) => {
  await mockAuthenticatedHome(page);
  let savedGasLocation: string | null = null;
  await page.route("**/v2/homes/house-uuid", async route => {
    if (route.request().method() !== "PATCH") return route.continue();
    const body = route.request().postDataJSON() as { gasShutoffLocation?: string };
    savedGasLocation = body.gasShutoffLocation ?? null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...home, ...body }) });
  });
  await page.goto("/house");
  await page.getByTestId("house-section-emergency").click();
  await expect(page.getByTestId("text-house-section")).toHaveText("Emergency & utilities");
  await expect(page.getByTestId("house-emergency-shutoffs")).toContainText("Garage");
  await page.getByRole("button", { name: "Edit Gas Meter location" }).click();
  await page.getByPlaceholder("Where is the gas meter?").fill("East side of the house");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => savedGasLocation).toBe("East side of the house");
});

test("the electrical circuit panel map stays one tap away from My House reference", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await page.getByTestId("house-section-electrical").click();
  await expect(page.getByTestId("text-house-section")).toHaveText("Electrical & circuits");
  await page.getByTestId("button-open-circuit-map-house").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("authenticated homeowner has three primary destinations and a global AI action", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await expect(page.getByTestId("page-my-house")).toBeVisible();
  const primary = page.locator('aside nav > div:first-child > a');
  await expect(primary).toHaveCount(3);
  await expect(primary.nth(0)).toContainText("Home");
  await expect(primary.nth(1)).toContainText("My House");
  await expect(primary.nth(2)).toContainText("Plan");
  await expect(page.locator("aside nav").getByText("Records")).toHaveCount(0);
  await expect(page.getByTestId("button-ask-ai-desktop")).toBeVisible();
  await expect(page.getByText("Heat Pump").first()).toBeVisible();
  await page.screenshot({ path: "test-results/my-house-desktop.png", fullPage: true });
});

test("home files remain findable, and a homeowner can associate a file with their system", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house");
  await page.getByTestId("input-house-search").fill("Insurance Policy");
  await expect(page.getByTestId("house-search-results")).toContainText("Insurance Policy.pdf");
  await page.goto("/house?section=files");
  await expect(page.getByTestId("text-house-section")).toContainText("Documents");
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
  await expect(bottomNav.nth(0)).toContainText("Home");
  await expect(bottomNav.nth(1)).toContainText("My House");
  await expect(bottomNav.nth(2)).toContainText("Plan");
  await expect(page.getByTestId("button-ask-ai-mobile")).toBeVisible();
  await page.screenshot({ path: "test-results/my-house-mobile.png", fullPage: true });
});

test("coverage, services, history, tools and plan remain reachable without Records", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house?section=coverage&focus=insurance");
  await expect(page.getByTestId("text-house-section")).toHaveText("Coverage");
  await expect(page.getByRole("heading", { name: "Insurance" })).toBeVisible();
  await page.goto("/house?section=services");
  await expect(page.getByTestId("text-house-section")).toHaveText("Services & contacts");
  await expect(page.getByText("No utility accounts yet")).toBeVisible();
  await page.goto("/house?section=history");
  await expect(page.getByTestId("text-house-section")).toHaveText("Home history");
  await page.goto("/house?section=tools");
  await expect(page.getByText("Export home information")).toBeVisible();
  await page.goto("/maintenance-log");
  await expect(page.getByTestId("text-heading")).toHaveText("Plan");
});

test("a linked document is also discoverable from its system profile", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.goto("/house?section=files");
  await page.getByTestId("select-file-system-9").selectOption("7");
  await expect.poll(() => files[0].systemId).toBe(7);
  await page.goto("/systems/heat-pump-uuid");
  await expect(page.getByTestId("text-system-name")).toContainText("Heat Pump");
  await expect(page.getByTestId("card-document-9")).toBeVisible();
});

test("Home Assistant fits narrow mobile viewports without obscuring prompts or the composer", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await mockAuthenticatedHome(page);
    await page.route("**/v2/homes/house-uuid/chat/sessions", route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.goto("/chat");

    const composer = page.getByTestId("chat-composer");
    const prompt = page.getByTestId("button-suggestion-prioritize");
    await expect(composer).toBeVisible();
    await expect(prompt).toBeVisible();
    await expect(page.getByTestId("input-message")).toBeVisible();
    await expect(page.getByTestId("button-add-photo")).toBeVisible();
    await expect(page.getByTestId("button-send")).toBeVisible();

    const composerBox = await composer.boundingBox();
    const promptBox = await prompt.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(promptBox).not.toBeNull();
    expect(composerBox!.x).toBeGreaterThanOrEqual(0);
    expect(composerBox!.x + composerBox!.width).toBeLessThanOrEqual(width + 1);
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(700);
    expect(promptBox!.y + promptBox!.height).toBeLessThanOrEqual(composerBox!.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("Plan header, actions, cards, and task controls fit mobile viewports", async ({ page }) => {
  await mockAuthenticatedHome(page);
  await page.route("**/v2/homes/house-uuid/tasks", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: "responsive-task", homeId: "house-uuid",
        title: "Check for leaks underneath every bathroom and kitchen sink",
        status: "pending", state: "pending", urgency: "later",
        dueDate: null, category: "Plumbing",
      }]),
    })
  );

  for (const width of [320, 360, 390, 428, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/maintenance-log");

    const heading = page.getByTestId("text-heading");
    const description = page.getByText("Your next actions, upcoming work, and completed maintenance");
    const calendar = page.getByTestId("button-calendar-sync");
    const logWork = page.getByTestId("button-add-entry");
    const task = page.getByTestId("row-task-responsive-task");
    const complete = page.getByTestId("button-complete-responsive-task");

    await expect(heading).toBeVisible();
    await expect(description).toBeVisible();
    await expect(calendar).toBeVisible();
    await expect(logWork).toBeVisible();
    await expect(task).toBeVisible();
    await expect(complete).toBeVisible();

    for (const item of [
      heading, description, calendar, logWork, task, complete,
      page.getByTestId("filter-completed"),
      page.getByTestId("filter-past_due"),
      page.getByTestId("filter-due"),
      page.getByTestId("filter-upcoming"),
    ]) {
      const rect = await item.boundingBox();
      expect(rect, `Element at ${width}px should be laid out`).not.toBeNull();
      expect(rect!.x, `Element at ${width}px is clipped on the left`).toBeGreaterThanOrEqual(-1);
      expect(rect!.x + rect!.width, `Element at ${width}px overflows right`).toBeLessThanOrEqual(width + 1);
    }

    if (width < 640) {
      const descriptionBox = (await description.boundingBox())!;
      const actionBox = (await page.getByTestId("plan-actions").boundingBox())!;
      expect(descriptionBox.width).toBeGreaterThan(width * 0.65);
      expect(actionBox.y).toBeGreaterThanOrEqual(descriptionBox.y + descriptionBox.height);
      await expect(page.getByTestId("text-task-title-responsive-task")).toHaveCSS("white-space", "normal");
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
