/**
 * upload-inspection.mjs
 * Pipes the home inspection PDF through the app's document analysis pipeline
 * and prints the generated maintenance tasks.
 *
 * Usage: node scripts/upload-inspection.mjs
 */

import { readFileSync, existsSync } from "fs";
import { basename } from "path";
import { randomUUID } from "crypto";

const BASE = "http://localhost:5000";
const PDF_PATH = "C:\\Users\\andys\\Downloads\\7610_N_Audubon_St___Use_this_one_.pdf";

// ── helpers ────────────────────────────────────────────────────────────────

function jar(cookieHeader) {
  // Extracts the session cookie value from a Set-Cookie header string
  const match = cookieHeader?.match(/connect\.sid=([^;]+)/);
  return match ? `connect.sid=${match[1]}` : null;
}

async function step(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log("✓");
    return result;
  } catch (err) {
    console.log("✗");
    throw err;
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏠  Home Buddy — Inspection Report Analyser\n");

  // 1. Verify the PDF exists
  if (!existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at: ${PDF_PATH}`);
  }
  const pdfBuffer = readFileSync(PDF_PATH);
  console.log(`  Found: ${basename(PDF_PATH)} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)\n`);

  let cookie;
  let csrfToken;

  // Helper: collect all Set-Cookie values across requests
  function mergeCookies(existing, setCookieHeader) {
    if (!setCookieHeader) return existing;
    // setCookieHeader may be a single string or comma-joined list
    const parts = setCookieHeader.split(/,(?=[^ ])/);
    const map = new Map();
    // parse existing
    if (existing) existing.split("; ").forEach(c => {
      const [k, v] = c.split("="); map.set(k.trim(), v);
    });
    // parse new cookies
    parts.forEach(part => {
      const seg = part.split(";")[0].trim();
      const [k, v] = seg.split("="); map.set(k.trim(), v);
    });
    return [...map.entries()].map(([k,v]) => `${k}=${v}`).join("; ");
  }

  // 2. Login
  await step("Logging in as test user", async () => {
    const r = await fetch(`${BASE}/api/auth/test-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test", password: "password123" }),
    });
    if (!r.ok) throw new Error(`Login failed: ${r.status} ${await r.text()}`);
    cookie = mergeCookies(null, r.headers.get("set-cookie"));
    if (!cookie) throw new Error("No session cookie returned");
    await r.json();
  });

  // 3. Fetch CSRF token (double-submit cookie pattern)
  await step("Fetching CSRF token", async () => {
    const r = await fetch(`${BASE}/api/csrf-token`, {
      headers: { Cookie: cookie },
    });
    if (!r.ok) throw new Error(`CSRF fetch failed: ${r.status}`);
    const data = await r.json();
    csrfToken = data.token;
    cookie = mergeCookies(cookie, r.headers.get("set-cookie"));
    if (!csrfToken) throw new Error("No CSRF token in response");
  });

  // 4. Accept disclaimer (required for AI endpoints)
  await step("Accepting AI disclaimer", async () => {
    const r = await fetch(`${BASE}/api/disclaimer/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({}),
    });
    cookie = mergeCookies(cookie, r.headers.get("set-cookie"));
    if (!r.ok) {
      const body = await r.text();
      if (r.status !== 409) throw new Error(`Disclaimer failed: ${r.status} ${body}`);
    }
  });

  // 5. Get home ID
  let homeId;
  await step("Fetching home record", async () => {
    const r = await fetch(`${BASE}/v2/home`, {
      headers: { Cookie: cookie, "x-csrf-token": csrfToken },
    });
    if (!r.ok) throw new Error(`GET /v2/home failed: ${r.status} ${await r.text()}`);
    const home = await r.json();
    homeId = home.id;
    if (!homeId) throw new Error("Home record has no id");
  });

  console.log(`\n  Home ID: ${homeId}\n`);

  // 5. Upload PDF for analysis
  console.log("  Uploading PDF and running AI analysis (this can take 30–60 s)...\n");

  const form = new FormData();
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  form.append("files", blob, basename(PDF_PATH));

  const uploadRes = await fetch(`${BASE}/v2/homes/${homeId}/file-analysis`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "x-csrf-token": csrfToken,
      "Idempotency-Key": randomUUID(),
    },
    body: form,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Analysis failed ${uploadRes.status}: ${body}`);
  }

  const result = await uploadRes.json();

  // ── pretty-print results ────────────────────────────────────────────────

  console.log("━".repeat(60));
  console.log("  ANALYSIS COMPLETE");
  console.log("━".repeat(60));

  if (result.analysisWarnings?.length) {
    console.log("\n  ⚠  Warnings:");
    result.analysisWarnings.forEach(w => console.log(`     • ${w}`));
  }

  // Matched system updates (existing systems with new info)
  if (result.matchedSystemUpdates?.length) {
    console.log(`\n  🔧  System updates (${result.matchedSystemUpdates.length}):`);
    result.matchedSystemUpdates.forEach(u => {
      console.log(`     • ${u.systemName || u.systemId}: ${JSON.stringify(u.updates)}`);
    });
  }

  // Suggested new systems
  if (result.suggestedSystems?.length) {
    console.log(`\n  🏗   New systems detected (${result.suggestedSystems.length}):`);
    result.suggestedSystems.forEach(s => {
      console.log(`\n     ▸ ${s.name} (${s.category})`);
      if (s.pendingTasks?.length) {
        s.pendingTasks.forEach(t => {
          const urgency = t.urgency === "now" ? "🔴" : t.urgency === "soon" ? "🟠" : "🟢";
          console.log(`       ${urgency} [${t.urgency?.toUpperCase() || "?"}] ${t.title}`);
          if (t.estimatedCost) console.log(`           Est. cost: ${t.estimatedCost}`);
        });
      }
    });
  }

  // Matched system tasks (tasks for existing systems)
  if (result.matchedSystemTasks?.length) {
    console.log(`\n  📋  Tasks for existing systems (${result.matchedSystemTasks.length}):`);
    result.matchedSystemTasks.forEach(t => {
      const urgency = t.urgency === "now" ? "🔴" : t.urgency === "soon" ? "🟠" : "🟢";
      console.log(`     ${urgency} [${t.urgency?.toUpperCase() || "?"}] ${t.title}`);
      if (t.estimatedCost) console.log(`         Est. cost: ${t.estimatedCost}`);
    });
  }

  // Pending tasks (flat list across all systems)
  const allTasks = [
    ...(result.pendingTasks || []),
    ...(result.suggestedSystems?.flatMap(s => s.pendingTasks || []) || []),
  ];
  const uniqueTasks = [...new Map(allTasks.map(t => [t.title, t])).values()];

  if (uniqueTasks.length) {
    console.log(`\n  ✅  Total tasks generated: ${uniqueTasks.length}`);
  }

  console.log("\n  Open the app → Dashboard to review and accept tasks.\n");
  console.log(`  Analysis ID: ${result.id || result.analysisId || "(check app)"}`);
  console.log("━".repeat(60) + "\n");
}

main().catch(err => {
  console.error("\n  ❌ ", err.message);
  process.exit(1);
});
