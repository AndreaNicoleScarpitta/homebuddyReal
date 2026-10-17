#!/usr/bin/env node
/**
 * Non-destructive staging promotion gate.
 * Checks only public read-only endpoints; fails closed on missing commit,
 * wrong host, wrong environment, unhealthy DB, or mismatched source revision.
 */
const base = process.env.STAGING_BASE_URL || "https://homebuddy-web-staging.up.railway.app";
const sha = process.env.EXPECTED_SHA;
const url = new URL(base);
if (
  url.protocol !== "https:" ||
  !["homebuddy-web-staging.up.railway.app", "staging.homebuddy.space"].includes(url.hostname) ||
  !sha || !/^[a-f0-9]{40}$/i.test(sha)
) {
  throw new Error("Invalid staging target or expected 40-character commit SHA");
}
const deadline = Date.now() + 9 * 60 * 1000;
async function check(path) {
  const response = await fetch(new URL(path, url), { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(path + " returned HTTP " + response.status);
  return response;
}
let last = "not started";
while (Date.now() < deadline) {
  try {
    const version = await (await check("/api/version")).json();
    if (version.environment !== "staging") {
      throw new Error("Refusing promotion: target did not identify as staging");
    }
    if (version.commit === sha) {
      const health = await (await check("/api/health")).json();
      if (health.status !== "healthy" || health.db !== "connected") {
        throw new Error("Staging app or PostgreSQL unhealthy");
      }
      await check("/login");
      console.log("PASS: staging healthy, authenticated route available, exact SHA:", sha);
      process.exit(0);
    }
    last = "Deployed revision " + String(version.commit || "(missing)") + " does not match expected " + sha;
  } catch (error) {
    last = String(error.message || error);
    if (/Refusing promotion/.test(last)) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
console.error("FAIL: staging promotion gate timed out. Last observation:", last);
process.exit(1);
