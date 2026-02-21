/**
 * V2 Routes — Event-sourced endpoints for Home Buddy.
 *
 * These routes coexist with the original CRUD routes in server/routes.ts.
 * All mutation endpoints enforce Idempotency-Key and use the transactional
 * command pipeline (append event + apply projection atomically).
 *
 * Read endpoints query projection tables and return legacy-compatible shapes.
 */

import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { append, readStream, readFromSeq, getCurrentVersion } from "./eventing/eventStore";
import { requireIdempotencyKey } from "./eventing/idempotency";
import { applyEvent } from "./projections/applyEvent";
import { EventTypes, type Actor } from "./eventing/types";
import { validateTransition, TransitionError } from "./domain/stateMachine";
import { isAuthenticated } from "./replit_integrations/auth";

export const v2Router = Router();

v2Router.use(requireIdempotencyKey);

if (process.env.NODE_ENV !== "production") {
  v2Router.use((req, _res, next) => {
    const testUserId = req.headers["x-test-user-id"];
    if (testUserId && !req.user) {
      (req as any).user = { id: parseInt(String(testUserId), 10) || 1 };
      req.isAuthenticated = () => true;
    }
    next();
  });
}
v2Router.use(isAuthenticated);

// ---------------------------------------------------------------------------
// Helper: build actor from session or default to system
// ---------------------------------------------------------------------------
function getActor(req: Request): Actor {
  const user = req.user as { id?: number | string } | undefined;
  if (user?.id) {
    return { actorType: "user", actorId: String(user.id) };
  }
  return { actorType: "system", actorId: "anonymous" };
}

function getUserId(req: Request): string {
  const user = req.user as { id?: number | string } | undefined;
  return String(user?.id ?? "");
}

// ---------------------------------------------------------------------------
// Ownership verification helpers — prevent IDOR on v2 aggregates
// ---------------------------------------------------------------------------

async function verifyHomeOwnership(homeId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT user_id FROM projection_home WHERE home_id = ${homeId}
  `);
  if (result.rows.length === 0) return true;
  return (result.rows[0] as { user_id: string }).user_id === userId;
}

async function verifyHomeOwnershipStrict(homeId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT user_id FROM projection_home WHERE home_id = ${homeId}
  `);
  if (result.rows.length === 0) return false;
  return (result.rows[0] as { user_id: string }).user_id === userId;
}

