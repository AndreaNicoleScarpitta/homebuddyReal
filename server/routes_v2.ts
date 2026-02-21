/**
 * V2 Routes — Event-sourced endpoints for Home Buddy.
 *
 * These routes coexist with the original CRUD routes in server/routes.ts.
 * All mutation endpoints enforce Idempotency-Key and use the transactional
 * command pipeline (append event + apply projection atomically).
 */

import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { append, readStream, readFromSeq, getCurrentVersion } from "./eventing/eventStore";
import { requireIdempotencyKey } from "./eventing/idempotency";
import { applyEvent } from "./projections/applyEvent";
import { EventTypes, type Actor } from "./eventing/types";
import { validateTransition, TransitionError } from "./domain/stateMachine";

export const v2Router = Router();

v2Router.use(requireIdempotencyKey);

// ---------------------------------------------------------------------------
// Helper: build actor from session or default to system
// ---------------------------------------------------------------------------
function getActor(req: Request): Actor {
  const user = req.user as { id?: number } | undefined;
  if (user?.id) {
    return { actorType: "user", actorId: String(user.id) };
  }
  return { actorType: "system", actorId: "anonymous" };
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

// ===========================================================================
// EVENT LOG ENDPOINTS (read-only)
// ===========================================================================

v2Router.get("/events", async (req: Request, res: Response) => {
  try {
    const fromSeq = Number(req.query.fromSeq ?? 0);
    const limit = Math.min(Number(req.query.limit ?? 100), 1000);
    const events = await db.transaction(async (tx) => readFromSeq(tx, fromSeq, limit));
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

v2Router.get("/events/stream/:aggregateType/:aggregateId", async (req: Request, res: Response) => {
  try {
    const events = await db.transaction(async (tx) =>
      readStream(tx, req.params.aggregateType, req.params.aggregateId),
    );
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===========================================================================
// HOME ENDPOINTS
// ===========================================================================

v2Router.post("/homes", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const homeId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: homeId,
        expectedVersion: 0,
        eventType: EventTypes.HomeAttributesUpdated,
        data: { attrs: req.body },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ homeId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/homes/:homeId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { homeId } = req.params;
    const expectedVersion = Number(req.body.expectedVersion ?? 0);
    const result = await db.transaction(async (tx) => {
      const ver = expectedVersion || await getCurrentVersion(tx, "home", homeId);
      return appendAndApply(tx, {
        aggregateType: "home",
        aggregateId: homeId,
        expectedVersion: ver,
        eventType: EventTypes.HomeAttributesUpdated,
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

// ===========================================================================
// SYSTEM ENDPOINTS
// ===========================================================================

v2Router.post("/homes/:homeId/systems", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const systemId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "system",
        aggregateId: systemId,
        expectedVersion: 0,
        eventType: EventTypes.SystemAttributesUpserted,
        data: { homeId: req.params.homeId, systemType: req.body.systemType, attrs: req.body.attrs ?? req.body },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ systemId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.patch("/systems/:systemId", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { systemId } = req.params;
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

v2Router.post("/systems/:systemId/override-health", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { systemId } = req.params;
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
// REPORT ENDPOINTS
// ===========================================================================

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
    res.status(201).json({ reportId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/reports/:reportId/queue-analysis", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { reportId } = req.params;
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
    const { reportId } = req.params;
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

// ===========================================================================
// FINDING ENDPOINTS
// ===========================================================================

v2Router.post("/findings/:findingId/ignore", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { findingId } = req.params;
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
    const { findingId } = req.params;
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
    const { findingId } = req.params;
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
// TASK ENDPOINTS
// ===========================================================================

v2Router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
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
    res.status(201).json({ taskId, ...result });
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
      const { taskId } = req.params;
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
// NOTIFICATION ENDPOINTS
// ===========================================================================

v2Router.put("/notifications/preferences", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const homeId = req.body.homeId;
    if (!homeId) {
      res.status(400).json({ error: "homeId is required" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "notification_pref", homeId);
      return appendAndApply(tx, {
        aggregateType: "notification_pref",
        aggregateId: homeId,
        expectedVersion: ver,
        eventType: EventTypes.NotificationPreferenceSet,
        data: { prefs: req.body.prefs ?? {} },
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
// CHAT ENDPOINTS
// ===========================================================================

v2Router.post("/chat/sessions", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const sessionId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "chat_session",
        aggregateId: sessionId,
        expectedVersion: 0,
        eventType: EventTypes.ChatSessionCreated,
        data: { homeId: req.body.homeId },
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
    const { sessionId } = req.params;
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
    const { sessionId } = req.params;
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
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===========================================================================
// ASSISTANT ACTION ENDPOINTS
// ===========================================================================

v2Router.post("/assistant/actions/propose", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const actionId = crypto.randomUUID();
    const result = await db.transaction(async (tx) =>
      appendAndApply(tx, {
        aggregateType: "assistant_action",
        aggregateId: actionId,
        expectedVersion: 0,
        eventType: EventTypes.AssistantActionProposed,
        data: {
          homeId: req.body.homeId,
          proposedCommands: req.body.proposedCommands ?? [],
          confidence: req.body.confidence,
          rationale: req.body.rationale,
        },
        meta: {},
        actor,
        idempotencyKey: req.idempotencyKey!,
      }),
    );
    res.status(201).json({ assistantActionId: actionId, ...result });
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/assistant/actions/:assistantActionId/approve", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { assistantActionId } = req.params;

    const result = await db.transaction(async (tx) => {
      // Fetch proposed_commands before the guard validates + transitions state
      const row = await tx.execute(sql`
        SELECT proposed_commands
        FROM projection_assistant_action
        WHERE assistant_action_id = ${assistantActionId}
      `);
      if (row.rows.length === 0) {
        throw Object.assign(new Error("Assistant action not found"), { status: 404 });
      }
      const action = row.rows[0] as { proposed_commands: unknown[] };

      const ver = await getCurrentVersion(tx, "assistant_action", assistantActionId);

      // 1) Guarded approve — validates state='proposed' via state machine
      const approveResult = await guardedAppendAndApply(tx, {
        aggregateType: "assistant_action",
        aggregateId: assistantActionId,
        expectedVersion: ver,
        eventType: EventTypes.AssistantActionApproved,
        data: { approvedBy: actor.actorId },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-approve`,
      });

      // 2) Execute proposed commands (emit domain events for each)
      const effects: Array<Record<string, unknown>> = [];
      const eventIds: string[] = [];
      const commands = action.proposed_commands as Array<Record<string, unknown>>;

      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const cmdResult = await appendAndApply(tx, {
          aggregateType: (cmd.aggregateType as string) ?? "task",
          aggregateId: (cmd.aggregateId as string) ?? crypto.randomUUID(),
          expectedVersion: (cmd.expectedVersion as number) ?? 0,
          eventType: (cmd.eventType as string) ?? EventTypes.TaskCreated,
          data: cmd.data ?? {},
          meta: { fromAssistantAction: assistantActionId },
          actor: { actorType: "assistant", actorId: "assistant" },
          idempotencyKey: `${req.idempotencyKey!}-cmd-${i}`,
          correlationId: approveResult.eventId,
        });
        effects.push({ command: cmd, result: cmdResult });
        eventIds.push(cmdResult.eventId);
      }

      // 3) Append AssistantActionExecuted
      await appendAndApply(tx, {
        aggregateType: "assistant_action",
        aggregateId: assistantActionId,
        expectedVersion: approveResult.version,
        eventType: EventTypes.AssistantActionExecuted,
        data: { effects, eventIds },
        meta: {},
        actor,
        idempotencyKey: `${req.idempotencyKey!}-execute`,
      });

      return { assistantActionId, effects, eventIds };
    });

    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

v2Router.post("/assistant/actions/:assistantActionId/reject", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const { assistantActionId } = req.params;

    const result = await db.transaction(async (tx) => {
      const row = await tx.execute(sql`
        SELECT assistant_action_id FROM projection_assistant_action
        WHERE assistant_action_id = ${assistantActionId}
      `);
      if (row.rows.length === 0) {
        throw Object.assign(new Error("Assistant action not found"), { status: 404 });
      }

      const ver = await getCurrentVersion(tx, "assistant_action", assistantActionId);
      return guardedAppendAndApply(tx, {
        aggregateType: "assistant_action",
        aggregateId: assistantActionId,
        expectedVersion: ver,
        eventType: EventTypes.AssistantActionRejected,
        data: { reason: req.body.reason },
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
    default:
      return null;
  }
  if (result.rows.length === 0) return null;
  return (result.rows[0] as { state: string }).state;
}

/**
 * Guard wrapper: fetch current state, validate transition, then append+apply.
 * For creation events (no existing aggregate), currentState will be null.
 */
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
      aggregateId: err.aggregateId,
    });
    return;
  }
  const error = err as Error & { status?: number; code?: string };
  if (error.code === "23505") {
    res.status(409).json({ error: "Conflict: optimistic concurrency violation", details: error.message });
    return;
  }
  const status = error.status ?? 500;
  res.status(status).json({ error: error.message });
}
