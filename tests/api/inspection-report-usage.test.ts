import { beforeAll, afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "../../server/db";
import { getUserUsage } from "../../server/lib/plans";
import { homes, inspectionReports, users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const enabled = process.env.NODE_ENV === "test" && Boolean(process.env.DATABASE_URL);

// Exercises real Postgres and the actual SQL join: inspection_reports has no user_id.
// A query error is swallowed by the usage helper and incorrectly returns zero,
// so positive fixtures are essential to catch regressions.
describe.skipIf(!enabled)("inspection report per-user monthly usage", () => {
  const owner = "usage-owner-" + crypto.randomUUID();
  const another = "usage-other-" + crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(users).values([
      { id: owner, email: owner + "@example.test" },
      { id: another, email: another + "@example.test" },
    ]);
    const [home] = await db.insert(homes).values({ userId: owner }).returning({ id: homes.id });
    const [otherHome] = await db.insert(homes).values({ userId: another }).returning({ id: homes.id });
    await db.insert(inspectionReports).values([
      { homeId: home.id, fileName: "current.pdf", objectPath: "/objects/current", createdAt: new Date() },
      { homeId: home.id, fileName: "historical.pdf", objectPath: "/objects/historical", createdAt: new Date("2020-01-01T00:00:00Z") },
      { homeId: otherHome.id, fileName: "private.pdf", objectPath: "/objects/private", createdAt: new Date() },
    ]);
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, owner));
    await db.delete(users).where(eq(users.id, another));
  });

  it("counts only this user's reports in the current month", async () => {
    const usage = await getUserUsage(owner);
    expect(usage.homes).toBe(1);
    expect(usage.docAnalysesThisMonth).toBe(1);
    const other = await getUserUsage(another);
    expect(other.docAnalysesThisMonth).toBe(1);
  });
});
