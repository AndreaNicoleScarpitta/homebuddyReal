import { expect, test } from "@playwright/test";

test("manifest, service worker, offline page and correctly sized icons are served", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.json");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toContain("Home Buddy");
  expect(manifest.start_url).toBe("/dashboard");
  expect(manifest.display).toBe("standalone");
  expect(manifest.shortcuts.map((s: { name: string }) => s.name)).toEqual(["Overview", "My House", "Plan"]);
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["cache-control"]).toContain("no-store");
  const fallback = await request.get("/offline.html");
  expect(fallback.ok()).toBeTruthy();
  expect(await fallback.text()).toContain("You're offline");
  for (const size of [192, 512]) {
    const img = await request.get(`/icons/icon-${size}x${size}.png`);
    expect(img.ok()).toBeTruthy();
    const bytes = await img.body();
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});

test("browser installs worker and shows a static offline screen for navigation", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // A page opened before first installation may not yet be controlled.
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controlled) {
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  }
  await expect.poll(async () => page.evaluate(async () =>
    (await caches.keys()).filter(k => k.startsWith("homebuddy-"))
  )).toEqual(["homebuddy-offline-v1"]);
  await context.setOffline(true);
  try {
    await page.goto("/house", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.locator("body")).toBeVisible();
});

test("offline cache never stores user information or hashed app assets", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const entries = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = await Promise.all(names.map(async name =>
      (await (await caches.open(name)).keys()).map(req => new URL(req.url).pathname)
    ));
    return requests.flat().sort();
  });
  expect(entries).toEqual(["/offline.css", "/offline.html"]);
});
