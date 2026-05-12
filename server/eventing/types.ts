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
  "circuit_map",
  "file_analysis",
  "suggested_system",
  "component",
  "warranty",
  "recommendation",
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

  CircuitMapCreated: "CircuitMapCreated",
  CircuitMapAnnotated: "CircuitMapAnnotated",
  CircuitMapDeleted: "CircuitMapDeleted",

  FileAnalysisCompleted: "FileAnalysisCompleted",
  SuggestedSystemApproved: "SuggestedSystemApproved",
  SuggestedSystemDeclined: "SuggestedSystemDeclined",

  RetryRequested: "RetryRequested",

  // Home Graph events
  ComponentCreated: "ComponentCreated",
  ComponentUpdated: "ComponentUpdated",
  ComponentDeleted: "ComponentDeleted",
  WarrantyCreated: "WarrantyCreated",
  WarrantyUpdated: "WarrantyUpdated",
  WarrantyDeleted: "WarrantyDeleted",
  RecommendationCreated: "RecommendationCreated",
  RecommendationAccepted: "RecommendationAccepted",
  RecommendationDismissed: "RecommendationDismissed",
  RepairRecorded: "RepairRecorded",
  ReplacementRecorded: "ReplacementRecorded",
  PermitCreated: "PermitCreated",
  TimelineEventRecorded: "TimelineEventRecorded",
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

export const BreakerSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().default(""),
  room: z.string().default(""),
  notes: z.string().default(""),
  amperage: z.number().int().optional(),
});

export const CircuitMapCreatedData = z.object({
  homeId: z.string().uuid(),
  systemId: z.string().uuid().optional(),
  imageUrl: z.string().optional(),
  storeImage: z.boolean().default(false),
  breakers: z.array(BreakerSchema).default([]),
});

export const CircuitMapAnnotatedData = z.object({
  breakers: z.array(BreakerSchema),
  imageUrl: z.string().optional(),
  storeImage: z.boolean().optional(),
});

export const CircuitMapDeletedData = z.object({
  reason: z.string().optional(),
});

export const FileAnalysisCompletedData = z.object({
  homeId: z.string().uuid(),
  sourceFiles: z.array(z.object({
    fileName: z.string(),
    fileType: z.string(),
    textLength: z.number(),
  })),
  matchedSystemUpdates: z.array(z.record(z.unknown())).default([]),
  matchedSystemTasks: z.array(z.record(z.unknown())).default([]),
  suggestedSystems: z.array(z.record(z.unknown())).default([]),
  pendingTasks: z.array(z.record(z.unknown())).default([]),
  pendingAttributes: z.array(z.record(z.unknown())).default([]),
  analysisWarnings: z.array(z.string()).default([]),
});

export const SuggestedSystemApprovedData = z.object({
  homeId: z.string().uuid(),
  systemName: z.string(),
  systemCategory: z.string(),
  createdSystemId: z.string().uuid(),
  migratedTaskIds: z.array(z.string()).default([]),
  migratedAttributes: z.record(z.unknown()).default({}),
});

export const SuggestedSystemDeclinedData = z.object({
  homeId: z.string().uuid(),
  reason: z.string().optional(),
  deletedTaskIds: z.array(z.string()).default([]),
  deletedAttributeKeys: z.array(z.string()).default([]),
});

export const RetryRequestedData = z.object({
  targetAggregateType: z.string(),
  targetAggregateId: z.string().uuid(),
  reason: z.string().optional(),
});

// Home Graph event data schemas
export const ComponentCreatedData = z.object({
  homeId: z.number(),
  systemId: z.number(),
  name: z.string(),
  componentType: z.string().optional(),
  material: z.string().optional(),
  installYear: z.number().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
  provenanceSource: z.string().optional(),
  provenanceConfidence: z.number().optional(),
});

export const ComponentUpdatedData = z.object({
  name: z.string().optional(),
  componentType: z.string().optional(),
  material: z.string().optional(),
  installYear: z.number().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
});

export const ComponentDeletedData = z.object({
  reason: z.string().optional(),
});

export const WarrantyCreatedData = z.object({
  homeId: z.number(),
  systemId: z.number().optional(),
  componentId: z.number().optional(),
  warrantyProvider: z.string().optional(),
  warrantyType: z.string().optional(),
  coverageSummary: z.string().optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isTransferable: z.boolean().optional(),
  documentId: z.number().optional(),
  notes: z.string().optional(),
  provenanceSource: z.string().optional(),
  provenanceConfidence: z.number().optional(),
});

