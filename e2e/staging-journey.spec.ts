/**
 * Non-mocked staging smoke journey. Creates synthetic homeowner data, checks
 * real auth/session/plan and S3-backed object storage, and closes the account.
 * Never run this spec outside the allowlisted isolated staging origin.
 */
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const url = process.env.STAGING_BASE_URL;
test.skip(!url, "Runs only against isolated staging");
if (url && !["homebuddy-web-staging.up.railway.app", "staging.homebuddy.space"].includes(new URL(url).hostname)) {
  throw new Error("Cannot run staging journey against an unapproved host");
}

test("real staging homeowner lifecycle and private document readback", async ({ page }) => {
  test.setTimeout(100_000);
  const id = crypto.randomUUID();
  const email = "homebuddy-staging-qa-" + id + "@example.test";
  const password = "HomeBuddy-Staging-" + crypto.randomUUID();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/signup");
  await page.getByTestId("button-signup-email").click();
  await page.getByTestId("input-signup-email").fill(email);
  await page.getByTestId("input-signup-password").fill(password);
  await page.getByTestId("input-signup-confirm").fill(password);
  await page.getByTestId("button-submit-signup").click();
  await expect(page).toHaveURL(/onboarding/);

  try {
    await page.getByTestId("input-zip").fill("99201");
    await page.getByTestId("input-year").fill("2005");
    await page.getByTestId("button-continue").click();
    for (const category of ["hvac", "plumbing", "electrical", "roof"]) {
      await page.getByTestId("chip-system-" + category).click();
    }
    await page.getByTestId("button-generate-plan").click();
    await expect(page).toHaveURL(/maintenance-log/);
    await expect(page.getByTestId("text-due-count")).toHaveText("2");
    await expect(page.getByTestId("text-upcoming-count")).toHaveText("13");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const homeResponse = await page.request.get("/v2/home");
    expect(homeResponse.status()).toBe(200);
    const home = await homeResponse.json();
    const tasksResponse = await page.request.get("/v2/homes/" + home.id + "/tasks");
    expect(tasksResponse.status()).toBe(200);
    const tasks = await tasksResponse.json();
    expect(tasks).toHaveLength(15);

    // Exercise the actual staging S3 bucket, not a mocked document provider.
    const tokenResp = await page.request.get("/api/csrf-token");
    expect(tokenResp.status()).toBe(200);
    const { token } = await tokenResp.json();
    const content = "Synthetic HomeBuddy staging QA document " + id;
    const upload = await page.request.post("/api/uploads/upload", {
      headers: { "x-csrf-token": token },
      multipart: {
        file: {
          name: "homebuddy-staging-smoke.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(content),
        },
      },
    });
    expect(upload.status(), await upload.text()).toBe(200);
    const uploaded = await upload.json();
    expect(uploaded.objectPath).toMatch(/^\/objects\//);
    const read = await page.request.get(uploaded.objectPath);
    expect(read.status()).toBe(200);
    expect(await read.text()).toBe(content);
  } finally {
    // Never erase non-synthetic accounts. This account was just created here.
    await page.goto("/profile");
    if (await page.getByTestId("button-delete-account").isVisible().catch(() => false)) {
      await page.getByTestId("button-delete-account").click();
      await page.getByTestId("input-confirm-delete-account").fill("DELETE");
      await page.getByTestId("input-delete-account-password").fill(password);
      await page.getByTestId("button-confirm-delete-account").click();
      await expect(page).toHaveURL(/login\?account_deleted=1/);
    }
  }
});
