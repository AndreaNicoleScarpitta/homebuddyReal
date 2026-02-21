/**
 * Event Store — append, read, and query the immutable event_log.
 *
 * Core operations:
 *   append()       — Atomically insert an event with idempotency short-circuit
 *                    and optimistic concurrency via aggregate_version.
 *   readStream()   — Read all events for a specific aggregate, ordered by version.
 *   readFromSeq()  — Read events globally starting from a given event_seq.
 *
 * All append operations are designed to run inside a Drizzle transaction so
 * that callers can bundle "append + apply projection" atomically.
 */

import { sql } from "drizzle-orm";
import type { AppendEventInput, AppendResult } from "./types";

type DrizzleTx = Parameters<Parameters<typeof import("../db").db.transaction>[0]>[0];

/**
 * Append a single event to the event_log within an existing transaction.
 *
 * Idempotency: If (actor_id, idempotency_key) already exists, returns the
 * existing event without inserting a duplicate.
 *
 * Optimistic concurrency: The caller provides `expectedVersion`; the insert
 * uses `expectedVersion + 1` as aggregate_version.  If another event already
 * occupies that version slot, the UNIQUE constraint causes a Postgres error
 * which surfaces as a 409 Conflict.
 */
export async function append(
  tx: DrizzleTx,
  input: AppendEventInput,
): Promise<AppendResult> {
  if (!input.idempotencyKey) {
    throw new Error("Idempotency-Key is required for every mutation");
  }

  const dupe = await tx.execute(sql`
    SELECT event_id, aggregate_version, event_seq
    FROM event_log
    WHERE actor_id = ${input.actor.actorId}
      AND idempotency_key = ${input.idempotencyKey}
    LIMIT 1
  `);

  if (dupe.rows.length > 0) {
    const row = dupe.rows[0] as { event_id: string; aggregate_version: number; event_seq: string };
    return {
      deduped: true,
      eventId: row.event_id,
      version: Number(row.aggregate_version),
      eventSeq: Number(row.event_seq),
    };
  }

  const eventId = crypto.randomUUID();
  const nextVersion = input.expectedVersion + 1;

  const result = await tx.execute(sql`
    INSERT INTO event_log (
      event_id, aggregate_type, aggregate_id, aggregate_version,
      event_type, event_schema_version, occurred_at,
      actor_type, actor_id, idempotency_key,
      correlation_id, causation_id, session_id,
      data, meta
    ) VALUES (
      ${eventId}::uuid,
      ${input.aggregateType},
      ${input.aggregateId}::uuid,
      ${nextVersion},
      ${input.eventType},
      1,
      now(),
      ${input.actor.actorType},
      ${input.actor.actorId},
      ${input.idempotencyKey},
      ${input.correlationId ?? null}::uuid,
      ${input.causationId ?? null}::uuid,
      ${input.sessionId ?? null}::uuid,
      ${JSON.stringify(input.data ?? {})}::jsonb,
      ${JSON.stringify(input.meta ?? {})}::jsonb
    )
    RETURNING event_seq
  `);

  const eventSeq = Number((result.rows[0] as { event_seq: string }).event_seq);

  return { deduped: false, eventId, version: nextVersion, eventSeq };
}

/**
 * Read all events for a specific aggregate stream, ordered by version.
 */
export async function readStream(
  tx: DrizzleTx,
  aggregateType: string,
  aggregateId: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await tx.execute(sql`
    SELECT *
    FROM event_log
    WHERE aggregate_type = ${aggregateType}
      AND aggregate_id = ${aggregateId}::uuid
    ORDER BY aggregate_version ASC
  `);
  return result.rows as Array<Record<string, unknown>>;
}

/**
 * Read events globally starting from a given event_seq (inclusive).
 * Used by projection rebuild and catch-up loops.
 */
export async function readFromSeq(
  tx: DrizzleTx,
  fromSeq: number,
  limit = 1000,
): Promise<Array<Record<string, unknown>>> {
  const result = await tx.execute(sql`
    SELECT *
    FROM event_log
    WHERE event_seq >= ${fromSeq}
    ORDER BY event_seq ASC
    LIMIT ${limit}
  `);
  return result.rows as Array<Record<string, unknown>>;
}

/**
 * Get the current (latest) version for an aggregate stream.
 * Returns 0 if no events exist for that aggregate.
 */
export async function getCurrentVersion(
  tx: DrizzleTx,
  aggregateType: string,
  aggregateId: string,
): Promise<number> {
  const result = await tx.execute(sql`
    SELECT COALESCE(MAX(aggregate_version), 0) AS version
    FROM event_log
    WHERE aggregate_type = ${aggregateType}
      AND aggregate_id = ${aggregateId}::uuid
  `);
  return Number((result.rows[0] as { version: string }).version);
}