export const WarrantyUpdatedData = z.object({
  warrantyProvider: z.string().optional(),
  warrantyType: z.string().optional(),
  coverageSummary: z.string().optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isTransferable: z.boolean().optional(),
  notes: z.string().optional(),
});

export const WarrantyDeletedData = z.object({
  reason: z.string().optional(),
});

export const RecommendationCreatedData = z.object({
  homeId: z.number(),
  systemId: z.number().optional(),
  componentId: z.number().optional(),
  findingId: z.number().optional(),
  source: z.string(),
  title: z.string(),
  description: z.string().optional(),
  urgency: z.string().optional(),
  confidence: z.number().optional(),
  rationale: z.string().optional(),
  estimatedCost: z.string().optional(),
  provenanceSource: z.string().optional(),
});

export const RecommendationAcceptedData = z.object({
  taskId: z.number().optional(),
});

export const RecommendationDismissedData = z.object({
  reason: z.string().optional(),
});

export const RepairRecordedData = z.object({
  homeId: z.number(),
  systemId: z.number().optional(),
  componentId: z.number().optional(),
  taskId: z.number().optional(),
  contractorId: z.number().optional(),
  title: z.string(),
  description: z.string().optional(),
  repairDate: z.string().optional(),
  cost: z.number().optional(),
  partsUsed: z.string().optional(),
  outcome: z.string().optional(),
  provenanceSource: z.string().optional(),
  provenanceConfidence: z.number().optional(),
});

export const ReplacementRecordedData = z.object({
  homeId: z.number(),
  systemId: z.number().optional(),
  componentId: z.number().optional(),
  replacedSystemName: z.string().optional(),
  replacedMake: z.string().optional(),
  replacedModel: z.string().optional(),
  replacementDate: z.string().optional(),
  cost: z.number().optional(),
  contractorId: z.number().optional(),
  reason: z.string().optional(),
  documentId: z.number().optional(),
  provenanceSource: z.string().optional(),
  provenanceConfidence: z.number().optional(),
});

export const PermitCreatedData = z.object({
  homeId: z.number(),
  systemId: z.number().optional(),
  permitNumber: z.string().optional(),
  permitType: z.string().optional(),
  issuedDate: z.string().optional(),
  status: z.string().optional(),
  issuingAuthority: z.string().optional(),
  description: z.string().optional(),
  documentId: z.number().optional(),
  provenanceSource: z.string().optional(),
  provenanceConfidence: z.number().optional(),
});

export const TimelineEventRecordedData = z.object({
  homeId: z.number(),
  eventDate: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.number().optional(),
  cost: z.number().optional(),
  provenanceSource: z.string().optional(),
  metadata: z.string().optional(),
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
  [EventTypes.CircuitMapCreated]: CircuitMapCreatedData,
  [EventTypes.CircuitMapAnnotated]: CircuitMapAnnotatedData,
  [EventTypes.CircuitMapDeleted]: CircuitMapDeletedData,
  [EventTypes.FileAnalysisCompleted]: FileAnalysisCompletedData,
  [EventTypes.SuggestedSystemApproved]: SuggestedSystemApprovedData,
  [EventTypes.SuggestedSystemDeclined]: SuggestedSystemDeclinedData,
  [EventTypes.RetryRequested]: RetryRequestedData,
  [EventTypes.ComponentCreated]: ComponentCreatedData,
  [EventTypes.ComponentUpdated]: ComponentUpdatedData,
  [EventTypes.ComponentDeleted]: ComponentDeletedData,
  [EventTypes.WarrantyCreated]: WarrantyCreatedData,
  [EventTypes.WarrantyUpdated]: WarrantyUpdatedData,
  [EventTypes.WarrantyDeleted]: WarrantyDeletedData,
  [EventTypes.RecommendationCreated]: RecommendationCreatedData,
  [EventTypes.RecommendationAccepted]: RecommendationAcceptedData,
  [EventTypes.RecommendationDismissed]: RecommendationDismissedData,
  [EventTypes.RepairRecorded]: RepairRecordedData,
  [EventTypes.ReplacementRecorded]: ReplacementRecordedData,
  [EventTypes.PermitCreated]: PermitCreatedData,
  [EventTypes.TimelineEventRecorded]: TimelineEventRecordedData,
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
