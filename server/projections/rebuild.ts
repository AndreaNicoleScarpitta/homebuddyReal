/**
 * Projection Rebuild — replays all events from event_log and recomputes
 * every projection table from scratch.
 *
 * Usage:
 *   import { rebuildAll } from "./rebuild";
 *   await rebuildAll();           // full rebuild from seq 0
 *   await rebuildAll(12345);      // partial rebuild from seq 12345
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { applyEvent } from "./applyEvent";

const BATCH_SIZE = 500;

/**
 * Rebuild all projections by replaying events from a starting sequence.
 * If fromSeq is 0 (default), truncates projection tables first for a
 * clean rebuild.
 */
export async function rebuildAll(fromSeq = 0): Promise<{ processed: number }> {
  if (fromSeq === 0) {
    await db.execute(sql`
      TRUNCATE
        projection_home,
        projection_system,
        projection_report,
        projection_finding,
        projection_task,
        projection_notification_pref,
        projection_assistant_action,
        projection_chat_session,
        projection_chat_message,
        projection_checkpoint
    `);
  }

  let processed = 0;
  let cursor = fromSeq;

  for (;;) {
    const batch = await db.execute(sql`
      SELECT *
      FROM event_log
      WHERE event_seq >= ${cursor}
      ORDER BY event_seq ASC
      LIMIT ${BATCH_SIZE}
    `);

    if (batch.rows.length === 0) break;

    for (const row of batch.rows) {
      await db.transaction(async (tx) => {
        await applyEvent(tx, row as never);
      });
      processed++;
    }

    const lastRow = batch.rows[batch.rows.length - 1] as { event_seq: string };
    cursor = Number(lastRow.event_seq) + 1;
  }

  return { processed };
}
