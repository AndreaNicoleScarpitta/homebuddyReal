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
import { logError as logErrorV2 } from "./lib/logger";
import {
  resolveNamespacePrefix,
  namespaceTaskAttributes,
  generateInstancePrefix,
  systemNameToPrefix,
} from "./lib/attribute-namespace";
import { CURRENT_DISCLAIMER_VERSION } from "./replit_integrations/auth/routes";

export const v2Router = Router();

v2Router.use(requireIdempotencyKey);

// Test-user header bypass: lets integration tests inject a user via
// `x-test-user-id` without going through OIDC. Double-gated:
//   1. NODE_ENV !== "production"
//   2. ALLOW_TEST_USER_HEADER === "1" (explicit opt-in)
//
// The second gate matters because non-production builds still get deployed
// (staging, preview envs). A stray NODE_ENV=development on a public host
// would otherwise let anyone spoof any user id. Require an explicit env
// flag that no deployed environment should ever set.
if (
  process.env.NODE_ENV !== "production" &&
  process.env.ALLOW_TEST_USER_HEADER === "1"
) {
  v2Router.use((req, _res, next) => {
    const testUserId = req.headers["x-test-user-id"];
    if (testUserId && !req.user) {
      (req as any).user = { id: parseInt(String(testUserId), 10) || 1 };
      (req as any).isAuthenticated = () => true;
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

function requireDisclaimer(req: Request, res: Response): boolean {
  const user = req.user as any;
  if (
    !user?.disclaimerAccepted ||
    user?.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION
  ) {
    res.status(403).json({
      error: "Disclaimer acceptance required",
      code: "DISCLAIMER_REQUIRED",
      currentVersion: CURRENT_DISCLAIMER_VERSION,
    });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Ownership verification helpers — prevent IDOR on v2 aggregates
// ---------------------------------------------------------------------------

async function verifyHomeOwnership(homeId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT user_id FROM projection_home WHERE home_id = ${homeId}
  `);
  if (result.rows.length === 0) return true; // new home being created
  const owner = (result.rows[0] as { user_id: string | null }).user_id;
  if (!owner) return false; // orphaned home — deny access
  return owner === userId;
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
  if (!row.user_id) return null; // orphaned — deny access
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
  if (!row.user_id) return null; // orphaned — deny access
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
  if (!row.user_id) return null; // orphaned — deny access
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
  if (!row.user_id) return null; // orphaned — deny access
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
    handleError(res, err);
  }
});

v2Router.post("/homes", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = crypto.randomUUID();

    const addressLine1 = (req.body.addressLine1 as string) || null;
    const addressLine2 = (req.body.addressLine2 as string) || null;
    const city = (req.body.city as string) || null;
    const state = (req.body.state as string) || null;
    const zipCode = (req.body.zipCode as string) || null;

    if (!addressLine1 || !city || !state || !zipCode) {
      res.status(400).json({ error: "Address line 1, city, state, and ZIP code are required." });
      return;
    }
    if (state.length !== 2) {
      res.status(400).json({ error: "State must be a 2-letter abbreviation." });
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      res.status(400).json({ error: "ZIP code must be 5 digits (or ZIP+4 format)." });
      return;
    }

    const compositeAddress = [addressLine1, addressLine2, `${city}, ${state} ${zipCode}`]
      .filter(Boolean)
      .join(", ");

    const builtYear = req.body.builtYear != null ? Number(req.body.builtYear) : null;
    const sqFt = req.body.sqFt != null ? Number(req.body.sqFt) : null;

    if (builtYear != null && (isNaN(builtYear) || builtYear < 1600 || builtYear > new Date().getFullYear())) {
      res.status(400).json({ error: "Year built must be between 1600 and the current year." });
      return;
    }
    if (sqFt != null && (isNaN(sqFt) || sqFt < 100 || sqFt > 100000)) {
      res.status(400).json({ error: "Square footage must be between 100 and 100,000." });
      return;
    }

    const safeBody = { ...req.body };
    delete safeBody.addressLine1;
    delete safeBody.addressLine2;
    delete safeBody.address;

    let legacyId: number | null = null;
    const result = await db.transaction(async (tx) => {
      const legacyResult = await tx.execute(sql`
        INSERT INTO homes (user_id, address, address_line_1, address_line_2, city, state, zip_code, built_year, sq_ft, type)
        VALUES (
          ${userId},
          ${compositeAddress},
          ${addressLine1},
          ${addressLine2},
          ${city},
          ${state},
          ${zipCode},
          ${builtYear},
          ${sqFt},
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
        data: {
          attrs: {
            city,
            state,
            zipCode,
            builtYear,
            sqFt,
            type: req.body.type,
          },
        },
        meta: { userId, legacyId },
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });

    res.status(201).json({
      id: homeId,
      legacyId,
      userId,
      city,
      state,
      zipCode,
      builtYear,
      sqFt,
      type: req.body.type,
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
    handleError(res, err);
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

    // Auto-generate best-practice maintenance tasks for the new system
    const category = attrs.category || req.body.systemType || "Other";
    const systemName = attrs.name || category;
    try {
      const { generateTasksForSystem } = await import("./services/maintenance-templates");
      // Resolve legacy homeId for task insertion
      const legacyHomeId = await resolveHomeId(homeId);
      if (!isNaN(legacyHomeId)) {
        // Get the legacy system ID from projection
        const projRow = await db.execute(sql`
          SELECT (attrs->>'legacyId')::int as legacy_id FROM projection_system WHERE system_id = ${systemId}
        `);
        const legacySystemId = (projRow.rows[0] as any)?.legacy_id;
        if (legacySystemId) {
          const tasks = generateTasksForSystem(legacyHomeId, legacySystemId, category, systemName);
          for (const task of tasks) {
            await db.execute(sql`
              INSERT INTO maintenance_tasks (home_id, related_system_id, title, description, category, urgency, diy_level, estimated_cost, safety_warning, is_recurring, recurrence_cadence, created_from, due_date)
              VALUES (${task.homeId}, ${task.relatedSystemId}, ${task.title}, ${task.description}, ${task.category}, ${task.urgency}, ${task.diyLevel}, ${task.estimatedCost}, ${task.safetyWarning}, ${task.isRecurring}, ${task.recurrenceCadence}, ${task.createdFrom}, ${task.dueDate})
            `);
          }
        }
      }
    } catch (taskErr) {
      // Non-fatal: system was created even if task generation fails
      logErrorV2("v2.autoTaskGeneration", taskErr);
    }

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

    let tasks;
    if (result.rows.length > 0) {
      tasks = result.rows.map((row: any) => {
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
          namespacePrefix: eventMeta.namespacePrefix ?? null,
          namespacedAttributes: eventMeta.namespacedAttributes ?? null,
        };
      });
    } else {
      // Fallback: read from legacy maintenance_tasks table
      const legacyHomeId = await resolveHomeId(homeId);
      if (!isNaN(legacyHomeId)) {
        const legacyResult = await db.execute(sql`
          SELECT * FROM maintenance_tasks WHERE home_id = ${legacyHomeId} ORDER BY due_date ASC NULLS LAST, created_at DESC
        `);
        tasks = legacyResult.rows.map((row: any) => ({
          id: String(row.id),
          homeId: homeId,
          relatedSystemId: row.related_system_id ? String(row.related_system_id) : null,
          title: row.title,
          status: row.status || "pending",
          state: row.status === "completed" ? "done" : row.status === "skipped" ? "skipped" : "approved",
          dueDate: row.due_date,
          completedAt: row.completed_at,
          estimatedCost: row.estimated_cost,
          actualCost: row.actual_cost,
          difficulty: row.difficulty,
          description: row.description,
          category: row.category,
          urgency: row.urgency || "later",
          diyLevel: row.diy_level,
          safetyWarning: row.safety_warning,
          createdFrom: row.created_from || "manual",
          isRecurring: row.is_recurring || false,
          recurrenceCadence: row.recurrence_cadence,
          namespacePrefix: null,
          namespacedAttributes: null,
        }));
      } else {
        tasks = [];
      }
    }

    res.json(tasks);
  } catch (err) {
    handleError(res, err);
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

    let nsPrefix = req.body.namespacePrefix || null;
    if (!nsPrefix) {
      const systemId = req.body.systemId || req.body.relatedSystemId;
      if (systemId) {
        const sysResult = await db.execute(
          sql`SELECT system_id, system_type, attrs FROM projection_system WHERE system_id = ${systemId} LIMIT 1`
        );
        if (sysResult.rows.length > 0) {
          const row = sysResult.rows[0] as { system_type: string; attrs: Record<string, string>; system_id: string };
          const category = row.attrs?.category || row.system_type || "other";
          const name = row.attrs?.name || category;
          nsPrefix = generateInstancePrefix(category, name, row.system_id);
        }
      }
      if (!nsPrefix && (req.body.category || req.body.estimates?.category)) {
        nsPrefix = systemNameToPrefix(req.body.category || req.body.estimates.category);
      }
      if (!nsPrefix) {
        nsPrefix = "unknown_system";
      }
    }

    let nsAttrs = req.body.namespacedAttributes || null;
    if (!nsAttrs && nsPrefix !== "unknown_system") {
      const attrFields: Record<string, string | null | undefined> = {
        urgency: req.body.urgency || req.body.estimates?.urgency,
        diy_level: req.body.diyLevel || req.body.estimates?.diyLevel,
        estimated_cost: req.body.estimatedCost || req.body.estimates?.estimatedCost,
        description: req.body.description || req.body.estimates?.description,
        safety_warning: req.body.safetyWarning || req.body.estimates?.safetyWarning,
      };
      nsAttrs = namespaceTaskAttributes(attrFields, nsPrefix);
    }

    const taskData = { ...req.body, namespacePrefix: nsPrefix, namespacedAttributes: nsAttrs };

    const taskId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: taskData,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ id: taskId, taskId, namespacePrefix: nsPrefix, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/tasks/analyze", async (req: Request, res: Response) => {
  try {
    const { title, category, systemId, systemName: sysName } = req.body;
    if (!title || typeof title !== "string" || title.trim().length < 3) {
      res.status(400).json({ error: "Task title is required (min 3 characters)" });
      return;
    }

    let nsPrefix = "unknown_system";
    if (systemId) {
      const sysResult = await db.execute(
        sql`SELECT system_id, system_type, attrs FROM projection_system WHERE system_id = ${systemId} LIMIT 1`
      );
      if (sysResult.rows.length > 0) {
        const row = sysResult.rows[0] as { system_type: string; attrs: Record<string, string>; system_id: string };
        const cat = row.attrs?.category || row.system_type || "other";
        const nm = row.attrs?.name || cat;
        nsPrefix = generateInstancePrefix(cat, nm, row.system_id);
      }
    } else if (sysName && category) {
      nsPrefix = generateInstancePrefix(category, sysName);
    } else if (category) {
      nsPrefix = systemNameToPrefix(category);
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const prompt = `You are a home maintenance expert. A homeowner wants to add this task: "${title.trim()}"${category ? ` (category: ${category})` : ""}.

Analyze this task and return a JSON object with SYSTEM-SCOPED attribute keys.
The namespace prefix for this task is: "${nsPrefix}"

All attribute keys in your response MUST be prefixed with "${nsPrefix}_". For example:
- "${nsPrefix}_urgency": one of "now", "soon", "later", "monitor"
- "${nsPrefix}_diy_level": one of "DIY-Safe", "Caution", "Pro-Only"
- "${nsPrefix}_estimated_cost": a realistic cost range string like "$0-25", "$50-150", "$200-500"
- "${nsPrefix}_description": 1-2 sentence explanation of this task
- "${nsPrefix}_safety_warning": a brief safety note if relevant, or null

Also include these standard (unprefixed) fields for backward compatibility:
- "urgency": same value as ${nsPrefix}_urgency
- "diyLevel": same value as ${nsPrefix}_diy_level
- "estimatedCost": same value as ${nsPrefix}_estimated_cost
- "description": same value as ${nsPrefix}_description
- "safetyWarning": same value as ${nsPrefix}_safety_warning

Be practical and realistic. Most routine cleaning/filter tasks are DIY-Safe with low urgency. Electrical, gas, structural, and roofing work is typically Pro-Only.

Return ONLY a valid JSON object, no markdown or explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const validUrgencies = ["now", "soon", "later", "monitor"];
    const validDiy = ["DIY-Safe", "Caution", "Pro-Only"];

    const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency : "later";
    const diyLevel = validDiy.includes(parsed.diyLevel) ? parsed.diyLevel : "Caution";
    const estimatedCost = parsed.estimatedCost || "TBD";
    const description = parsed.description || "";
    const safetyWarning = parsed.safetyWarning || null;

    const namespacedAttrs = namespaceTaskAttributes(
      { urgency, diy_level: diyLevel, estimated_cost: estimatedCost, description, safety_warning: safetyWarning || "" },
      nsPrefix
    );

    res.json({
      urgency,
      diyLevel,
      estimatedCost,
      description,
      safetyWarning,
      namespacePrefix: nsPrefix,
      namespacedAttributes: namespacedAttrs,
    });
  } catch (err) {
    logErrorV2("v2.aiTaskAnalysis", err);
    res.status(500).json({ error: "Failed to analyze task" });
  }
});

v2Router.post("/systems/suggest-tasks", async (req: Request, res: Response) => {
  try {
    const { systemName, systemCategory, systemId, notes } = req.body;
    if (!systemName) {
      res.status(400).json({ error: "systemName is required" });
      return;
    }

    const nsPrefix = generateInstancePrefix(
      systemCategory || "other",
      systemName,
      systemId
    );

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const prompt = `You are a home maintenance expert. A homeowner has added a "${systemCategory || 'Other'}" system called "${systemName}"${notes ? ` with notes: "${notes}"` : ''}.

Generate a JSON array of 3-6 best-practice maintenance tasks for this system. Each task should have:
- "title": concise task name
- "description": 1-2 sentence explanation of why this task matters
- "urgency": one of "now", "soon", "later", "monitor"
- "diyLevel": one of "DIY-Safe", "Caution", "Pro-Only"
- "cadence": recommended frequency like "monthly", "quarterly", "semi-annually", "annually", "every-2-years", "every-5-years", "as-needed"
- "monthsUntilDue": how many months from now until first due (integer)
- "estimatedCost": rough cost range string like "$0-50" or "$100-300"
- "safetyWarning": any safety notes or null

Focus on practical, actionable tasks that a homeowner would actually need. Be specific to the system type.

Return ONLY a valid JSON array, no markdown or explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
    const tasks = JSON.parse(cleaned);

    const namespacedTasks = tasks.map((t: Record<string, unknown>) => ({
      ...t,
      namespacePrefix: nsPrefix,
      namespacedAttributes: namespaceTaskAttributes(
        {
          urgency: String(t.urgency || "later"),
          diy_level: String(t.diyLevel || "Caution"),
          estimated_cost: String(t.estimatedCost || "TBD"),
          description: String(t.description || ""),
          safety_warning: String(t.safetyWarning || ""),
        },
        nsPrefix
      ),
    }));

    res.json({ tasks: namespacedTasks, namespacePrefix: nsPrefix });
  } catch (err) {
    logErrorV2("v2.aiTaskSuggestion", err);
    res.status(500).json({ error: "Failed to generate task suggestions" });
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
    handleError(res, err);
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
      ...(f.card || {}),
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
    handleError(res, err);
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
        contractorMode: false,
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
      contractorMode: flatPrefs.contractorMode ?? false,
    });
  } catch (err) {
    handleError(res, err);
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
    handleError(res, err);
  }
});

v2Router.get("/homes/:homeId/chat/sessions", async (req: Request, res: Response) => {
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

    const sessions = await db.execute(sql`
      SELECT cs.session_id, cs.home_id, cs.title, cs.created_at,
             (SELECT COUNT(*)::int FROM projection_chat_message cm WHERE cm.session_id = cs.session_id) AS message_count
      FROM projection_chat_session cs
      WHERE cs.home_id = ${homeId}
      ORDER BY cs.created_at DESC
    `);

    res.json(sessions.rows.map((row: any) => ({
      id: row.session_id,
      homeId: row.home_id,
      title: row.title || 'New Conversation',
      messageCount: row.message_count,
      createdAt: row.created_at,
    })));
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/chat/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    if (!(await verifyChatSessionOwnership(sessionId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { title } = req.body;
    if (title) {
      await db.execute(sql`
        UPDATE projection_chat_session SET title = ${title} WHERE session_id = ${sessionId}
      `);
    }
    res.json({ sessionId, title });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/chat/sessions", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = req.body.homeId;
    if (homeId && !(await verifyHomeOwnershipStrict(homeId, userId))) {
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
// Circuit Map routes
// ---------------------------------------------------------------------------

async function verifyCircuitMapOwnership(mapId: string, userId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT cm.home_id, h.user_id
    FROM projection_circuit_map cm
    LEFT JOIN projection_home h ON h.home_id = cm.home_id
    WHERE cm.map_id = ${mapId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { home_id: string; user_id: string };
  if (row.user_id !== userId) return null;
  return row.home_id;
}

v2Router.get("/homes/:homeId/circuit-maps", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;
    if (!(await verifyHomeOwnershipStrict(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT map_id, home_id, system_id, image_url, store_image, state, breakers, created_at, updated_at
      FROM projection_circuit_map
      WHERE home_id = ${homeId}
      ORDER BY created_at DESC
    `);
    const maps = result.rows.map((row: any) => ({
      id: row.map_id,
      homeId: row.home_id,
      systemId: row.system_id,
      imageUrl: row.store_image ? row.image_url : null,
      storeImage: !!row.store_image,
      state: row.state,
      breakers: row.breakers ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json(maps);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.get("/circuit-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { mapId } = req.params;
    if (!(await verifyCircuitMapOwnership(mapId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT map_id, home_id, system_id, image_url, store_image, state, breakers, created_at, updated_at
      FROM projection_circuit_map
      WHERE map_id = ${mapId}
    `);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Circuit map not found" });
      return;
    }
    const row = result.rows[0] as any;
    res.json({
      id: row.map_id,
      homeId: row.home_id,
      systemId: row.system_id,
      imageUrl: row.store_image ? row.image_url : null,
      storeImage: !!row.store_image,
      state: row.state,
      breakers: row.breakers ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/homes/:homeId/circuit-maps", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { homeId } = req.params;
    if (!(await verifyHomeOwnershipStrict(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const mapId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "circuit_map",
        aggregateId: mapId,
        expectedVersion: 0,
        eventType: EventTypes.CircuitMapCreated,
        data: {
          homeId,
          systemId: req.body.systemId,
          imageUrl: req.body.imageUrl,
          storeImage: req.body.storeImage ?? false,
          breakers: req.body.breakers ?? [],
        },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ id: mapId, mapId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/circuit-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { mapId } = req.params;
    if (!(await verifyCircuitMapOwnership(mapId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "circuit_map", mapId);
      return appendAndApply(tx, {
        aggregateType: "circuit_map",
        aggregateId: mapId,
        expectedVersion: ver,
        eventType: EventTypes.CircuitMapAnnotated,
        data: {
          breakers: req.body.breakers,
          imageUrl: req.body.imageUrl,
          storeImage: req.body.storeImage,
        },
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

v2Router.delete("/circuit-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const { mapId } = req.params;
    if (!(await verifyCircuitMapOwnership(mapId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "circuit_map", mapId);
      return appendAndApply(tx, {
        aggregateType: "circuit_map",
        aggregateId: mapId,
        expectedVersion: ver,
        eventType: EventTypes.CircuitMapDeleted,
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
    case "circuit_map":
      result = await tx.execute(sql`SELECT state FROM projection_circuit_map WHERE map_id = ${aggregateId}`);
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
// ---------------------------------------------------------------------------
// File Upload & Analysis Pipeline
// ---------------------------------------------------------------------------

import multer from "multer";
import { runAnalysisPipeline } from "./lib/analysis-pipeline";
import type { AnalysisResult, SuggestedSystem } from "./lib/analysis-pipeline";
import { extractTextFromDocument } from "./lib/document-analysis";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { homeDocuments } from "@shared/schema";

async function extractTextFromImage(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a document text extractor. Extract ALL readable text from this image. Include labels, numbers, dates, descriptions, and any other visible text. If the image contains a home inspection report, receipt, invoice, or maintenance document, extract every detail. Return ONLY the extracted text, no commentary.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract all text from this image (${fileName}):` },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0,
  });

  return response.choices[0]?.message?.content || "";
}

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/csv",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/heic",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Supported: PDF, PNG, JPG, JPEG, HEIC, DOCX, TXT"));
    }
  },
});

v2Router.post(
  "/homes/:homeId/file-analysis",
  fileUpload.array("files", 10),
  async (req: Request, res: Response) => {
    try {
      if (!requireDisclaimer(req, res)) return;
      const actor = getActor(req);
      const userId = getUserId(req);
      const { homeId } = req.params;
      if (!(await verifyHomeOwnership(homeId, userId))) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }

      const extractedFiles: Array<{ text: string; fileName: string; fileType: string }> = [];
      const extractionErrors: string[] = [];

      for (const file of files) {
        try {
          let text: string;
          if (file.mimetype.startsWith("image/")) {
            text = await extractTextFromImage(file.buffer, file.originalname, file.mimetype);
          } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const mammoth = await import("mammoth");
            const result = await mammoth.default.extractRawText({ buffer: file.buffer });
            text = result.value || "";
          } else {
            text = await extractTextFromDocument(file.buffer, file.mimetype);
          }
          if (text.trim()) {
            extractedFiles.push({
              text,
              fileName: file.originalname,
              fileType: file.mimetype,
            });
          }
        } catch (err) {
          extractionErrors.push(`${file.originalname}: ${err instanceof Error ? err.message : "extraction failed"}`);
        }
      }

      if (extractedFiles.length === 0) {
        res.status(400).json({
          error: "Upload Failed. Please try again.",
          details: extractionErrors,
        });
        return;
      }

      const homeRow = await db.execute(sql`
        SELECT legacy_id FROM projection_home WHERE home_id = ${homeId}
      `);
      const legacyHomeId = homeRow.rows.length > 0 ? (homeRow.rows[0] as any).legacy_id : null;

      if (legacyHomeId) {
        const objectService = new ObjectStorageService();
        for (const file of files) {
          try {
            const objectId = crypto.randomUUID();
            const privateDir = objectService.getPrivateObjectDir();
            const key = `${privateDir}/${objectId}`;

            await objectStorageClient.send(new PutObjectCommand({
              Bucket: objectService.getBucket(),
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype || "application/octet-stream",
            }));

            const objectPath = `/objects/${objectId}`;
            await db.insert(homeDocuments).values({
              homeId: legacyHomeId,
              name: file.originalname,
              fileType: file.mimetype || null,
              fileSize: file.size || null,
              objectPath,
              category: "General",
              notes: "Uploaded via Document Analysis",
            });
          } catch (docErr) {
            logErrorV2("v2.fileAnalysis.saveDoc", docErr, { filename: file.originalname });
          }
        }
      }

      const systemsResult = await db.execute(sql`
        SELECT system_id, system_type, attrs FROM projection_system
        WHERE home_id = ${homeId}
      `);
      const existingSystems = systemsResult.rows.map((row: any) => ({
        id: row.system_id,
        category: row.attrs?.category || row.system_type || "Other",
        name: row.attrs?.name || row.attrs?.category || row.system_type || "Other",
        condition: row.attrs?.condition,
        attrs: row.attrs,
      }));

      const tasksResult = await db.execute(sql`
        SELECT task_id, title, system_id, state, estimates FROM projection_task
        WHERE home_id = ${homeId} AND state NOT IN ('done', 'skipped', 'rejected')
      `);
      const existingTasks = tasksResult.rows.map((row: any) => ({
        id: row.task_id,
        title: row.title,
        systemId: row.system_id,
        status: row.state,
        category: row.estimates?.category,
      }));

      const openaiConfig = {
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
      };

      const analysisResult = await runAnalysisPipeline(
        extractedFiles,
        existingSystems,
        existingTasks,
        homeId,
        openaiConfig
      );

      const analysisId = crypto.randomUUID();
      await db.transaction(async (tx) =>
        appendAndApply(tx, {
          aggregateType: "file_analysis",
          aggregateId: analysisId,
          expectedVersion: 0,
          eventType: EventTypes.FileAnalysisCompleted,
          data: {
            homeId,
            sourceFiles: analysisResult.sourceFiles,
            matchedSystemUpdates: analysisResult.matchedSystemUpdates,
            matchedSystemTasks: analysisResult.matchedSystemTasks,
            suggestedSystems: analysisResult.suggestedSystems,
            pendingTasks: analysisResult.suggestedSystems.flatMap((s) => s.pendingTasks),
            pendingAttributes: analysisResult.suggestedSystems.map((s) => ({
              suggestionId: s.id,
              attributes: s.pendingAttributes,
            })),
            analysisWarnings: analysisResult.analysisWarnings,
          },
          meta: {},
          actor,
          idempotencyKey: req.idempotencyKey!,
        })
      );

      if (extractionErrors.length > 0) {
        analysisResult.analysisWarnings.push(
          ...extractionErrors.map((e) => `File extraction warning: ${e}`)
        );
      }

      res.json({
        analysisId,
        ...analysisResult,
      });
    } catch (err) {
      logErrorV2("v2.fileAnalysis", err);
      handleError(res, err);
    }
  }
);

v2Router.get("/homes/:homeId/suggestions", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { homeId } = req.params;
    if (!(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await db.execute(sql`
      SELECT e.aggregate_id, e.data, e.occurred_at
      FROM event_log e
      WHERE e.aggregate_type = 'file_analysis'
        AND (e.data->>'homeId') = ${homeId}
        AND e.event_type = 'FileAnalysisCompleted'
      ORDER BY e.occurred_at DESC
      LIMIT 10
    `);

    const approvedIds = new Set<string>();
    const declinedIds = new Set<string>();

    const decisionResult = await db.execute(sql`
      SELECT e.event_type, e.aggregate_id, e.data
      FROM event_log e
      WHERE e.aggregate_type = 'suggested_system'
        AND e.event_type IN ('SuggestedSystemApproved', 'SuggestedSystemDeclined')
        AND (e.data->>'homeId') = ${homeId}
    `);
    for (const row of decisionResult.rows as any[]) {
      if (row.event_type === "SuggestedSystemApproved") {
        approvedIds.add(row.aggregate_id);
      } else {
        declinedIds.add(row.aggregate_id);
      }
    }

    const suggestions: SuggestedSystem[] = [];
    for (const row of result.rows as any[]) {
      const data = row.data;
      if (data.suggestedSystems) {
        for (const s of data.suggestedSystems) {
          if (!approvedIds.has(s.id) && !declinedIds.has(s.id)) {
            suggestions.push(s);
          }
        }
      }
    }

    res.json(suggestions);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/suggestions/:suggestionId/approve", async (req: Request, res: Response) => {
  try {
    if (!requireDisclaimer(req, res)) return;
    const actor = getActor(req);
    const userId = getUserId(req);
    const { suggestionId } = req.params;
    const { homeId, systemName, systemCategory, pendingTasks, pendingAttributes } = req.body;

    if (!homeId) {
      res.status(400).json({ error: "homeId is required" });
      return;
    }
    if (!(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const systemId = crypto.randomUUID();
    const taskIds: string[] = [];

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: 0,
        eventType: EventTypes.SystemAttributesUpserted,
        data: {
          homeId,
          systemType: systemCategory || systemName,
          attrs: {
            category: systemCategory || systemName,
            name: systemName,
            source: "file-analysis",
            condition: "Unknown",
            ...(pendingAttributes || {}),
          },
        },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-system`,
      });

      if (pendingTasks && Array.isArray(pendingTasks)) {
        for (const task of pendingTasks) {
          const taskId = crypto.randomUUID();
          taskIds.push(taskId);
          await appendAndApply(tx, {
            aggregateType: "task",
            aggregateId: taskId,
            expectedVersion: 0,
            eventType: EventTypes.TaskCreated,
            data: {
              homeId,
              systemId,
              title: task.title,
              estimates: {
                description: task.description,
                urgency: task.urgency || task.priority,
                diyLevel: task.diyLevel,
                category: task.category,
                estimatedCost: task.estimatedCost,
                safetyWarning: task.safetyWarning,
                createdFrom: "file-analysis",
                sourceRef: task.sourceRef,
                isInferred: task.isInferred,
              },
              dueAt: null,
            },
            meta: {},
            actor,
            idempotencyKey: `${req.idempotencyKey!}-task-${task.id || taskId}`,
          });
        }
      }

      await appendAndApply(tx, {
        aggregateType: "suggested_system",
        aggregateId: suggestionId,
        expectedVersion: 0,
        eventType: EventTypes.SuggestedSystemApproved,
        data: {
          homeId,
          systemName,
          systemCategory: systemCategory || systemName,
          createdSystemId: systemId,
          migratedTaskIds: taskIds,
          migratedAttributes: pendingAttributes || {},
        },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-approve`,
      });
    });

    res.json({
      approved: true,
      systemId,
      taskIds,
      suggestionId,
    });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/suggestions/:suggestionId/decline", async (req: Request, res: Response) => {
  try {
    if (!requireDisclaimer(req, res)) return;
    const actor = getActor(req);
    const userId = getUserId(req);
    const { suggestionId } = req.params;
    const { homeId, reason, pendingTaskIds, pendingAttributeKeys } = req.body;

    if (!homeId) {
      res.status(400).json({ error: "homeId is required" });
      return;
    }
    if (!(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "suggested_system",
        aggregateId: suggestionId,
        expectedVersion: 0,
        eventType: EventTypes.SuggestedSystemDeclined,
        data: {
          homeId,
          reason: reason || "User declined",
          deletedTaskIds: pendingTaskIds || [],
          deletedAttributeKeys: pendingAttributeKeys || [],
        },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-decline`,
      });
    });

    res.json({
      declined: true,
      suggestionId,
      deletedTaskIds: pendingTaskIds || [],
      deletedAttributeKeys: pendingAttributeKeys || [],
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Matched system task confirmation (bulk create tasks for matched systems)
// ---------------------------------------------------------------------------
v2Router.post("/homes/:homeId/confirm-matched-tasks", async (req: Request, res: Response) => {
  try {
    if (!requireDisclaimer(req, res)) return;
    const actor = getActor(req);
    const userId = getUserId(req);
    const { homeId } = req.params;
    if (!(await verifyHomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const { tasks, systemUpdates } = req.body;
    const taskIds: string[] = [];

    await db.transaction(async (tx) => {
      if (systemUpdates && Array.isArray(systemUpdates)) {
        for (const update of systemUpdates) {
          if (update.systemId && update.attributes) {
            await appendAndApply(tx, {
              aggregateType: "system",
              aggregateId: update.systemId,
              expectedVersion: await getCurrentVersion(tx, "system", update.systemId),
              eventType: EventTypes.SystemAttributesUpserted,
              data: {
                homeId,
                attrs: update.attributes,
              },
              meta: {},
              actor,
              idempotencyKey: `${req.idempotencyKey!}-sysupdate-${update.systemId}`,
            });
          }
        }
      }

      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          const taskId = crypto.randomUUID();
          taskIds.push(taskId);

          let nsPrefix = "unknown_system";
          if (task.systemId) {
            const sysResult = await tx.execute(
              sql`SELECT system_id, system_type, attrs FROM projection_system WHERE system_id = ${task.systemId} LIMIT 1`
            );
            if (sysResult.rows.length > 0) {
              const row = sysResult.rows[0] as any;
              const category = row.attrs?.category || row.system_type || "other";
              const name = row.attrs?.name || category;
              nsPrefix = generateInstancePrefix(category, name, row.system_id);
            }
          }

          await appendAndApply(tx, {
            aggregateType: "task",
            aggregateId: taskId,
            expectedVersion: 0,
            eventType: EventTypes.TaskCreated,
            data: {
              homeId,
              systemId: task.systemId,
              title: task.title,
              estimates: {
                description: task.description,
                urgency: task.urgency || task.priority,
                diyLevel: task.diyLevel,
                category: task.category,
                estimatedCost: task.estimatedCost,
                safetyWarning: task.safetyWarning,
                createdFrom: "file-analysis",
                sourceRef: task.sourceRef,
                isInferred: task.isInferred,
                namespacePrefix: nsPrefix,
              },
              dueAt: null,
            },
            meta: {},
            actor,
            idempotencyKey: `${req.idempotencyKey!}-task-${task.id || taskId}`,
          });
        }
      }
    });

    res.json({ created: taskIds.length, taskIds });
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — COMPONENT ENDPOINTS
// ===========================================================================

/** Verify user owns a home by V1 homes.id */
async function verifyV1HomeOwnership(homeId: number, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT user_id FROM homes WHERE id = ${homeId}
  `);
  if (result.rows.length === 0) return false;
  return (result.rows[0] as { user_id: string }).user_id === userId;
}

/** Resolve a home ID that might be a UUID (from projection_home) to a legacy integer ID */
async function resolveHomeId(rawId: string): Promise<number> {
  const asNum = Number(rawId);
  if (!isNaN(asNum) && asNum > 0) return asNum;
  // It's a UUID — look up the legacy_id from projection_home
  const result = await db.execute(sql`
    SELECT legacy_id FROM projection_home WHERE home_id = ${rawId}
  `);
  if (result.rows.length > 0 && (result.rows[0] as any).legacy_id) {
    return (result.rows[0] as any).legacy_id;
  }
  return NaN;
}

/** Resolve a system ID that might be a UUID (from projection_system) to a legacy integer ID */
async function resolveSystemId(rawId: string): Promise<number> {
  const asNum = Number(rawId);
  if (!isNaN(asNum) && asNum > 0) return asNum;
  // It's a UUID — look up the legacy ID from projection_system attrs
  const result = await db.execute(sql`
    SELECT (attrs->>'legacyId')::int as legacy_id FROM projection_system WHERE system_id = ${rawId}
  `);
  if (result.rows.length > 0 && (result.rows[0] as any).legacy_id) {
    return (result.rows[0] as any).legacy_id;
  }
  return NaN;
}

/** Verify user owns system by V1 systems.id, returns homeId */
async function verifyV1SystemOwnership(systemId: number, userId: string): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT s.home_id, h.user_id
    FROM systems s
    JOIN homes h ON h.id = s.home_id
    WHERE s.id = ${systemId}
  `);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { home_id: number; user_id: string };
  return row.user_id === userId ? row.home_id : null;
}

// GET /v2/systems/:systemId/components
v2Router.get("/systems/:systemId/components", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const systemId = await resolveSystemId(req.params.systemId);
    if (isNaN(systemId) || !(await verifyV1SystemOwnership(systemId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM components WHERE system_id = ${systemId} ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/systems/:systemId/components
v2Router.post("/systems/:systemId/components", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const systemId = await resolveSystemId(req.params.systemId);
    const homeId = isNaN(systemId) ? null : await verifyV1SystemOwnership(systemId, userId);
    if (!homeId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const componentId = crypto.randomUUID();
    const data = { ...req.body, homeId, systemId };
    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO components (home_id, system_id, name, component_type, material, install_year, condition, notes, photos, provenance_source, provenance_confidence)
        VALUES (${homeId}, ${systemId}, ${data.name}, ${data.componentType ?? null}, ${data.material ?? null}, ${data.installYear ?? null}, ${data.condition || 'Unknown'}, ${data.notes ?? null}, ${data.photos ?? null}, ${data.provenanceSource || 'manual'}, ${data.provenanceConfidence ?? null})
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "component",
        aggregateId: componentId,
        expectedVersion: 0,
        eventType: EventTypes.ComponentCreated,
        data,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return insertResult.rows[0];
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /v2/components/:id
v2Router.put("/components/:id", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const componentId = Number(req.params.id);
    const comp = await db.execute(sql`
      SELECT c.id, c.home_id, h.user_id FROM components c JOIN homes h ON h.id = c.home_id WHERE c.id = ${componentId}
    `);
    if (comp.rows.length === 0 || (comp.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const updateResult = await tx.execute(sql`
        UPDATE components
        SET name = COALESCE(${req.body.name ?? null}, name),
            component_type = COALESCE(${req.body.componentType ?? null}, component_type),
            material = COALESCE(${req.body.material ?? null}, material),
            install_year = COALESCE(${req.body.installYear ?? null}, install_year),
            condition = COALESCE(${req.body.condition ?? null}, condition),
            notes = COALESCE(${req.body.notes ?? null}, notes),
            updated_at = now()
        WHERE id = ${componentId}
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "component",
        aggregateId: String(componentId),
        expectedVersion: 0,
        eventType: EventTypes.ComponentUpdated,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return updateResult.rows[0];
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /v2/components/:id
v2Router.delete("/components/:id", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const componentId = Number(req.params.id);
    const comp = await db.execute(sql`
      SELECT c.id, c.home_id, h.user_id FROM components c JOIN homes h ON h.id = c.home_id WHERE c.id = ${componentId}
    `);
    if (comp.rows.length === 0 || (comp.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM components WHERE id = ${componentId}`);
      await appendAndApply(tx, {
        aggregateType: "component",
        aggregateId: String(componentId),
        expectedVersion: 0,
        eventType: EventTypes.ComponentDeleted,
        data: { reason: "User deleted" },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json({ deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — WARRANTY ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/warranties
v2Router.get("/homes/:homeId/warranties", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM warranties WHERE home_id = ${homeId} ORDER BY expiry_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/homes/:homeId/warranties
v2Router.post("/homes/:homeId/warranties", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const warrantyAggId = crypto.randomUUID();
    const data = { ...req.body, homeId };
    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO warranties (home_id, system_id, component_id, warranty_provider, warranty_type, coverage_summary, start_date, expiry_date, is_transferable, document_id, notes, provenance_source, provenance_confidence)
        VALUES (${homeId}, ${data.systemId ?? null}, ${data.componentId ?? null}, ${data.warrantyProvider ?? null}, ${data.warrantyType ?? null}, ${data.coverageSummary ?? null}, ${data.startDate ?? null}::timestamptz, ${data.expiryDate ?? null}::timestamptz, ${data.isTransferable ?? false}, ${data.documentId ?? null}, ${data.notes ?? null}, ${data.provenanceSource || 'manual'}, ${data.provenanceConfidence ?? null})
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "warranty",
        aggregateId: warrantyAggId,
        expectedVersion: 0,
        eventType: EventTypes.WarrantyCreated,
        data,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return insertResult.rows[0];
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /v2/warranties/:id
v2Router.put("/warranties/:id", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const warrantyId = Number(req.params.id);
    const w = await db.execute(sql`
      SELECT w.id, w.home_id, h.user_id FROM warranties w JOIN homes h ON h.id = w.home_id WHERE w.id = ${warrantyId}
    `);
    if (w.rows.length === 0 || (w.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const updateResult = await tx.execute(sql`
        UPDATE warranties
        SET warranty_provider = COALESCE(${req.body.warrantyProvider ?? null}, warranty_provider),
            warranty_type = COALESCE(${req.body.warrantyType ?? null}, warranty_type),
            coverage_summary = COALESCE(${req.body.coverageSummary ?? null}, coverage_summary),
            start_date = COALESCE(${req.body.startDate ?? null}::timestamptz, start_date),
            expiry_date = COALESCE(${req.body.expiryDate ?? null}::timestamptz, expiry_date),
            is_transferable = COALESCE(${req.body.isTransferable ?? null}, is_transferable),
            notes = COALESCE(${req.body.notes ?? null}, notes),
            updated_at = now()
        WHERE id = ${warrantyId}
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "warranty",
        aggregateId: String(warrantyId),
        expectedVersion: 0,
        eventType: EventTypes.WarrantyUpdated,
        data: req.body,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return updateResult.rows[0];
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /v2/warranties/:id
v2Router.delete("/warranties/:id", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const warrantyId = Number(req.params.id);
    const w = await db.execute(sql`
      SELECT w.id, w.home_id, h.user_id FROM warranties w JOIN homes h ON h.id = w.home_id WHERE w.id = ${warrantyId}
    `);
    if (w.rows.length === 0 || (w.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM warranties WHERE id = ${warrantyId}`);
      await appendAndApply(tx, {
        aggregateType: "warranty",
        aggregateId: String(warrantyId),
        expectedVersion: 0,
        eventType: EventTypes.WarrantyDeleted,
        data: { reason: "User deleted" },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
    });
    res.json({ deleted: true });
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — PERMIT ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/permits
v2Router.get("/homes/:homeId/permits", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM permits WHERE home_id = ${homeId} ORDER BY issued_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/homes/:homeId/permits
v2Router.post("/homes/:homeId/permits", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const permitAggId = crypto.randomUUID();
    const data = { ...req.body, homeId };
    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO permits (home_id, system_id, permit_number, permit_type, issued_date, status, issuing_authority, description, document_id, provenance_source, provenance_confidence)
        VALUES (${homeId}, ${data.systemId ?? null}, ${data.permitNumber ?? null}, ${data.permitType ?? null}, ${data.issuedDate ?? null}::timestamptz, ${data.status || 'unknown'}, ${data.issuingAuthority ?? null}, ${data.description ?? null}, ${data.documentId ?? null}, ${data.provenanceSource || 'manual'}, ${data.provenanceConfidence ?? null})
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: permitAggId,
        expectedVersion: 0,
        eventType: EventTypes.PermitCreated,
        data,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return insertResult.rows[0];
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — REPAIR ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/repairs
v2Router.get("/homes/:homeId/repairs", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM repairs WHERE home_id = ${homeId} ORDER BY repair_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/homes/:homeId/repairs
v2Router.post("/homes/:homeId/repairs", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!req.body.title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const repairAggId = crypto.randomUUID();
    const data = { ...req.body, homeId };
    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO repairs (home_id, system_id, component_id, task_id, contractor_id, title, description, repair_date, cost, parts_used, outcome, provenance_source, provenance_confidence)
        VALUES (${homeId}, ${data.systemId ?? null}, ${data.componentId ?? null}, ${data.taskId ?? null}, ${data.contractorId ?? null}, ${data.title}, ${data.description ?? null}, ${data.repairDate ?? null}::timestamptz, ${data.cost ?? null}, ${data.partsUsed ?? null}, ${data.outcome || 'resolved'}, ${data.provenanceSource || 'manual'}, ${data.provenanceConfidence ?? null})
        RETURNING *
      `);
      const repairId = (insertResult.rows[0] as any).id;
      // Also create timeline event
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
        VALUES (${homeId}, COALESCE(${data.repairDate ?? null}::timestamptz, now()), 'repair', ${data.title}, ${data.description ?? null}, 'wrench', 'repair', ${repairId}, ${data.cost ?? null}, ${data.provenanceSource || 'manual'})
      `);
      await appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: repairAggId,
        expectedVersion: 0,
        eventType: EventTypes.RepairRecorded,
        data,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return insertResult.rows[0];
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — REPLACEMENT ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/replacements
v2Router.get("/homes/:homeId/replacements", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM replacements WHERE home_id = ${homeId} ORDER BY replacement_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/homes/:homeId/replacements
v2Router.post("/homes/:homeId/replacements", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const replacementAggId = crypto.randomUUID();
    const data = { ...req.body, homeId };
    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO replacements (home_id, system_id, component_id, replaced_system_name, replaced_make, replaced_model, replacement_date, cost, contractor_id, reason, document_id, provenance_source, provenance_confidence)
        VALUES (${homeId}, ${data.systemId ?? null}, ${data.componentId ?? null}, ${data.replacedSystemName ?? null}, ${data.replacedMake ?? null}, ${data.replacedModel ?? null}, ${data.replacementDate ?? null}::timestamptz, ${data.cost ?? null}, ${data.contractorId ?? null}, ${data.reason ?? null}, ${data.documentId ?? null}, ${data.provenanceSource || 'manual'}, ${data.provenanceConfidence ?? null})
        RETURNING *
      `);
      const replacementId = (insertResult.rows[0] as any).id;
      // Also create timeline event
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
        VALUES (${homeId}, COALESCE(${data.replacementDate ?? null}::timestamptz, now()), 'replacement', ${data.replacedSystemName || 'System replacement'}, ${data.reason ?? null}, 'refresh-cw', 'replacement', ${replacementId}, ${data.cost ?? null}, ${data.provenanceSource || 'manual'})
      `);
      await appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: replacementAggId,
        expectedVersion: 0,
        eventType: EventTypes.ReplacementRecorded,
        data,
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return insertResult.rows[0];
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — RECOMMENDATION ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/recommendations
v2Router.get("/homes/:homeId/recommendations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const statusFilter = req.query.status as string | undefined;
    let query;
    if (statusFilter) {
      query = sql`SELECT * FROM recommendations WHERE home_id = ${homeId} AND status = ${statusFilter} ORDER BY created_at DESC`;
    } else {
      query = sql`SELECT * FROM recommendations WHERE home_id = ${homeId} ORDER BY created_at DESC`;
    }
    const result = await db.execute(query);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/recommendations/:id/accept
v2Router.post("/recommendations/:id/accept", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const recId = Number(req.params.id);
    const rec = await db.execute(sql`
      SELECT r.id, r.home_id, r.status, h.user_id FROM recommendations r JOIN homes h ON h.id = r.home_id WHERE r.id = ${recId}
    `);
    if (rec.rows.length === 0 || (rec.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const currentStatus = (rec.rows[0] as any).status;
    if (currentStatus !== "open") {
      res.status(409).json({ error: `Cannot accept recommendation in '${currentStatus}' status` });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const updateResult = await tx.execute(sql`
        UPDATE recommendations SET status = 'accepted', task_id = ${req.body.taskId ?? null}, updated_at = now()
        WHERE id = ${recId}
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "recommendation",
        aggregateId: String(recId),
        expectedVersion: 0,
        eventType: EventTypes.RecommendationAccepted,
        data: { taskId: req.body.taskId ?? null },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return updateResult.rows[0];
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /v2/recommendations/:id/dismiss
v2Router.post("/recommendations/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const userId = getUserId(req);
    const recId = Number(req.params.id);
    const rec = await db.execute(sql`
      SELECT r.id, r.home_id, r.status, h.user_id FROM recommendations r JOIN homes h ON h.id = r.home_id WHERE r.id = ${recId}
    `);
    if (rec.rows.length === 0 || (rec.rows[0] as any).user_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const currentStatus = (rec.rows[0] as any).status;
    if (currentStatus !== "open") {
      res.status(409).json({ error: `Cannot dismiss recommendation in '${currentStatus}' status` });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const updateResult = await tx.execute(sql`
        UPDATE recommendations SET status = 'dismissed', updated_at = now()
        WHERE id = ${recId}
        RETURNING *
      `);
      await appendAndApply(tx, {
        aggregateType: "recommendation",
        aggregateId: String(recId),
        expectedVersion: 0,
        eventType: EventTypes.RecommendationDismissed,
        data: { reason: req.body.reason ?? null },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      });
      return updateResult.rows[0];
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===========================================================================
// HOME GRAPH — TIMELINE ENDPOINTS
// ===========================================================================

// GET /v2/homes/:homeId/timeline
v2Router.get("/homes/:homeId/timeline", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (!(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const category = req.query.category as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const offset = (page - 1) * limit;

    let query;
    if (category) {
      query = sql`
        SELECT * FROM timeline_events
        WHERE home_id = ${homeId} AND category = ${category}
        ORDER BY event_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT * FROM timeline_events
        WHERE home_id = ${homeId}
        ORDER BY event_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    const result = await db.execute(query);

    // Get total count for pagination
    let countQuery;
    if (category) {
      countQuery = sql`SELECT COUNT(*) as total FROM timeline_events WHERE home_id = ${homeId} AND category = ${category}`;
    } else {
      countQuery = sql`SELECT COUNT(*) as total FROM timeline_events WHERE home_id = ${homeId}`;
    }
    const countResult = await db.execute(countQuery);
    const total = Number((countResult.rows[0] as any).total);

    res.json({
      events: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Intelligence API (read-only, computed on-the-fly)
// ---------------------------------------------------------------------------

v2Router.get("/homes/:homeId/intelligence", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { computeHomeIntelligence } = await import("./services/intelligence-engine");
    const result = await computeHomeIntelligence(homeId);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.get("/systems/:systemId/insight", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const systemId = await resolveSystemId(req.params.systemId);
    if (isNaN(systemId)) {
      res.status(404).json({ error: "System not found" });
      return;
    }
    const homeId = await verifyV1SystemOwnership(systemId, userId);
    if (!homeId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { computeSystemInsightDetail } = await import("./services/intelligence-engine");
    const result = await computeSystemInsightDetail(systemId, homeId);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Outcome Learning API
// ---------------------------------------------------------------------------

// Record a user action (completed task, hired contractor, etc.)
v2Router.post("/homes/:homeId/actions", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { systemId, relatedRecommendationId, relatedTaskId, actionType, costActual, contractorId, notes } = req.body;
    const result = await db.execute(sql`
      INSERT INTO user_actions (home_id, system_id, related_recommendation_id, related_task_id, action_type, cost_actual, contractor_id, notes)
      VALUES (${homeId}, ${systemId || null}, ${relatedRecommendationId || null}, ${relatedTaskId || null}, ${actionType}, ${costActual || null}, ${contractorId || null}, ${notes || null})
      RETURNING *
    `);
    // Also create a timeline event
    const action = result.rows[0] as any;
    await db.execute(sql`
      INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
      VALUES (${homeId}, now(), 'maintenance', ${`Action: ${actionType.replace(/_/g, " ")}`}, ${notes || null}, 'check-circle', 'action', ${action.id}, ${costActual || null}, 'manual')
    `);
    res.json(action);
  } catch (err) {
    handleError(res, err);
  }
});

// Record an outcome (failure, avoided issue, etc.)
v2Router.post("/homes/:homeId/outcomes", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { systemId, relatedActionId, outcomeType, severity, costImpact, description } = req.body;
    const result = await db.execute(sql`
      INSERT INTO outcome_events (home_id, system_id, related_action_id, outcome_type, severity, cost_impact, description)
      VALUES (${homeId}, ${systemId || null}, ${relatedActionId || null}, ${outcomeType}, ${severity || 'low'}, ${costImpact || null}, ${description || null})
      RETURNING *
    `);
    // Timeline event
    const outcome = result.rows[0] as any;
    const iconMap: Record<string, string> = { failure: "alert-triangle", avoided_issue: "shield-check", degraded: "trending-down", improved: "trending-up", no_change: "minus", unknown: "help-circle" };
    await db.execute(sql`
      INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
      VALUES (${homeId}, now(), ${outcomeType === 'failure' ? 'repair' : 'maintenance'}, ${`Outcome: ${outcomeType.replace(/_/g, " ")}`}, ${description || null}, ${iconMap[outcomeType] || 'circle'}, 'outcome', ${outcome.id}, ${costImpact || null}, 'manual')
    `);
    res.json(outcome);
  } catch (err) {
    handleError(res, err);
  }
});

// Get actions for a home
v2Router.get("/homes/:homeId/actions", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM user_actions WHERE home_id = ${homeId} ORDER BY action_date DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// Get outcomes for a home
v2Router.get("/homes/:homeId/outcomes", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const result = await db.execute(sql`
      SELECT * FROM outcome_events WHERE home_id = ${homeId} ORDER BY occurred_at DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err);
  }
});

// Get learning summary
v2Router.get("/homes/:homeId/learning-summary", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const homeId = await resolveHomeId(req.params.homeId);
    if (isNaN(homeId) || !(await verifyV1HomeOwnership(homeId, userId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { computeLearningSummary } = await import("./services/learning-engine");
    const summary = await computeLearningSummary(homeId);
    res.json(summary);
  } catch (err) {
    handleError(res, err);
  }
});

function handleError(res: Response, err: unknown): void {
  if (err instanceof TransitionError) {
    res.status(409).json({
      error: "This action conflicts with the current state. Please refresh and try again.",
    });
    return;
  }
  const error = err as Error & { status?: number; code?: string };
  // Log full details server-side, but never expose DB codes or stack traces to client
  logErrorV2("v2.handleError", error, { dbCode: error.code });
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
