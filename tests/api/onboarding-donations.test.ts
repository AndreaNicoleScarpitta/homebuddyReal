import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "../../server/db";
import { users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { getTemplatesForCategory } from "../../server/services/maintenance-templates";

const enabled = process.env.NODE_ENV === "test" &&
  process.env.ALLOW_TEST_USER_HEADER === "1" && Boolean(process.env.DATABASE_URL);
const base = `http://localhost:${process.env.PORT || 5000}`;

describe.skipIf(!enabled)("quick onboarding starter tasks and donation-only billing", () => {
  const uid = `onboarding-${crypto.randomUUID()}`;
  const headers = { "Content-Type": "application/json", "x-test-user-id": uid };
  let homeId = "";

  beforeAll(async () => {
    await db.insert(users).values({ id: uid, email: `${uid}@example.test` });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, uid));
  });

  it("creates a system and visible starter tasks atomically for a new V2 home", async () => {
    const home = await fetch(`${base}/v2/homes`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ zipCode: "99201", type: "Single Family Home" }),
    });
    expect(home.status).toBe(201);
    homeId = (await home.json()).id;
    expect(homeId).toMatch(/[0-9a-f-]{36}/);

    const key = crypto.randomUUID();
    const system = await fetch(`${base}/v2/homes/${homeId}/systems`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify({ name: "Heating & Cooling", category: "HVAC", source: "onboarding-quickpick" }),
    });
    expect(system.status).toBe(201);
    const systemId = (await system.json()).id;

    const tasks = await fetch(`${base}/v2/homes/${homeId}/tasks`, {
      headers: { "x-test-user-id": uid },
    });
    expect(tasks.status).toBe(200);
    const body = await tasks.json() as Array<{ title: string; relatedSystemId: string; createdFrom: string }>;
    const templates = getTemplatesForCategory("HVAC");
    expect(body).toHaveLength(templates.length);
    expect(body.map(t => t.title).sort()).toEqual(templates.map(t => t.title).sort());
    expect(body.every(t => t.relatedSystemId === systemId && t.createdFrom === "best-practice")).toBe(true);

    // Retrying a system creation must not add another batch of tasks.
    const replay = await fetch(`${base}/v2/homes/${homeId}/systems`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify({ name: "Heating & Cooling", category: "HVAC", source: "onboarding-quickpick" }),
    });
    expect(replay.status).toBe(200);
    const afterReplay = await fetch(`${base}/v2/homes/${homeId}/tasks`, {
      headers: { "x-test-user-id": uid },
    });
    expect((await afterReplay.json()).length).toBe(templates.length);
  });

  it("deduplicates a home and four quick-pick systems even with new request keys", async () => {
    const newHomeId = homeId;
    const retryHome = await fetch(`${base}/v2/homes`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ zipCode: "99201", type: "Single Family Home" }),
    });
    expect(retryHome.status).toBe(200);
    expect((await retryHome.json()).id).toBe(newHomeId);
    const categories = ["HVAC", "Roof", "Electrical", "Plumbing"];
    for (const category of categories) {
      const response = await fetch(`${base}/v2/homes/${newHomeId}/systems`, {
        method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name: category, category, source: "onboarding-quickpick" }),
      });
      expect([200, 201]).toContain(response.status);
    }
    const systems = await fetch(`${base}/v2/homes/${newHomeId}/systems`, {
      headers: { "x-test-user-id": uid },
    });
    expect(systems.status).toBe(200);
    expect((await systems.json()).length).toBe(4);

    const tasks = await fetch(`${base}/v2/homes/${newHomeId}/tasks`, {
      headers: { "x-test-user-id": uid },
    });
    const records = await tasks.json() as Array<{ id: string; title: string; category: string }>;
    expect(records).toHaveLength(15);
    expect(new Set(records.map(t => t.id)).size).toBe(15);
    expect(records.filter(t => t.category === "Electrical")).toHaveLength(3);
    expect(records.filter(t => t.category === "Plumbing")).toHaveLength(4);
  });

  it("restores tasks for an older quick-onboarding system with no task projection", async () => {
    const repairUid = `onboarding-repair-${crypto.randomUUID()}`;
    await db.insert(users).values({ id: repairUid, email: `${repairUid}@example.test` });
    try {
    const repairHeaders = { ...headers, "x-test-user-id": repairUid };
    const homeResponse = await fetch(`${base}/v2/homes`, {
      method: "POST", headers: { ...repairHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ zipCode: "99202", type: "Single Family Home" }),
    });
    expect(homeResponse.status).toBe(201);
    const oldHomeId = (await homeResponse.json()).id as string;
    const oldSystemId = crypto.randomUUID();

    // Simulate the historical bug: an onboarding system exists in V2,
    // but the old generator skipped its starter tasks.
    await db.execute(sql`
      INSERT INTO projection_system (system_id, home_id, system_type, attrs)
      VALUES (${oldSystemId}, ${oldHomeId}, 'Roof',
        ${JSON.stringify({ name: "Roof", category: "Roof", source: "onboarding-quickpick" })}::jsonb)
    `);
    const repair = await fetch(`${base}/v2/homes/${oldHomeId}/starter-tasks/repair`, {
      method: "POST", headers: { ...repairHeaders, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(repair.status).toBe(200);
    expect(await repair.json()).toEqual({ created: getTemplatesForCategory("Roof").length, skipped: false });

    const loaded = await fetch(`${base}/v2/homes/${oldHomeId}/tasks`, {
      headers: { "x-test-user-id": repairUid },
    });
    expect(loaded.status).toBe(200);
    const tasks = await loaded.json() as Array<{ relatedSystemId: string }>;
    expect(tasks).toHaveLength(getTemplatesForCategory("Roof").length);
    expect(tasks.every(t => t.relatedSystemId === oldSystemId)).toBe(true);

    const again = await fetch(`${base}/v2/homes/${oldHomeId}/starter-tasks/repair`, {
      method: "POST", headers: { ...repairHeaders, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ created: 0, skipped: true });
    } finally {
      await db.delete(users).where(eq(users.id, repairUid));
    }
  });

  it("does not recreate tasks when repairing an already populated plan", async () => {
    const res = await fetch(`${base}/v2/homes/${homeId}/starter-tasks/repair`, {
      method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 0, skipped: true });
  });

  it("blocks recurring subscription checkout even for an authenticated account", async () => {
    const response = await fetch(`${base}/api/billing/create-checkout-session`, {
      method: "POST", headers,
      body: JSON.stringify({ plan: "plus" }),
    });
    expect(response.status).toBe(410);
    expect((await response.json()).error).toMatch(/discontinued/i);
  });

  it("accepts only supported one-time donation amounts before invoking Stripe", async () => {
    const response = await fetch(`${base}/api/donations/checkout`, {
      method: "POST", headers,
      body: JSON.stringify({ amount: -100 }),
    });
    expect(response.status).toBe(400);
  });

  it("lists no paid plans for new customers", async () => {
    const response = await fetch(`${base}/api/billing/plans`);
    expect(response.status).toBe(200);
    const plans = await response.json() as Array<{ id: string; priceMonthly: number }>;
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("free");
  });
});
