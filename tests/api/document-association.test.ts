import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { db } from "../../server/db";
import { homes, systems, homeDocuments, users } from "../../shared/schema";
import { inArray } from "drizzle-orm";

// Integration test against the running CI server and Postgres. The test-header
// bypass is explicitly disabled outside NODE_ENV=test with opt-in enabled.
const enabled = process.env.NODE_ENV === "test" &&
  process.env.ALLOW_TEST_USER_HEADER === "1" && !!process.env.DATABASE_URL;
const base = `http://localhost:${process.env.PORT || 5000}`;

describe.skipIf(!enabled)("document ↔ system authorization (live API)", () => {
  const a = `doc-ia-a-${crypto.randomUUID()}`;
  const b = `doc-ia-b-${crypto.randomUUID()}`;
  let homeA: number, homeB: number, systemA: number, systemB: number, docA: number, docB: number;

  beforeAll(async () => {
    await db.insert(users).values([{ id: a, email: `${a}@example.test` }, { id: b, email: `${b}@example.test` }]);
    const [ha] = await db.insert(homes).values({ userId: a, address: "Test House A" }).returning();
    const [hb] = await db.insert(homes).values({ userId: b, address: "Test House B" }).returning();
    homeA = ha.id; homeB = hb.id;
    const [sa] = await db.insert(systems).values({ homeId: homeA, name: "Private Furnace A", category: "HVAC" }).returning();
    const [sb] = await db.insert(systems).values({ homeId: homeB, name: "Private Furnace B", category: "HVAC" }).returning();
    systemA = sa.id; systemB = sb.id;
    const [da] = await db.insert(homeDocuments).values({ homeId: homeA, name: "A.pdf", objectPath: "/objects/a" }).returning();
    const [dbDoc] = await db.insert(homeDocuments).values({ homeId: homeB, name: "B.pdf", objectPath: "/objects/b" }).returning();
    docA = da.id; docB = dbDoc.id;
  });

  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, [a, b]));
  });

  const patch = (docId: number, systemId: number | null, userId?: string) =>
    fetch(`${base}/api/documents/${docId}/system`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(userId ? { "x-test-user-id": userId } : {}) },
      body: JSON.stringify({ systemId }),
    });

  it("allows linking a file to a system in its own home", async () => {
    const res = await patch(docA, systemA, a);
    expect(res.status).toBe(200);
    expect((await res.json()).systemId).toBe(systemA);
  });

  it("rejects cross-home system links even when the document is owned", async () => {
    const res = await patch(docA, systemB, a);
    expect(res.status).toBe(400);
    const [doc] = await db.select().from(homeDocuments).where(inArray(homeDocuments.id, [docA]));
    expect(doc.systemId).toBe(systemA);
  });

  it("rejects attempts to modify another homeowner's document", async () => {
    const res = await patch(docB, systemA, a);
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated association mutations", async () => {
    const res = await patch(docA, systemA);
    expect(res.status).toBe(401);
  });

  it("rejects cross-home system ids on initial document creation", async () => {
    const res = await fetch(`${base}/api/home/${homeA}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": a },
      body: JSON.stringify({ name: "invalid.pdf", objectPath: "/objects/no-file", systemId: systemB }),
    });
    expect(res.status).toBe(400);
  });

  it("allows clearing a system association without losing the document", async () => {
    const res = await patch(docA, null, a);
    expect(res.status).toBe(200);
    expect((await res.json()).systemId).toBeNull();
    const [doc] = await db.select().from(homeDocuments).where(inArray(homeDocuments.id, [docA]));
    expect(doc.name).toBe("A.pdf");
    expect(doc.objectPath).toBe("/objects/a");
  });
});
