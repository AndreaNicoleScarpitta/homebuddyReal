/**
 * Milestone 3 — State Machine Guards Tests
 *
 * Validates that:
 *   1. Valid state transitions succeed end-to-end via the event store
 *   2. Invalid transitions are rejected with TransitionError (409)
 *   3. Terminal states block further transitions
 *   4. Creation events work on new aggregates
 *   5. Edge cases: double-complete, approve-after-reject, publish-before-draft
 */

import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../server/db";
import { append, getCurrentVersion } from "../../server/eventing/eventStore";
import { applyEvent } from "../../server/projections/applyEvent";
import { EventTypes } from "../../server/eventing/types";
import {
  validateTransition,
  TransitionError,
  getAllowedTransitions,
} from "../../server/domain/stateMachine";

const runId = Math.random().toString(36).slice(2, 8);
const actor = { actorType: "user" as const, actorId: `test-user-sm-${runId}` };

function idemKey(n: number): string {
  return `sm-${runId}-${n}`;
}

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

async function getProjectionState(
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


describe("State Machine Guards — Unit Tests", () => {
  it("validateTransition allows valid Task lifecycle: proposed → approved → scheduled → started → done", () => {
    expect(() => validateTransition("task", "t1", "proposed", EventTypes.TaskApproved)).not.toThrow();
    expect(() => validateTransition("task", "t1", "approved", EventTypes.TaskScheduled)).not.toThrow();
    expect(() => validateTransition("task", "t1", "scheduled", EventTypes.TaskStarted)).not.toThrow();
    expect(() => validateTransition("task", "t1", "in_progress", EventTypes.TaskCompleted)).not.toThrow();
  });

  it("validateTransition rejects invalid Task transitions", () => {
    expect(() => validateTransition("task", "t1", "proposed", EventTypes.TaskCompleted)).toThrow(TransitionError);
    expect(() => validateTransition("task", "t1", "done", EventTypes.TaskApproved)).toThrow(TransitionError);
    expect(() => validateTransition("task", "t1", "rejected", EventTypes.TaskStarted)).toThrow(TransitionError);
  });

  it("validateTransition allows skip from any active state", () => {
    expect(() => validateTransition("task", "t1", "proposed", EventTypes.TaskSkipped)).not.toThrow();
    expect(() => validateTransition("task", "t1", "approved", EventTypes.TaskSkipped)).not.toThrow();
    expect(() => validateTransition("task", "t1", "scheduled", EventTypes.TaskSkipped)).not.toThrow();
    expect(() => validateTransition("task", "t1", "in_progress", EventTypes.TaskSkipped)).not.toThrow();
  });

  it("validateTransition allows Report lifecycle: uploaded → queued → draft_ready → published", () => {
    expect(() => validateTransition("inspection_report", "r1", "uploaded", EventTypes.InspectionReportAnalysisQueued)).not.toThrow();
    expect(() => validateTransition("inspection_report", "r1", "queued", EventTypes.InspectionReportAnalyzedDraft)).not.toThrow();
    expect(() => validateTransition("inspection_report", "r1", "draft_ready", EventTypes.InspectionReportPublished)).not.toThrow();
  });

  it("validateTransition rejects publish before draft", () => {
    expect(() => validateTransition("inspection_report", "r1", "uploaded", EventTypes.InspectionReportPublished)).toThrow(TransitionError);
    expect(() => validateTransition("inspection_report", "r1", "queued", EventTypes.InspectionReportPublished)).toThrow(TransitionError);
  });

  it("validateTransition allows retry after failure", () => {
    expect(() => validateTransition("inspection_report", "r1", "failed", EventTypes.InspectionReportAnalysisQueued)).not.toThrow();
  });

  it("validateTransition allows Finding from draft only", () => {
    expect(() => validateTransition("finding", "f1", "draft", EventTypes.FindingIgnored)).not.toThrow();
    expect(() => validateTransition("finding", "f1", "draft", EventTypes.FindingDeleted)).not.toThrow();
    expect(() => validateTransition("finding", "f1", "draft", EventTypes.FindingTaskCreated)).not.toThrow();
    expect(() => validateTransition("finding", "f1", "ignored", EventTypes.FindingDeleted)).toThrow(TransitionError);
    expect(() => validateTransition("finding", "f1", "task_created", EventTypes.FindingIgnored)).toThrow(TransitionError);
  });

  it("validateTransition passes through stateless aggregates (home, system, chat)", () => {
    expect(() => validateTransition("home", "h1", null, EventTypes.HomeAttributesUpdated)).not.toThrow();
    expect(() => validateTransition("system", "s1", null, EventTypes.SystemAttributesUpserted)).not.toThrow();
    expect(() => validateTransition("chat_session", "c1", null, EventTypes.ChatSessionCreated)).not.toThrow();
  });

  it("validateTransition rejects creation events on wrong aggregate type", () => {
    expect(() => validateTransition("task", "t1", null, EventTypes.TaskApproved)).toThrow(TransitionError);
  });

  it("getAllowedTransitions returns correct set for task in proposed state", () => {
    const allowed = getAllowedTransitions("task", "proposed");
    expect(allowed).toContain(EventTypes.TaskApproved);
    expect(allowed).toContain(EventTypes.TaskRejected);
    expect(allowed).toContain(EventTypes.TaskSkipped);
    expect(allowed).not.toContain(EventTypes.TaskCompleted);
  });
});

describe("State Machine Guards — DB Integration Tests", () => {
  it("Task full lifecycle via event store: create → approve → start → complete", async () => {
    const taskId = crypto.randomUUID();
    let key = 1;

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: { homeId: "h1", title: "Test task" },
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    let state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("proposed");

    await db.transaction(async (tx) => {
      const currentState = await getProjectionState(tx, "task", taskId);
      validateTransition("task", taskId, currentState, EventTypes.TaskApproved);
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskApproved,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("approved");

    await db.transaction(async (tx) => {
      const currentState = await getProjectionState(tx, "task", taskId);
      validateTransition("task", taskId, currentState, EventTypes.TaskStarted);
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskStarted,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("in_progress");

    await db.transaction(async (tx) => {
      const currentState = await getProjectionState(tx, "task", taskId);
      validateTransition("task", taskId, currentState, EventTypes.TaskCompleted);
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskCompleted,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("done");
  });

  it("rejects double-complete on a task already done", async () => {
    const taskId = crypto.randomUUID();
    let key = 100;

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: { homeId: "h1", title: "Double complete test" },
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskApproved,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskStarted,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskCompleted,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    const state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("done");

    expect(() =>
      validateTransition("task", taskId, "done", EventTypes.TaskCompleted),
    ).toThrow(TransitionError);
  });

  it("rejects approve on a rejected task", async () => {
    const taskId = crypto.randomUUID();
    let key = 200;

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: 0,
        eventType: EventTypes.TaskCreated,
        data: { homeId: "h1", title: "Reject test" },
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    await db.transaction(async (tx) => {
      const ver = await getCurrentVersion(tx, "task", taskId);
      await appendAndApply(tx, {
        aggregateType: "task",
        aggregateId: taskId,
        expectedVersion: ver,
        eventType: EventTypes.TaskRejected,
        data: {},
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    const state = await db.transaction(async (tx) => getProjectionState(tx, "task", taskId));
    expect(state).toBe("rejected");

    expect(() =>
      validateTransition("task", taskId, "rejected", EventTypes.TaskApproved),
    ).toThrow(TransitionError);
  });

  it("Report lifecycle guards: cannot publish from uploaded state", async () => {
    const reportId = crypto.randomUUID();
    let key = 300;

    await db.transaction(async (tx) => {
      await appendAndApply(tx, {
        aggregateType: "inspection_report",
        aggregateId: reportId,
        expectedVersion: 0,
        eventType: EventTypes.InspectionReportUploaded,
        data: { homeId: "h1" },
        meta: {},
        actor,
        idempotencyKey: idemKey(key++),
      });
    });

    const state = await db.transaction(async (tx) => getProjectionState(tx, "inspection_report", reportId));
    expect(state).toBe("uploaded");

    expect(() =>
      validateTransition("inspection_report", reportId, "uploaded", EventTypes.InspectionReportPublished),
    ).toThrow(TransitionError);
  });

  it("Finding guards: cannot ignore an already-deleted finding", async () => {
    expect(() =>
      validateTransition("finding", "f1", "deleted", EventTypes.FindingIgnored),
    ).toThrow(TransitionError);
  });

  it("TransitionError has correct properties", () => {
    try {
      validateTransition("task", "test-id", "done", EventTypes.TaskCompleted);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TransitionError);
      const te = err as TransitionError;
      expect(te.status).toBe(409);
      expect(te.currentState).toBe("done");
      expect(te.eventType).toBe(EventTypes.TaskCompleted);
      expect(te.aggregateType).toBe("task");
      expect(te.aggregateId).toBe("test-id");
    }
  });
});
