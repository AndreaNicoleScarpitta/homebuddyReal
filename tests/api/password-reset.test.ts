import { beforeAll, afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../../server/db";

const enabled = process.env.NODE_ENV === "test" && process.env.ALLOW_TEST_USER_HEADER === "1" && !!process.env.DATABASE_URL;
const base = "http://localhost:" + (process.env.PORT || 5000);
const digest = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

describe.skipIf(!enabled)("password reset token lifecycle", () => {
  const uid = crypto.randomUUID();
  const originalPassword = "Original-test-password";
  const newPassword = "Replacement-test-password";
  const reset = (token: string, password = newPassword) => fetch(base + "/api/auth/reset-password", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
  });
  const issue = async (expired = false) => {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + (expired ? -60_000 : 3_600_000));
    await db.execute(sql`UPDATE users SET password_reset_token = ${digest(token)}, password_reset_token_expires_at = ${expiry} WHERE id = ${uid}`);
    return token;
  };
  beforeAll(async () => {
    const hash = await bcrypt.hash(originalPassword, 10);
    await db.execute(sql`INSERT INTO users (id,email,provider,password_hash) VALUES (${uid}, ${uid + "@example.test"}, 'local', ${hash})`);
  });
  afterAll(async () => {
    await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${uid}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${uid}`);
  });
  it("rejects expired tokens without changing the password", async () => {
    const response = await reset(await issue(true));
    expect(response.status).toBe(400);
    const row = (await db.execute(sql`SELECT password_hash FROM users WHERE id = ${uid}`)).rows[0] as any;
    expect(await bcrypt.compare(originalPassword, row.password_hash)).toBe(true);
  });
  it("does not consume a valid token when password validation fails", async () => {
    const token = await issue();
    expect((await reset(token, "short")).status).toBe(400);
    const row = (await db.execute(sql`SELECT password_reset_token FROM users WHERE id = ${uid}`)).rows[0] as any;
    expect(row.password_reset_token).toBe(digest(token));
  });
  it("resets once, creates a session, sanitizes the response, and rejects replay", async () => {
    const token = await issue();
    const response = await reset(token);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeTruthy();
    const body = await response.json();
    expect(body.user.id).toBe(uid);
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.user).not.toHaveProperty("passwordResetToken");
    const row = (await db.execute(sql`SELECT password_hash,password_reset_token,password_reset_token_expires_at FROM users WHERE id = ${uid}`)).rows[0] as any;
    expect(await bcrypt.compare(newPassword, row.password_hash)).toBe(true);
    expect(await bcrypt.compare(originalPassword, row.password_hash)).toBe(false);
    expect(row.password_reset_token).toBeNull();
    expect(row.password_reset_token_expires_at).toBeNull();
    expect((await reset(token)).status).toBe(400);
  });
  it("accepts only one of two simultaneous requests using the same token", async () => {
    const token = await issue();
    const responses = await Promise.all([reset(token), reset(token)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
  });
  it("invalidates the previous link when a replacement token is issued", async () => {
    const oldToken = await issue();
    const newToken = await issue();
    expect((await reset(oldToken)).status).toBe(400);
    expect((await reset(newToken)).status).toBe(200);
  });
});
