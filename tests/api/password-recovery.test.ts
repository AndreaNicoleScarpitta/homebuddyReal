import { describe, expect, it } from "vitest";

const enabled = process.env.NODE_ENV === "test" &&
  process.env.ALLOW_TEST_USER_HEADER === "1" &&
  !!process.env.DATABASE_URL && !process.env.RESEND_API_KEY;
const base = "http://localhost:" + (process.env.PORT || 5000);

describe.skipIf(!enabled)("password recovery without configured mail provider", () => {
  const forgot = (email: string) => fetch(base + "/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  it("returns 503 for an address that does not exist", async () => {
    const response = await forgot("unregistered-" + Date.now() + "@example.test");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/temporarily unavailable/i);
  });

  it("does not return a false delivery success for a well-formed email", async () => {
    const response = await forgot("another-person@example.test");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/temporarily unavailable/i);
  });

  it("still validates malformed addresses", async () => {
    const response = await forgot("invalid");
    expect(response.status).toBe(400);
  });
});
