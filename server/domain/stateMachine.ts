/**
 * State Machine Guards — Milestone 3
 *
 * Defines valid state transitions for each aggregate type and provides
 * a validateTransition() function that v2 mutation endpoints call before
 * appending an event.  Invalid transitions are rejected with a 409 Conflict
 * containing a descriptive error message.
 *
 * Aggregates covered:
 *   - Task:             proposed → approved/rejected/skipped, approved → scheduled/started/skipped,
 *                        scheduled → started/skipped, in_progress → done/skipped, approved/scheduled → overdue
 *   - InspectionReport: uploaded → queued, queued → draft_ready/failed, draft_ready → needs_review/published,
 *                        needs_review → published/failed, failed → queued (retry)
 *   - Finding:          draft → ignored/deleted/task_created
 *   - AssistantAction:  proposed → approved/rejected, approved → executed
 *   - System:           any → override_applied (via SystemStatusOverridden), override_applied → cleared
 *
 * Home, Chat, and Notification aggregates are additive (no lifecycle states)
 * and do not require transition guards.
 */

import { EventTypes, type EventType } from "../eventing/types";

// ---------------------------------------------------------------------------
// Aggregate states
// ---------------------------------------------------------------------------

export const TaskStates = [
  "proposed", "approved", "rejected", "scheduled",
  "in_progress", "done", "skipped", "overdue",
] as const;
export type TaskState = (typeof TaskStates)[number];

export const ReportStates = [
  "uploaded", "queued", "draft_ready", "needs_review",
  "published", "failed",
] as const;
export type ReportState = (typeof ReportStates)[number];

export const FindingStates = [
  "draft", "ignored", "deleted", "task_created",
] as const;
export type FindingState = (typeof FindingStates)[number];

export const AssistantActionStates = [
  "proposed", "approved", "executed", "rejected",
] as const;
export type AssistantActionState = (typeof AssistantActionStates)[number];

// ---------------------------------------------------------------------------
// Transition maps — source state → set of allowed event types
// ---------------------------------------------------------------------------

const taskTransitions: Record<string, Set<string>> = {
  proposed: new Set([
    EventTypes.TaskApproved,
    EventTypes.TaskRejected,
    EventTypes.TaskSkipped,
  ]),
  approved: new Set([
    EventTypes.TaskScheduled,
    EventTypes.TaskStarted,
    EventTypes.TaskSkipped,
    EventTypes.TaskOverdueMarked,
  ]),
  scheduled: new Set([
    EventTypes.TaskStarted,
    EventTypes.TaskSkipped,
    EventTypes.TaskOverdueMarked,
  ]),
  in_progress: new Set([
    EventTypes.TaskCompleted,
    EventTypes.TaskSkipped,
  ]),
  overdue: new Set([
    EventTypes.TaskStarted,
    EventTypes.TaskCompleted,
    EventTypes.TaskSkipped,
  ]),
};

const reportTransitions: Record<string, Set<string>> = {
  uploaded: new Set([
    EventTypes.InspectionReportAnalysisQueued,
  ]),
  queued: new Set([
    EventTypes.InspectionReportAnalyzedDraft,
    EventTypes.InspectionReportAnalysisFailed,
  ]),
  draft_ready: new Set([
    EventTypes.InspectionReportNeedsReview,
    EventTypes.InspectionReportPublished,
  ]),
  needs_review: new Set([
    EventTypes.InspectionReportPublished,
    EventTypes.InspectionReportAnalysisFailed,
  ]),
  failed: new Set([
    EventTypes.InspectionReportAnalysisQueued,
  ]),
};

const findingTransitions: Record<string, Set<string>> = {
  draft: new Set([
    EventTypes.FindingIgnored,
    EventTypes.FindingDeleted,
    EventTypes.FindingTaskCreated,
  ]),
};

