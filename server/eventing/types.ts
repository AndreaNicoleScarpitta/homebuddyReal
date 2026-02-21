/**
 * Event Sourcing Types — Milestone 2: Command + Projection Pipeline
 *
 * Defines the domain event catalog, actor types, aggregate types, and
 * Zod schemas for event payloads.  Every mutation in the /v2 API emits
 * one or more typed events from this catalog.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Actor — who caused the event
// ---------------------------------------------------------------------------
export const ActorSchema = z.object({
  actorType: z.enum(["user", "assistant", "system"]),
  actorId: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;

// ---------------------------------------------------------------------------
// Aggregate types — the entity streams in event_log
// ---------------------------------------------------------------------------
export const AggregateTypes = [
  "home",
  "system",
  "inspection_report",
  "finding",
  "task",
  "notification_pref",
  "assistant_action",
  "chat_session",
] as const;
export type AggregateType = (typeof AggregateTypes)[number];

// ---------------------------------------------------------------------------
// Event type catalog — every domain event the system can emit
// ---------------------------------------------------------------------------
export const EventTypes = {
  HomeAttributesUpdated: "HomeAttributesUpdated",

  SystemAttributesUpserted: "SystemAttributesUpserted",
  SystemHealthEvaluated: "SystemHealthEvaluated",
  SystemStatusOverridden: "SystemStatusOverridden",
  SystemDeleted: "SystemDeleted",
  OverrideCleared: "OverrideCleared",

  InspectionReportUploaded: "InspectionReportUploaded",
  InspectionReportAnalysisQueued: "InspectionReportAnalysisQueued",
  InspectionReportAnalyzedDraft: "InspectionReportAnalyzedDraft",
  InspectionReportNeedsReview: "InspectionReportNeedsReview",
  InspectionReportPublished: "InspectionReportPublished",
  InspectionReportAnalysisFailed: "InspectionReportAnalysisFailed",
  InspectionReportDeleted: "InspectionReportDeleted",

  FindingIgnored: "FindingIgnored",
  FindingDeleted: "FindingDeleted",
  FindingTaskCreated: "FindingTaskCreated",

  TaskCreated: "TaskCreated",
  TaskUpdated: "TaskUpdated",
  TaskApproved: "TaskApproved",
  TaskRejected: "TaskRejected",
  TaskScheduled: "TaskScheduled",
  TaskStarted: "TaskStarted",
  TaskCompleted: "TaskCompleted",
  TaskSkipped: "TaskSkipped",
  TaskOverdueMarked: "TaskOverdueMarked",

  NotificationPreferenceSet: "NotificationPreferenceSet",
  DigestDelivered: "DigestDelivered",
  DigestFailed: "DigestFailed",

  ChatSessionCreated: "ChatSessionCreated",
  ChatMessageSent: "ChatMessageSent",

  AssistantActionProposed: "AssistantActionProposed",
  AssistantActionApproved: "AssistantActionApproved",
  AssistantActionExecuted: "AssistantActionExecuted",
  AssistantActionRejected: "AssistantActionRejected",

  RetryRequested: "RetryRequested",
} as const;
export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ---------------------------------------------------------------------------
// Per-event payload schemas (data field in event_log)
// ---------------------------------------------------------------------------

export const HomeAttributesUpdatedData = z.object({
  attrs: z.record(z.unknown()),
});

export const SystemAttributesUpsertedData = z.object({
  homeId: z.string().uuid(),
  systemType: z.string().optional(),
  attrs: z.record(z.unknown()),
});

export const SystemHealthEvaluatedData = z.object({
  riskScore: z.number().min(0).max(1),
  healthState: z.string(),
  factors: z.record(z.unknown()).optional(),
});

export const SystemStatusOverriddenData = z.object({
  overrideHealthState: z.string(),
  reason: z.string().optional(),
});

export const InspectionReportUploadedData = z.object({
  homeId: z.string().uuid(),
  fileHash: z.string().optional(),
  storageRef: z.string().optional(),
});

export const InspectionReportAnalyzedDraftData = z.object({
  draft: z.record(z.unknown()),
});

export const InspectionReportPublishedData = z.object({
  published: z.record(z.unknown()),
});

export const InspectionReportAnalysisFailedData = z.object({
  error: z.string(),
  attemptNumber: z.number().optional(),
});

export const FindingTaskCreatedData = z.object({
  taskId: z.string().uuid(),
});

export const TaskCreatedData = z.object({
  homeId: z.string().uuid(),
  systemId: z.string().uuid().optional(),
  title: z.string(),
  estimates: z.record(z.unknown()).optional(),
  dueAt: z.string().optional(),
});

export const TaskCompletedData = z.object({
  completedAt: z.string().optional(),
});

export const NotificationPreferenceSetData = z.object({
  prefs: z.record(z.unknown()),
});

export const ChatSessionCreatedData = z.object({
  homeId: z.string().uuid(),
});

export const ChatMessageSentData = z.object({
  messageId: z.string().uuid(),
  seq: z.number(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const AssistantActionProposedData = z.object({
  homeId: z.string().uuid(),
  proposedCommands: z.array(z.record(z.unknown())),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().optional(),
});

export const AssistantActionApprovedData = z.object({
  approvedBy: z.string(),
});

export const AssistantActionExecutedData = z.object({
  effects: z.array(z.record(z.unknown())),
  eventIds: z.array(z.string().uuid()),
});

export const AssistantActionRejectedData = z.object({
  reason: z.string().optional(),
});

export const OverrideClearedData = z.object({});

export const InspectionReportAnalysisQueuedData = z.object({});

export const InspectionReportNeedsReviewData = z.object({
  reviewReason: z.string().optional(),
});

export const FindingIgnoredData = z.object({
  reason: z.string().optional(),
});

export const FindingDeletedData = z.object({});

export const TaskApprovedData = z.object({});

export const TaskRejectedData = z.object({
  reason: z.string().optional(),
});

export const TaskScheduledData = z.object({
  scheduledAt: z.string().optional(),
});

export const TaskStartedData = z.object({});

export const TaskSkippedData = z.object({
  reason: z.string().optional(),
});

export const TaskOverdueMarkedData = z.object({
  dueAt: z.string().optional(),
  markedAt: z.string().optional(),
});

export const DigestDeliveredData = z.object({
  digestId: z.string().optional(),
  period: z.string().optional(),
});

export const DigestFailedData = z.object({
  error: z.string(),
  attemptNumber: z.number().optional(),
});

export const RetryRequestedData = z.object({
  targetAggregateType: z.string(),
  targetAggregateId: z.string().uuid(),
  reason: z.string().optional(),
});

export const EventDataSchemas: Record<string, z.ZodTypeAny> = {
  [EventTypes.HomeAttributesUpdated]: HomeAttributesUpdatedData,
  [EventTypes.SystemAttributesUpserted]: SystemAttributesUpsertedData,
  [EventTypes.SystemHealthEvaluated]: SystemHealthEvaluatedData,
  [EventTypes.SystemStatusOverridden]: SystemStatusOverriddenData,
  [EventTypes.OverrideCleared]: OverrideClearedData,
  [EventTypes.InspectionReportUploaded]: InspectionReportUploadedData,
  [EventTypes.InspectionReportAnalysisQueued]: InspectionReportAnalysisQueuedData,
  [EventTypes.InspectionReportAnalyzedDraft]: InspectionReportAnalyzedDraftData,
  [EventTypes.InspectionReportNeedsReview]: InspectionReportNeedsReviewData,
  [EventTypes.InspectionReportPublished]: InspectionReportPublishedData,
  [EventTypes.InspectionReportAnalysisFailed]: InspectionReportAnalysisFailedData,
  [EventTypes.FindingIgnored]: FindingIgnoredData,
  [EventTypes.FindingDeleted]: FindingDeletedData,
  [EventTypes.FindingTaskCreated]: FindingTaskCreatedData,
  [EventTypes.TaskCreated]: TaskCreatedData,
  [EventTypes.TaskApproved]: TaskApprovedData,
  [EventTypes.TaskRejected]: TaskRejectedData,
  [EventTypes.TaskScheduled]: TaskScheduledData,
  [EventTypes.TaskStarted]: TaskStartedData,
  [EventTypes.TaskCompleted]: TaskCompletedData,
  [EventTypes.TaskSkipped]: TaskSkippedData,
  [EventTypes.TaskOverdueMarked]: TaskOverdueMarkedData,
  [EventTypes.NotificationPreferenceSet]: NotificationPreferenceSetData,
  [EventTypes.DigestDelivered]: DigestDeliveredData,
  [EventTypes.DigestFailed]: DigestFailedData,
  [EventTypes.ChatSessionCreated]: ChatSessionCreatedData,
  [EventTypes.ChatMessageSent]: ChatMessageSentData,
  [EventTypes.AssistantActionProposed]: AssistantActionProposedData,
  [EventTypes.AssistantActionApproved]: AssistantActionApprovedData,
  [EventTypes.AssistantActionExecuted]: AssistantActionExecutedData,
  [EventTypes.AssistantActionRejected]: AssistantActionRejectedData,
  [EventTypes.RetryRequested]: RetryRequestedData,
};

// ---------------------------------------------------------------------------
// AppendEventInput — the shape callers pass to eventStore.append()
// ---------------------------------------------------------------------------
export const AppendEventInputSchema = z.object({
  aggregateType: z.string(),
  aggregateId: z.string(),
  expectedVersion: z.number().int().min(0),
  eventType: z.string(),
  data: z.unknown().default({}),
  meta: z.record(z.unknown()).default({}),
  actor: ActorSchema,
  idempotencyKey: z.string(),
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});
export type AppendEventInput = z.infer<typeof AppendEventInputSchema>;

export interface AppendResult {
  deduped: boolean;
  eventId: string;
  version: number;
  eventSeq: number;
}
