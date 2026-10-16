import { beforeAll, afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../../server/db";
import { eraseUserData } from "../../server/services/account-erasure";

const enabled = process.env.NODE_ENV === "test" &&
  process.env.ALLOW_TEST_USER_HEADER === "1" && !!process.env.DATABASE_URL;
const base = "http://localhost:" + (process.env.PORT || 5000);

describe.skipIf(!enabled)("account closure: real endpoints and persistence", () => {
  const a = "erase-a-" + crypto.randomUUID();
  const b = "erase-b-" + crypto.randomUUID();
  const password = "Test-only-" + crypto.randomUUID();
  let homeA = "";
  let homeB = "";

  const mutate = (method: string, url: string, uid: string | null, body?: unknown) =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json",
        ...(uid ? { "x-test-user-id": uid } : {}),
        "Idempotency-Key": crypto.randomUUID() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const close = (uid: string | null, confirmation = "DELETE", pass = password) =>
    mutate("DELETE", "/api/user/account", uid, { confirmation, password: pass });

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    await db.execute(sql`INSERT INTO users (id,email,provider,password_hash) VALUES
      (${a}, ${a + "@example.test"}, 'local', ${hash}),
      (${b}, ${b + "@example.test"}, 'local', ${hash})`);
    for (const uid of [a, b]) {
      const created = await mutate("POST", "/v2/homes", uid, { zipCode: "99201", type: "Single Family Home" });
      expect(created.status).toBe(201);
      const home = (await created.json()).id as string;
      const system = await mutate("POST", "/v2/homes/" + home + "/systems", uid,
        { name: "Roof", category: "Roof", source: "onboarding-quickpick" });
      expect(system.status).toBe(201);
      if (uid === a) homeA = home; else homeB = home;
    }
    await db.execute(sql`INSERT INTO sessions (sid,sess,expire) VALUES
      (${a + "-one"}, ${JSON.stringify({userId: a})}::jsonb, now() + interval '1 day'),
      (${a + "-two"}, ${JSON.stringify({userId: a})}::jsonb, now() + interval '1 day'),
      (${b + "-one"}, ${JSON.stringify({userId: b})}::jsonb, now() + interval '1 day')`);
  });

  afterAll(async () => {
    for (const uid of [a, b]) {
      const exists = await db.execute(sql`SELECT id FROM users WHERE id = ${uid}`);
      if (exists.rows.length) await eraseUserData(uid, "account");
    }
  });

  it("rejects unauthenticated closure, incorrect confirmation, and wrong password", async () => {
    expect((await close(null)).status).toBe(401);
    expect((await close(a, "not DELETE")).status).toBe(400);
    expect((await close(a, "DELETE", "incorrect")).status).toBe(403);
    expect((await db.execute(sql`SELECT id FROM users WHERE id = ${a}`)).rows).toHaveLength(1);
  });

  it("refuses deletion when a file is not owned by the account", async () => {
    const match = await db.execute(sql`SELECT legacy_id FROM projection_home WHERE home_id = ${homeA}`);
    const id = Number((match.rows[0] as any).legacy_id);
    await db.execute(sql`INSERT INTO home_documents (home_id,name,object_path)
      VALUES (${id}, 'synthetic.txt', '/objects/other-user-object')`);
    expect((await close(a)).status).toBe(409);
    expect((await db.execute(sql`SELECT id FROM users WHERE id = ${a}`)).rows).toHaveLength(1);
    await db.execute(sql`DELETE FROM home_documents WHERE home_id = ${id}`);
  });

  it("closes account and revokes both sessions without altering another account", async () => {
    const completed = await close(a);
    expect(completed.status).toBe(200);
    expect((await completed.json()).success).toBe(true);
    const residual = await db.execute(sql`
      SELECT (SELECT count(*) FROM users WHERE id = ${a}) +
             (SELECT count(*) FROM homes WHERE user_id = ${a}) +
             (SELECT count(*) FROM projection_home WHERE home_id = ${homeA}) +
             (SELECT count(*) FROM projection_task WHERE home_id = ${homeA}) +
             (SELECT count(*) FROM event_log WHERE actor_id = ${a}) +
             (SELECT count(*) FROM sessions WHERE sess->>'userId' = ${a}) AS n`);
    expect(Number((residual.rows[0] as any).n)).toBe(0);
    expect((await db.execute(sql`SELECT id FROM users WHERE id = ${b}`)).rows).toHaveLength(1);
    expect((await db.execute(sql`SELECT home_id FROM projection_home WHERE home_id = ${homeB}`)).rows).toHaveLength(1);
    expect((await db.execute(sql`SELECT sid FROM sessions WHERE sid = ${b + "-one"}`)).rows).toHaveLength(1);
  });

  it("rejects deleted identity login and protected API access", async () => {
    const login = await mutate("POST", "/api/auth/login", null,
      { email: a + "@example.test", password });
    expect(login.status).toBe(401);
    const access = await fetch(base + "/v2/home", { headers: { "x-test-user-id": a } });
    expect(access.status).toBe(401);
  });

  it("data-only deletion preserves login and session while removing home data", async () => {
    const response = await mutate("DELETE", "/api/user/data", b);
    expect(response.status).toBe(200);
    expect((await db.execute(sql`SELECT id FROM users WHERE id = ${b}`)).rows).toHaveLength(1);
    expect((await db.execute(sql`SELECT sid FROM sessions WHERE sid = ${b + "-one"}`)).rows).toHaveLength(1);
    const remaining = await db.execute(sql`
      SELECT (SELECT count(*) FROM projection_home WHERE home_id = ${homeB}) +
             (SELECT count(*) FROM projection_task WHERE home_id = ${homeB}) AS n`);
    expect(Number((remaining.rows[0] as any).n)).toBe(0);
  });
});
