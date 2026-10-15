/**
 * Permanent HomeBuddy data/account erasure.
 * Fail closed on object-storage errors, unknown ownership and SQL failures.
 * Payment-provider transaction records may have their own retention rules.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";

export class ErasureBlockedError extends Error {
  constructor(message: string, readonly statusCode = 409) {
    super(message);
    this.name = "ErasureBlockedError";
  }
}

type ErasureMode = "data" | "account";
const count = (r: { rows: any[] }) => Number(r.rows[0]?.n ?? 0);

export async function eraseUserData(userId: string, mode: ErasureMode): Promise<{ homes: number; objects: number }> {
  const uid = String(userId);
  const files = new ObjectStorageService();
  const current = await db.execute(sql`SELECT email, stripe_subscription_id, plan_status FROM users WHERE id = ${uid}`);
  if (current.rows.length !== 1) throw new ErasureBlockedError("Account not found.", 404);
  const account = current.rows[0] as { email: string | null; stripe_subscription_id: string | null; plan_status: string | null };
  if (mode === "account" && account.stripe_subscription_id &&
    ["active", "past_due", "trialing"].includes(account.plan_status || "")) {
    throw new ErasureBlockedError("Cancel your legacy subscription before closing the account. Contact support.");
  }

  // ACL ownership is authoritative. Include unlinked uploads.
  const owned = await db.execute(sql`SELECT object_key FROM object_acl WHERE owner_id = ${uid}`);
  const keys = new Set(owned.rows.map(r => String((r as any).object_key)));
  const refs = await db.execute(sql`
    SELECT d.object_path AS path FROM home_documents d JOIN homes h ON h.id = d.home_id WHERE h.user_id = ${uid}
    UNION SELECT r.object_path FROM inspection_reports r JOIN homes h ON h.id = r.home_id WHERE h.user_id = ${uid}
    UNION SELECT p.storage_ref FROM projection_report p JOIN projection_home h ON h.home_id = p.home_id WHERE h.user_id = ${uid}
    UNION SELECT c.image_url FROM projection_circuit_map c JOIN projection_home h ON h.home_id = c.home_id WHERE h.user_id = ${uid}
  `);
  for (const ref of refs.rows) {
    const path = (ref as any).path;
    if (typeof path !== "string" || !path.startsWith("/objects/")) continue;
    const name = path.slice("/objects/".length);
    if (!name || name.includes("..") || name.includes("?") || name.startsWith("/") ||
      !keys.has(files.getPrivateObjectDir() + "/" + name)) {
      throw new ErasureBlockedError("An uploaded file has missing or mismatched ownership. Contact support.");
    }
  }

  // R2 is outside the DB transaction. Failure leaves DB references intact and
  // retryable; the deletion operation itself is idempotent.
  for (const key of keys) {
    await files.deleteObject(key);
    if (await files.objectExists(key)) throw new Error("Storage did not confirm deletion.");
  }

  let homeCount = 0;
  await db.transaction(async tx => {
    const locked = await tx.execute(sql`SELECT id FROM users WHERE id = ${uid} FOR UPDATE`);
    if (locked.rows.length !== 1) throw new Error("Account changed during erasure.");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${uid}))`);
    const oldHomes = await tx.execute(sql`SELECT id FROM homes WHERE user_id = ${uid}`);
    const v2Homes = await tx.execute(sql`SELECT home_id FROM projection_home WHERE user_id = ${uid}`);
    const homeIds = v2Homes.rows.map(r => String((r as any).home_id));
    homeCount = oldHomes.rows.length + homeIds.length;

    // Trigger changes are transaction-scoped; failure rolls back BOTH changes.
    // Delete whole event aggregates, not just the home event or the user's events.
    await tx.execute(sql`ALTER TABLE event_log DISABLE TRIGGER trg_event_log_immutable`);
    await tx.execute(sql`
      DELETE FROM event_log WHERE aggregate_id IN (
        SELECT DISTINCT aggregate_id FROM event_log
        WHERE actor_id = ${uid} OR meta->>'userId' = ${uid}
          OR data->>'homeId' IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
          OR aggregate_id::text IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
          OR aggregate_id::text IN (
            SELECT system_id FROM projection_system WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
            UNION SELECT task_id FROM projection_task WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
            UNION SELECT report_id FROM projection_report WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
          )
      )
    `);
    await tx.execute(sql`ALTER TABLE event_log ENABLE TRIGGER trg_event_log_immutable`);

    // job_queue column is payload, not data.
    await tx.execute(sql`
      DELETE FROM job_queue WHERE payload->>'userId' = ${uid} OR payload->>'user_id' = ${uid}
        OR payload->>'homeId' IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
        OR payload->>'home_id' IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
    `);
    await tx.execute(sql`
      DELETE FROM projection_chat_message WHERE session_id IN (
        SELECT session_id FROM projection_chat_session
        WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})
      )
    `);
    for (const query of [
      sql`DELETE FROM projection_chat_session WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_finding WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_task WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_report WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_system WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_assistant_action WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_notification_pref WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
      sql`DELETE FROM projection_circuit_map WHERE home_id IN (SELECT home_id FROM projection_home WHERE user_id = ${uid})`,
    ]) await tx.execute(query);
    await tx.execute(sql`DELETE FROM projection_home WHERE user_id = ${uid}`);

    // Legacy home children use ON DELETE CASCADE. Any broken FK aborts.
    await tx.execute(sql`DELETE FROM homes WHERE user_id = ${uid}`);
    await tx.execute(sql`DELETE FROM notification_preferences WHERE user_id = ${uid}`);
    await tx.execute(sql`DELETE FROM object_acl WHERE owner_id = ${uid}`);
    if (mode === "account") {
      // Remove all device sessions, then identity and credential hashes.
      await tx.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${uid}`);
      if (account.email) await tx.execute(sql`DELETE FROM contact_messages WHERE lower(email) = lower(${account.email})`);
      await tx.execute(sql`DELETE FROM users WHERE id = ${uid}`);
    }

    const residual = await tx.execute(sql`
      SELECT (SELECT count(*) FROM homes WHERE user_id = ${uid}) +
             (SELECT count(*) FROM projection_home WHERE user_id = ${uid}) +
             (SELECT count(*) FROM object_acl WHERE owner_id = ${uid}) +
             (SELECT count(*) FROM notification_preferences WHERE user_id = ${uid}) +
             (SELECT count(*) FROM event_log WHERE actor_id = ${uid}) AS n
    `);
    if (count(residual) !== 0) throw new Error("Erasure verification failed.");
    for (const homeId of homeIds) {
      const remaining = await tx.execute(sql`
        SELECT (SELECT count(*) FROM projection_task WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_system WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_report WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_finding WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_chat_session WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_circuit_map WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_assistant_action WHERE home_id = ${homeId}) +
               (SELECT count(*) FROM projection_notification_pref WHERE home_id = ${homeId}) AS n
      `);
      if (count(remaining) !== 0) throw new Error("Home erasure verification failed.");
    }
    if (mode === "account") {
      const remaining = await tx.execute(sql`
        SELECT (SELECT count(*) FROM users WHERE id = ${uid}) +
               (SELECT count(*) FROM sessions WHERE sess->>'userId' = ${uid}) AS n
      `);
      if (count(remaining) !== 0) throw new Error("Account erasure verification failed.");
    }
  });
  return { homes: homeCount, objects: keys.size };
}