const assistantActionTransitions: Record<string, Set<string>> = {
  proposed: new Set([
    EventTypes.AssistantActionApproved,
    EventTypes.AssistantActionRejected,
  ]),
  approved: new Set([
    EventTypes.AssistantActionExecuted,
  ]),
};

// ---------------------------------------------------------------------------
// Aggregate type → transition map registry
// ---------------------------------------------------------------------------

const transitionRegistry: Record<string, Record<string, Set<string>>> = {
  task: taskTransitions,
  inspection_report: reportTransitions,
  finding: findingTransitions,
  assistant_action: assistantActionTransitions,
};

// Event types that create new aggregates (version 0 → 1) and bypass guards
const creationEvents = new Set<string>([
  EventTypes.TaskCreated,
  EventTypes.InspectionReportUploaded,
  EventTypes.AssistantActionProposed,
]);

// Aggregates without lifecycle state machines (additive only)
const statelessAggregates = new Set<string>([
  "home",
  "system",
  "chat_session",
  "notification_pref",
]);

// ---------------------------------------------------------------------------
// TransitionError — thrown when a guard rejects an invalid transition
// ---------------------------------------------------------------------------

export class TransitionError extends Error {
  public readonly status = 409;
  public readonly currentState: string;
  public readonly eventType: string;
  public readonly aggregateType: string;
  public readonly aggregateId: string;

  constructor(
    aggregateType: string,
    aggregateId: string,
    currentState: string,
    eventType: string,
  ) {
    const msg =
      `Invalid state transition: cannot apply '${eventType}' to ` +
      `${aggregateType}/${aggregateId} in state '${currentState}'`;
    super(msg);
    this.name = "TransitionError";
    this.aggregateType = aggregateType;
    this.aggregateId = aggregateId;
    this.currentState = currentState;
    this.eventType = eventType;
  }
}

// ---------------------------------------------------------------------------
// validateTransition — the main guard function
// ---------------------------------------------------------------------------

/**
 * Validates that the given event type is allowed for the aggregate's current
 * state.  Returns normally if the transition is valid; throws TransitionError
 * if the transition is not permitted.
 *
 * @param aggregateType  The aggregate type (e.g. "task", "inspection_report")
 * @param aggregateId    The aggregate instance ID
 * @param currentState   The aggregate's current state from the projection (null for new)
 * @param eventType      The event type being appended
 */
export function validateTransition(
  aggregateType: string,
  aggregateId: string,
  currentState: string | null,
  eventType: EventType | string,
): void {
  if (statelessAggregates.has(aggregateType)) {
    return;
  }

  if (currentState === null && creationEvents.has(eventType)) {
    return;
  }

  if (currentState === null) {
    throw new TransitionError(
      aggregateType,
      aggregateId,
      "(none)",
      eventType,
    );
  }

  const transitions = transitionRegistry[aggregateType];
  if (!transitions) {
    return;
  }

  const allowed = transitions[currentState];
  if (!allowed) {
    throw new TransitionError(
      aggregateType,
      aggregateId,
      currentState,
      eventType,
    );
  }

  if (!allowed.has(eventType)) {
    throw new TransitionError(
      aggregateType,
      aggregateId,
      currentState,
      eventType,
    );
  }
}

/**
 * Returns the set of allowed event types for a given aggregate state.
 * Useful for introspection and API responses.
 */
export function getAllowedTransitions(
  aggregateType: string,
  currentState: string | null,
): string[] {
  if (statelessAggregates.has(aggregateType)) {
    return [];
  }

  if (currentState === null) {
    return Array.from(creationEvents).filter((e) => {
      if (aggregateType === "task") return e === EventTypes.TaskCreated;
      if (aggregateType === "inspection_report") return e === EventTypes.InspectionReportUploaded;
      if (aggregateType === "assistant_action") return e === EventTypes.AssistantActionProposed;
      return false;
    });
  }

  const transitions = transitionRegistry[aggregateType];
  if (!transitions) return [];

  const allowed = transitions[currentState];
  return allowed ? Array.from(allowed) : [];
}
