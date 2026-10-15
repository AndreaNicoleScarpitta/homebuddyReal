import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "../../server/db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
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
    expect(replay.status).toBe(201);
    const afterReplay = await fetch(`${base}/v2/homes/${homeId}/tasks`, {
      headers: { "x-test-user-id": uid },
    });
    expect((await afterReplay.json()).length).toBe(templates.length);
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