async function verifySystemOwnership(systemId: string, userId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT s.home_id, h.user_id
    FROM projection_system s
    LEFT JOIN projection_home h ON h.home_id = s.home_id
    WHERE s.system_id = ${systemId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { home_id: string; user_id: string | null };
  if (!row.user_id) return row.home_id;
  return row.user_id === userId ? row.home_id : null;
}

async function verifyTaskOwnership(taskId: string, userId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT t.home_id, h.user_id
    FROM projection_task t
    LEFT JOIN projection_home h ON h.home_id = t.home_id
    WHERE t.task_id = ${taskId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { home_id: string; user_id: string | null };
  if (!row.user_id) return row.home_id;
  return row.user_id === userId ? row.home_id : null;
}

async function verifyReportOwnership(reportId: string, userId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT r.home_id, h.user_id
    FROM projection_report r
    LEFT JOIN projection_home h ON h.home_id = r.home_id
    WHERE r.report_id = ${reportId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { home_id: string; user_id: string | null };
  if (!row.user_id) return row.home_id;
  return row.user_id === userId ? row.home_id : null;
}

async function verifyFindingOwnership(findingId: string, userId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT f.report_id, r.home_id, h.user_id
    FROM projection_finding f
    JOIN projection_report r ON r.report_id = f.report_id
    LEFT JOIN projection_home h ON h.home_id = r.home_id
    WHERE f.finding_id = ${findingId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { report_id: string; home_id: string; user_id: string | null };
  if (!row.user_id) return row.home_id;
  return row.user_id === userId ? row.home_id : null;
}

async function verifyChatSessionOwnership(sessionId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT cs.home_id, h.user_id
    FROM projection_chat_session cs
    LEFT JOIN projection_home h ON h.home_id = cs.home_id
    WHERE cs.session_id = ${sessionId}
  `);
  if (result.rows.length === 0) return false;
  const row = result.rows[0] as { user_id: string | null };
  if (!row.user_id) return true;
  return row.user_id === userId;
}

async function verifyAssistantActionOwnership(actionId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT a.home_id, h.user_id
    FROM projection_assistant_action a
    LEFT JOIN projection_home h ON h.home_id = a.home_id
    WHERE a.assistant_action_id = ${actionId}
  `);
  if (result.rows.length === 0) return false;
  const row = result.rows[0] as { user_id: string | null };
  if (!row.user_id) return true;
  return row.user_id === userId;
}

// ---------------------------------------------------------------------------
// Helper: transactional append + apply
// ---------------------------------------------------------------------------
async function appendAndApply(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: Parameters<typeof append>[1],
) {
  const result = await append(tx, input);
  if (!result.deduped) {
    await applyEvent(tx, {
      event_seq: result.eventSeq,
      event_id: result.eventId,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      aggregate_version: result.version,
      event_type: input.eventType,
      data: (input.data ?? {}) as Record<string, unknown>,
      meta: input.meta ?? {},
      actor_type: input.actor.actorType,
      actor_id: input.actor.actorId,
      occurred_at: new Date().toISOString(),
      session_id: input.sessionId,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: snake_case attrs → camelCase for frontend compatibility
// ---------------------------------------------------------------------------
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// ===========================================================================
// EVENT LOG ENDPOINTS (read-only)
// ===========================================================================

v2Router.get("/events", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const fromSeq = Number(req.query.fromSeq ?? 0);
    const limit = Math.min(Number(req.query.limit ?? 100), 1000);
    const userHomes = await db.execute(sql`
      SELECT home_id FROM projection_home WHERE user_id = ${userId}
    `);
    const homeIds = userHomes.rows.map((r: any) => r.home_id as string);
    if (homeIds.length === 0) {
      res.json({ events: [] });
      return;
    }
    const events = await db.transaction(async (tx) => readFromSeq(tx, fromSeq, limit));
    const filtered = (events as any[]).filter((e: any) => {
      if (e.actor_id === userId) return true;
      if (homeIds.includes(e.aggregate_id)) return true;
      const data = e.data as Record<string, unknown> | undefined;
      if (data?.homeId && homeIds.includes(data.homeId as string)) return true;
      return false;
    });
    res.json({ events: filtered });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.get("/events/stream/:aggregateType/:aggregateId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { aggregateType, aggregateId } = req.params;
    let authorized = false;
    if (aggregateType === "home") {
      authorized = await verifyHomeOwnershipStrict(aggregateId, userId);
    } else if (aggregateType === "system") {
      authorized = (await verifySystemOwnership(aggregateId, userId)) !== null;
    } else if (aggregateType === "task") {
      authorized = (await verifyTaskOwnership(aggregateId, userId)) !== null;
    } else if (aggregateType === "inspection_report") {
      authorized = (await verifyReportOwnership(aggregateId, userId)) !== null;
    } else if (aggregateType === "finding") {
      authorized = (await verifyFindingOwnership(aggregateId, userId)) !== null;
    } else if (aggregateType === "chat_session") {
      authorized = await verifyChatSessionOwnership(aggregateId, userId);
    } else if (aggregateType === "assistant_action") {
      authorized = await verifyAssistantActionOwnership(aggregateId, userId);
    }
    if (!authorized) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const events = await db.transaction(async (tx) =>
      readStream(tx, aggregateType, aggregateId),
    );
    res.json({ events });
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME READ + WRITE ENDPOINTS
// ===========================================================================

v2Router.get("/home", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = await db.execute(sql`
      SELECT home_id, user_id, legacy_id, attrs FROM projection_home
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Home not found" });
      return;
    }

    const row = result.rows[0] as {
      home_id: string;
      user_id: string;
      legacy_id: number | null;
      attrs: Record<string, unknown>;
    };

    const flatAttrs = snakeToCamel(row.attrs);
    res.json({
      id: row.home_id,
      legacyId: row.legacy_id,
      userId: row.user_id,
      ...flatAttrs,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.post("/homes", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = crypto.randomUUID();

    let legacyId: number | null = null;
    const result = await db.transaction(async (tx) => {
      const legacyResult = await tx.execute(sql`
        INSERT INTO homes (user_id, address, street_address, city, state, zip_code, zip_plus_4, address_verified, built_year, sq_ft, type)
        VALUES (
          ${userId},
          ${(req.body.address as string) ?? ""},
          ${(req.body.streetAddress as string) ?? null},
          ${(req.body.city as string) ?? null},
          ${(req.body.state as string) ?? null},
          ${(req.body.zipCode as string) ?? null},
          ${(req.body.zipPlus4 as string) ?? null},
          ${(req.body.addressVerified as boolean) ?? false},
          ${(req.body.builtYear as number) ?? null},
          ${(req.body.sqFt as number) ?? null},
          ${(req.body.type as string) ?? null}
        )
        RETURNING id
      `);
      legacyId = (legacyResult.rows[0] as { id: number }).id;

      return appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: homeId,
        expectedVersion: 0,
        eventType: EventTypes.HomeAttributesUpdated,
        data: { attrs: req.body },
        meta: { userId, legacyId },
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });

    const flatAttrs = snakeToCamel(req.body);
    res.status(201).json({
      id: homeId,
      legacyId,
      userId,
      ...flatAttrs,
      ...result,
    });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/homes/:homeId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id, legacy_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0) {
      res.status(404).json({ error: "Home not found" });
      return;
    }
    if ((ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const legacyId = (ownership.rows[0] as any).legacy_id;
    const { expectedVersion: ev, ...attrs } = req.body;
    const expectedVersion = Number(ev ?? 0);

    const result = await db.transaction(async (tx) => {
      const ver = expectedVersion || await getCurrentVersion(tx, "home", homeId);

      if (legacyId && Object.keys(attrs).length > 0) {
        const allowedCols = new Set([
          "address", "streetAddress", "city", "state", "zipCode", "zipPlus4",
          "addressVerified", "builtYear", "sqFt", "beds", "baths", "type",
          "lotSize", "exteriorType", "roofType", "lastSaleYear",
          "homeValueEstimate", "dataSource", "zillowUrl", "healthScore",
        ]);
        let updateSql = sql`UPDATE homes SET updated_at = now()`;
        for (const [key, value] of Object.entries(attrs)) {
          if (!allowedCols.has(key)) continue;
          const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
          updateSql = sql`${updateSql}, ${sql.raw(snakeKey)} = ${value}`;
        }
        updateSql = sql`${updateSql} WHERE id = ${legacyId}`;
        await tx.execute(updateSql);
      }

      return appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: homeId,
        expectedVersion: ver,
        eventType: EventTypes.HomeAttributesUpdated,
        data: { attrs },
        meta: { userId },
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// SYSTEM READ + WRITE ENDPOINTS
// ===========================================================================

v2Router.get("/homes/:homeId/systems", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0 || (ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await db.execute(sql`
      SELECT system_id, home_id, system_type, attrs, health_state, risk_score, override
      FROM projection_system
      WHERE home_id = ${homeId}
      ORDER BY updated_at DESC
    `);

    const systems = result.rows.map((row: any) => {
      const flatAttrs = snakeToCamel(row.attrs || {});
      return {
        id: row.system_id,
        homeId: row.home_id,
        category: flatAttrs.category || row.system_type || "Other",
        ...flatAttrs,
        healthState: row.health_state,
        riskScore: row.risk_score,
      };
    });

    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.post("/homes/:homeId/systems", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0 || (ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const systemId = crypto.randomUUID();
    const attrs = req.body.attrs ?? req.body;
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: 0,
        eventType: EventTypes.SystemAttributesUpserted,
        data: { homeId, systemType: attrs.category || req.body.systemType, attrs },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );

    const flatAttrs = snakeToCamel(attrs);
    res.status(201).json({ id: systemId, homeId, ...flatAttrs, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/systems/:systemId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { systemId } = req.params;
    if (!(await verifySystemOwnership(systemId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "system", systemId);
      return appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: ver,
        eventType: EventTypes.SystemAttributesUpserted,
        data: { attrs: req.body },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.delete("/systems/:systemId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { systemId } = req.params;
    if (!(await verifySystemOwnership(systemId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "system", systemId);
      return appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: ver,
        eventType: EventTypes.SystemDeleted,
        data: { reason: "User deleted" },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/systems/:systemId/override-health", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { systemId } = req.params;
    if (!(await verifySystemOwnership(systemId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "system", systemId);
      return appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: ver,
        eventType: EventTypes.SystemStatusOverridden,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// TASK READ + WRITE ENDPOINTS
// ===========================================================================

v2Router.get("/homes/:homeId/tasks", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0 || (ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await db.execute(sql`
      SELECT t.task_id, t.home_id, t.system_id, t.state, t.title,
             t.due_at, t.completed_at, t.estimates
      FROM projection_task t
      WHERE t.home_id = ${homeId}
      ORDER BY t.updated_at DESC
    `);

    const stateToLegacyStatus: Record<string, string> = {
      proposed: "pending",
      approved: "pending",
      scheduled: "scheduled",
      in_progress: "scheduled",
      done: "completed",
      skipped: "skipped",
      rejected: "skipped",
      overdue: "pending",
    };

    const tasks = result.rows.map((row: any) => {
      const meta = row.estimates || {};
      const eventMeta = meta as Record<string, unknown>;

      return {
        id: row.task_id,
        homeId: row.home_id,
        relatedSystemId: row.system_id,
        title: row.title,
        status: stateToLegacyStatus[row.state] || "pending",
        state: row.state,
        dueDate: row.due_at,
        completedAt: row.completed_at,
        estimatedCost: eventMeta.estimatedCost ?? null,
        actualCost: eventMeta.actualCost ?? null,
        difficulty: eventMeta.difficulty ?? null,
        description: eventMeta.description ?? null,
        category: eventMeta.category ?? null,
        urgency: eventMeta.urgency ?? "later",
        diyLevel: eventMeta.diyLevel ?? null,
        safetyWarning: eventMeta.safetyWarning ?? null,
        createdFrom: eventMeta.createdFrom ?? "manual",
        isRecurring: eventMeta.isRecurring ?? false,
        recurrenceCadence: eventMeta.recurrenceCadence ?? null,
      };
    });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = req.body.homeId;
    if (homeId && !(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const taskId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ id: taskId, taskId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { taskId } = req.params;
    if (!(await verifyTaskOwnership(taskId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);

      if (req.body.status) {
        const statusToEvent: Record<string, string> = {
          completed: EventTypes.TaskCompleted,
          skipped: EventTypes.TaskSkipped,
          scheduled: EventTypes.TaskScheduled,
        };
        const eventType = statusToEvent[req.body.status];
        if (eventType) {
          return guardedAppendAndApply(tx, {
            aggregateType: "task",
            aggregateId: taskId,
            expectedVersion: ver,
            eventType,
            data: req.body.status === "completed"
              ? { completedAt: new Date().toISOString() }
              : req.body,
            meta: {},
            actor,
            idempotencyKey: req.idempotencyKey!,
          });
        }
      }

      return appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskUpdated,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.delete("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { taskId } = req.params;
    if (!(await verifyTaskOwnership(taskId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);
      return guardedAppendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskSkipped,
        data: { reason: "User deleted" },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

const taskTransitions: Record<string, string> = {
  approve: EventTypes.TaskApproved,
  complete: EventTypes.TaskCompleted,
  reject: EventTypes.TaskRejected,
  schedule: EventTypes.TaskScheduled,
  start: EventTypes.TaskStarted,
  skip: EventTypes.TaskSkipped,
};

for (const [action, eventType] of Object.entries(taskTransitions)) {
  v2Router.post(`/tasks/:taskId/${action}`, async (req: Request, res: Response) => {
    try {
      const actor = getActor(req);
      const userId = getUserId(req);
      const { taskId } = req.params;
      if (!(await verifyTaskOwnership(taskId, userId))) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const result = await db.transaction(async (tx) => {
        const ver = await getCurrentVersion(tx, "task", taskId);
        return guardedAppendAndApply(tx, {
          aggregateType: "task",
          aggregateId: taskId,
          expectedVersion: ver,
          eventType,
          data: req.body ?? {},
          meta: {},
          actor,
          idempotencyKey: req.idempotencyKey!,
        });
      });
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });
}

// ===========================================================================
// REPORT READ + WRITE ENDPOINTS
// ===========================================================================

v2Router.get("/homes/:homeId/reports", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0 || (ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await db.execute(sql`
      SELECT report_id, home_id, state, file_hash, storage_ref, draft, published, error, updated_at
      FROM projection_report
      WHERE home_id = ${homeId}
      ORDER BY updated_at DESC
    `);

    const reports = result.rows.map((row: any) => ({
      id: row.report_id,
      homeId: row.home_id,
      status: row.state,
      fileName: row.file_hash ?? "",
      objectPath: row.storage_ref ?? "",
      summary: row.published?.summary ?? row.draft?.summary ?? null,
      issuesFound: row.published?.issuesFound ?? row.draft?.issuesFound ?? 0,
      createdAt: row.updated_at,
    }));

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.get("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { reportId } = req.params;
    if (!(await verifyReportOwnership(reportId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const reportResult = await db.execute(sql`
      SELECT report_id, home_id, state, file_hash, storage_ref, draft, published, error, updated_at
      FROM projection_report
      WHERE report_id = ${reportId}
    `);

    if (reportResult.rows.length === 0) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const row = reportResult.rows[0] as any;

    const findingsResult = await db.execute(sql`
      SELECT finding_id, state, last_event_seq, updated_at
      FROM projection_finding
      WHERE report_id = ${reportId}
    `);

    const findings = findingsResult.rows.map((f: any) => ({
      id: f.finding_id,
      reportId,
      state: f.state,
    }));

    res.json({
      id: row.report_id,
      homeId: row.home_id,
      status: row.state,
      fileName: row.file_hash ?? "",
      objectPath: row.storage_ref ?? "",
      summary: row.published?.summary ?? row.draft?.summary ?? null,
      issuesFound: row.published?.issuesFound ?? row.draft?.issuesFound ?? 0,
      createdAt: row.updated_at,
      findings,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.post("/homes/:homeId/reports", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const reportId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "inspection_report",
        aggregateId: reportId,
        expectedVersion: 0,
        eventType: EventTypes.InspectionReportUploaded,
        data: { homeId: req.params.homeId, ...req.body },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ id: reportId, reportId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/reports/:reportId/queue-analysis", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { reportId } = req.params;
    if (!(await verifyReportOwnership(reportId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "inspection_report", reportId);
      return guardedAppendAndApply(tx, {
        aggregateType: "inspection_report",
        aggregateId: reportId,
        expectedVersion: ver,
        eventType: EventTypes.InspectionReportAnalysisQueued,
        data: {},
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/reports/:reportId/publish", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { reportId } = req.params;
    if (!(await verifyReportOwnership(reportId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "inspection_report", reportId);
      return guardedAppendAndApply(tx, {
        aggregateType: "inspection_report",
        aggregateId: reportId,
        expectedVersion: ver,
        eventType: EventTypes.InspectionReportPublished,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.delete("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { reportId } = req.params;
    if (!(await verifyReportOwnership(reportId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "inspection_report", reportId);
      return guardedAppendAndApply(tx, {
        aggregateType: "inspection_report",
        aggregateId: reportId,
        expectedVersion: ver,
        eventType: EventTypes.InspectionReportDeleted,
        data: { reason: "User deleted" },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// FINDING ENDPOINTS
// ===========================================================================

v2Router.post("/findings/:findingId/ignore", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { findingId } = req.params;
    if (!(await verifyFindingOwnership(findingId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "finding", findingId);
      return guardedAppendAndApply(tx, {
        aggregateType: "finding",
        aggregateId: findingId,
        expectedVersion: ver,
        eventType: EventTypes.FindingIgnored,
        data: {},
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/findings/:findingId/delete", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { findingId } = req.params;
    if (!(await verifyFindingOwnership(findingId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "finding", findingId);
      return guardedAppendAndApply(tx, {
        aggregateType: "finding",
        aggregateId: findingId,
        expectedVersion: ver,
        eventType: EventTypes.FindingDeleted,
        data: {},
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/findings/:findingId/create-task", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { findingId } = req.params;
    if (!(await verifyFindingOwnership(findingId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const taskId = crypto.randomUUID();

    const result = await db.transaction(async (tx) => {
      const findingVer = await getCurrentVersion(tx, "finding", findingId);
      const findingResult = await guardedAppendAndApply(tx, {
        aggregateType: "finding",
        aggregateId: findingId,
        expectedVersion: findingVer,
        eventType: EventTypes.FindingTaskCreated,
        data: { taskId },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-finding`,
      });

      const taskResult = await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: req.body,
        meta: { fromFinding: findingId },
        actor,
        idempotencyKey: `${req.idempotencyKey!}-task`,
        correlationId: findingResult.eventId,
      });

      return { findingResult, taskResult, taskId };
    });

    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// NOTIFICATION PREFERENCE ENDPOINTS
// ===========================================================================

v2Router.get("/notifications/preferences", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const homeResult = await db.execute(sql`
      SELECT home_id FROM projection_home WHERE user_id = ${userId} LIMIT 1
    `);

    if (homeResult.rows.length === 0) {
      res.json({
        maintenanceReminders: true,
        contractorFollowups: true,
        systemAlerts: true,
        weeklyDigest: false,
        pushEnabled: false,
        emailEnabled: true,
      });
      return;
    }

    const homeId = (homeResult.rows[0] as { home_id: string }).home_id;
    const result = await db.execute(sql`
      SELECT prefs FROM projection_notification_pref WHERE home_id = ${homeId}
    `);

    if (result.rows.length === 0) {
      res.json({
        maintenanceReminders: true,
        contractorFollowups: true,
        systemAlerts: true,
        weeklyDigest: false,
        pushEnabled: false,
        emailEnabled: true,
      });
      return;
    }

    const prefs = (result.rows[0] as { prefs: Record<string, unknown> }).prefs;
    const flatPrefs = snakeToCamel(prefs);
    res.json({
      maintenanceReminders: flatPrefs.maintenanceReminders ?? flatPrefs.taskReminders ?? true,
      contractorFollowups: flatPrefs.contractorFollowups ?? true,
      systemAlerts: flatPrefs.systemAlerts ?? flatPrefs.inspectionAlerts ?? true,
      weeklyDigest: flatPrefs.weeklyDigest ?? false,
      pushEnabled: flatPrefs.pushEnabled ?? false,
      emailEnabled: flatPrefs.emailEnabled ?? true,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.put("/notifications/preferences", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);

    const homeResult = await db.execute(sql`
      SELECT home_id FROM projection_home WHERE user_id = ${userId} LIMIT 1
    `);

    if (homeResult.rows.length === 0) {
      res.status(404).json({ error: "Home not found" });
      return;
    }

    const homeId = (homeResult.rows[0] as { home_id: string }).home_id;

    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "notification_pref", homeId);
      return appendAndApply(tx, {
        aggregateType: "notification_pref",
        aggregateId: homeId,
        expectedVersion: ver,
        eventType: EventTypes.NotificationPreferenceSet,
        data: { prefs: req.body.prefs ?? req.body },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// CHAT READ ENDPOINTS
// ===========================================================================

v2Router.get("/homes/:homeId/chat", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;

    const ownership = await db.execute(sql`
      SELECT user_id FROM projection_home WHERE home_id = ${homeId}
    `);
    if (ownership.rows.length === 0 || (ownership.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const sessionResult = await db.execute(sql`
      SELECT session_id FROM projection_chat_session WHERE home_id = ${homeId} LIMIT 1
    `);

    if (sessionResult.rows.length === 0) {
      res.json([]);
      return;
    }

    const sessionId = (sessionResult.rows[0] as { session_id: string }).session_id;
    const messagesResult = await db.execute(sql`
      SELECT message_id, role, content, created_at
      FROM projection_chat_message
      WHERE session_id = ${sessionId}
      ORDER BY seq ASC
    `);

    const messages = messagesResult.rows.map((row: any) => ({
      id: row.message_id,
      homeId,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.post("/chat/sessions", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = req.body.homeId;
    if (homeId && !(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const sessionId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "chat_session",
        aggregateId: sessionId,
        expectedVersion: 0,
        eventType: EventTypes.ChatSessionCreated,
        data: { homeId },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
        sessionId,
      }),
    );
    res.status(201).json({ sessionId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/chat/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { sessionId } = req.params;
    if (!(await verifyChatSessionOwnership(sessionId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const messageId = crypto.randomUUID();

    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "chat_session", sessionId);
      const msgCount = await tx.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM projection_chat_message WHERE session_id = ${sessionId}
      `);
      const seq = Number((msgCount.rows[0] as { cnt: number }).cnt) + 1;

      return appendAndApply(tx, {
        aggregateType: "chat_session",
        aggregateId: sessionId,
        expectedVersion: ver,
        eventType: EventTypes.ChatMessageSent,
        data: {
          messageId,
          seq,
          role: req.body.role ?? "user",
          content: req.body.content,
        },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
        sessionId,
      });
    });

    res.status(201).json({ messageId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.get("/chat/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    if (!(await verifyChatSessionOwnership(sessionId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const session = await db.execute(sql`
      SELECT * FROM projection_chat_session WHERE session_id = ${sessionId}
    `);
    if (session.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const messages = await db.execute(sql`
      SELECT * FROM projection_chat_message
      WHERE session_id = ${sessionId}
      ORDER BY seq ASC
    `);
    res.json({ session: session.rows[0], messages: messages.rows });
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// ASSISTANT ACTION ENDPOINTS — delegated to server/assistant/assistantRoutes
// ===========================================================================
import { assistantRouter } from "./assistant/assistantRoutes";
v2Router.use("/assistant", assistantRouter);

// ---------------------------------------------------------------------------
// Helper: fetch current aggregate state from projection tables
// ---------------------------------------------------------------------------

async function getAggregateState(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  aggregateType: string,
  aggregateId: string,
): Promise<string | null> {
  let result;
  switch (aggregateType) {
    case "task":
      result = await tx.execute(sql`SELECT state FROM projection_task WHERE task_id = ${aggregateId}`);
      break;
    case "inspection_report":
      result = await tx.execute(sql`SELECT state FROM projection_report WHERE report_id = ${aggregateId}`);
      break;
    case "finding":
      result = await tx.execute(sql`SELECT state FROM projection_finding WHERE finding_id = ${aggregateId}`);
      break;
    case "assistant_action":
      result = await tx.execute(sql`SELECT state FROM projection_assistant_action WHERE assistant_action_id = ${aggregateId}`);
      break;
    default:
      return null;
  }
  if (result.rows.length === 0) return null;
  return (result.rows[0] as { state: string }).state;
}

async function guardedAppendAndApply(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: Parameters<typeof append>[1],
) {
  const currentState = await getAggregateState(tx, input.aggregateType, input.aggregateId);
  validateTransition(input.aggregateType, input.aggregateId, currentState, input.eventType);
  return appendAndApply(tx, input);
}

// ---------------------------------------------------------------------------
// Error handler — translates status-bearing errors into HTTP responses
// ---------------------------------------------------------------------------
function handleError(res: Response, err: unknown): void {
  if (err instanceof TransitionError) {
    res.status(409).json({
      error: err.message,
      currentState: err.currentState,
      eventType: err.eventType,
      aggregateType: err.aggregateType,
    });
    return;
  }
  const error = err as Error & { status?: number; code?: string };
  if (error.code === "23505") {
    res.status(409).json({ error: "Conflict: this operation was already processed" });
    return;
  }
  if (error.code?.startsWith("23")) {
    res.status(400).json({ error: "Invalid data: a database constraint was violated" });
    return;
  }
  if (error.code?.startsWith("22")) {
    res.status(400).json({ error: "Invalid input format" });
    return;
  }
  const status = error.status ?? 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  res.status(status).json({ error: message });
}
