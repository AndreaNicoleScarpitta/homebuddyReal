/**
 * Projection Applier — routes events to the correct projection update.
 *
 * Called synchronously within the same transaction as event append, so
 * projections are always consistent with the event_log.  Each case maps
 * an event type to a projection table UPSERT.
 */

import { sql } from "drizzle-orm";
import type { EventType } from "../eventing/types";
import { EventTypes } from "../eventing/types";

type DrizzleTx = Parameters<Parameters<typeof import("../db").db.transaction>[0]>[0];

interface EventRow {
  event_seq: number;
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  event_type: string;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
  actor_type: string;
  actor_id: string;
  occurred_at: string;
  session_id?: string;
}

/**
 * Apply a single event to its corresponding projection table.
 * Must be called inside the same transaction as the event append.
 */
export async function applyEvent(tx: DrizzleTx, event: EventRow): Promise<void> {
  const eventType = event.event_type as EventType;
  const data = event.data;
  const id = event.aggregate_id;
  const seq = event.event_seq;

  switch (eventType) {
    // ----- Home -----
    case EventTypes.HomeAttributesUpdated: {
      const homeUserId = (event.meta?.userId as string) ?? (event.actor_type === "user" ? event.actor_id : null);
      const homeLegacyId = (event.meta?.legacyId as number) ?? null;
      await tx.execute(sql`
        INSERT INTO projection_home (home_id, user_id, legacy_id, attrs, last_event_seq, updated_at)
        VALUES (${id}, ${homeUserId}, ${homeLegacyId}, ${JSON.stringify(data.attrs ?? data)}::jsonb, ${seq}, now())
        ON CONFLICT (home_id) DO UPDATE
        SET attrs = projection_home.attrs || ${JSON.stringify(data.attrs ?? data)}::jsonb,
            user_id = COALESCE(${homeUserId}, projection_home.user_id),
            legacy_id = COALESCE(${homeLegacyId}, projection_home.legacy_id),
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;
    }

    // ----- System -----
    case EventTypes.SystemAttributesUpserted:
      await tx.execute(sql`
        INSERT INTO projection_system (system_id, home_id, system_type, attrs, last_event_seq, updated_at)
        VALUES (
          ${id},
          ${(data.homeId as string) ?? ""},
          ${(data.systemType as string) ?? null},
          ${JSON.stringify(data.attrs ?? {})}::jsonb,
          ${seq}, now()
        )
        ON CONFLICT (system_id) DO UPDATE
        SET attrs = projection_system.attrs || ${JSON.stringify(data.attrs ?? {})}::jsonb,
            system_type = COALESCE(${(data.systemType as string) ?? null}, projection_system.system_type),
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;

    case EventTypes.SystemHealthEvaluated:
      await tx.execute(sql`
        UPDATE projection_system
        SET health_state = ${(data.healthState as string) ?? null},
            risk_score = ${(data.riskScore as number) ?? null},
            last_event_seq = ${seq},
            updated_at = now()
        WHERE system_id = ${id}
      `);
      break;

    case EventTypes.SystemStatusOverridden:
      await tx.execute(sql`
        UPDATE projection_system
        SET override = ${JSON.stringify(data)}::jsonb,
            health_state = ${(data.overrideHealthState as string) ?? null},
            last_event_seq = ${seq},
            updated_at = now()
        WHERE system_id = ${id}
      `);
      break;

    case EventTypes.OverrideCleared:
      await tx.execute(sql`
        UPDATE projection_system
        SET override = null,
            last_event_seq = ${seq},
            updated_at = now()
        WHERE system_id = ${id}
      `);
      break;

    case EventTypes.SystemDeleted:
      await tx.execute(sql`
        DELETE FROM projection_system WHERE system_id = ${id}
      `);
      break;

    // ----- Inspection Report -----
    case EventTypes.InspectionReportUploaded:
      await tx.execute(sql`
        INSERT INTO projection_report (report_id, home_id, state, file_hash, storage_ref, last_event_seq, updated_at)
        VALUES (
          ${id},
          ${(data.homeId as string) ?? ""},
          'uploaded',
          ${(data.fileHash as string) ?? null},
          ${(data.storageRef as string) ?? null},
          ${seq}, now()
        )
        ON CONFLICT (report_id) DO UPDATE
        SET state = 'uploaded',
            file_hash = COALESCE(${(data.fileHash as string) ?? null}, projection_report.file_hash),
            storage_ref = COALESCE(${(data.storageRef as string) ?? null}, projection_report.storage_ref),
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;

    case EventTypes.InspectionReportAnalysisQueued:
      await tx.execute(sql`
        UPDATE projection_report
        SET state = 'queued', last_event_seq = ${seq}, updated_at = now()
        WHERE report_id = ${id}
      `);
      break;

    case EventTypes.InspectionReportAnalyzedDraft:
      await tx.execute(sql`
        UPDATE projection_report
        SET state = 'draft_ready',
            draft = ${JSON.stringify(data.draft ?? {})}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
        WHERE report_id = ${id}
      `);
      break;

    case EventTypes.InspectionReportNeedsReview:
      await tx.execute(sql`
        UPDATE projection_report
        SET state = 'needs_review', last_event_seq = ${seq}, updated_at = now()
        WHERE report_id = ${id}
      `);
      break;

    case EventTypes.InspectionReportPublished:
      await tx.execute(sql`
        UPDATE projection_report
        SET state = 'published',
            published = ${JSON.stringify(data.published ?? {})}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
        WHERE report_id = ${id}
      `);
      break;

    case EventTypes.InspectionReportAnalysisFailed:
      await tx.execute(sql`
        UPDATE projection_report
        SET state = 'failed',
            error = ${JSON.stringify({ error: data.error, attempt: data.attemptNumber })}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
        WHERE report_id = ${id}
      `);
      break;

    case EventTypes.InspectionReportDeleted:
      await tx.execute(sql`
        DELETE FROM projection_finding WHERE report_id = ${id}
      `);
      await tx.execute(sql`
        DELETE FROM projection_report WHERE report_id = ${id}
      `);
      break;

    // ----- Finding -----
    case EventTypes.FindingIgnored:
      await tx.execute(sql`
        UPDATE projection_finding
        SET state = 'ignored', last_event_seq = ${seq}, updated_at = now()
        WHERE finding_id = ${id}
      `);
      break;

    case EventTypes.FindingDeleted:
      await tx.execute(sql`
        UPDATE projection_finding
        SET state = 'deleted', last_event_seq = ${seq}, updated_at = now()
        WHERE finding_id = ${id}
      `);
      break;

    case EventTypes.FindingTaskCreated:
      await tx.execute(sql`
        UPDATE projection_finding
        SET state = 'task_created', last_event_seq = ${seq}, updated_at = now()
        WHERE finding_id = ${id}
      `);
      break;

    // ----- Task -----
    case EventTypes.TaskCreated:
      await tx.execute(sql`
        INSERT INTO projection_task (task_id, home_id, system_id, state, title, due_at, estimates, last_event_seq, updated_at)
        VALUES (
          ${id},
          ${(data.homeId as string) ?? ""},
          ${(data.systemId as string) ?? null},
          'proposed',
          ${(data.title as string) ?? ""},
          ${(data.dueAt as string) ?? null}::timestamptz,
          ${JSON.stringify(data.estimates ?? {})}::jsonb,
          ${seq}, now()
        )
        ON CONFLICT (task_id) DO UPDATE
        SET state = 'proposed', last_event_seq = ${seq}, updated_at = now()
      `);
      break;

    case EventTypes.TaskUpdated:
      await tx.execute(sql`
        UPDATE projection_task
        SET title = COALESCE(${(data.title as string) ?? null}, projection_task.title),
            due_at = COALESCE(${(data.dueAt as string) ?? null}::timestamptz, projection_task.due_at),
            estimates = CASE WHEN ${JSON.stringify(data.estimates ?? null)}::jsonb IS NOT NULL
                        THEN ${JSON.stringify(data.estimates ?? null)}::jsonb
                        ELSE projection_task.estimates END,
            last_event_seq = ${seq},
            updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskApproved:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'approved', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskRejected:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'rejected', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskScheduled:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'scheduled', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskStarted:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'in_progress', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskCompleted:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'done',
            completed_at = COALESCE(${(data.completedAt as string) ?? null}::timestamptz, now()),
            last_event_seq = ${seq},
            updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskSkipped:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'skipped', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    case EventTypes.TaskOverdueMarked:
      await tx.execute(sql`
        UPDATE projection_task
        SET state = 'overdue', last_event_seq = ${seq}, updated_at = now()
        WHERE task_id = ${id}
      `);
      break;

    // ----- Notification Preferences -----
    case EventTypes.NotificationPreferenceSet:
      await tx.execute(sql`
        INSERT INTO projection_notification_pref (home_id, prefs, last_event_seq, updated_at)
        VALUES (${id}, ${JSON.stringify(data.prefs ?? {})}::jsonb, ${seq}, now())
        ON CONFLICT (home_id) DO UPDATE
        SET prefs = ${JSON.stringify(data.prefs ?? {})}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;

    // ----- Chat -----
    case EventTypes.ChatSessionCreated:
      await tx.execute(sql`
        INSERT INTO projection_chat_session (session_id, home_id, created_at, last_event_seq)
        VALUES (${id}, ${(data.homeId as string) ?? ""}, now(), ${seq})
        ON CONFLICT (session_id) DO UPDATE
        SET last_event_seq = ${seq}
      `);
      break;

    case EventTypes.ChatMessageSent:
      await tx.execute(sql`
        INSERT INTO projection_chat_message (message_id, session_id, seq, role, content, created_at)
        VALUES (
          ${(data.messageId as string) ?? crypto.randomUUID()},
          ${id},
          ${(data.seq as number) ?? 0},
          ${(data.role as string) ?? "user"},
          ${(data.content as string) ?? ""},
          now()
        )
        ON CONFLICT (message_id) DO NOTHING
      `);
      break;

    // ----- Assistant Action -----
    case EventTypes.AssistantActionProposed:
      await tx.execute(sql`
        INSERT INTO projection_assistant_action (assistant_action_id, home_id, state, proposed_commands, provenance, last_event_seq, updated_at)
        VALUES (
          ${id},
          ${(data.homeId as string) ?? ""},
          'proposed',
          ${JSON.stringify(data.proposedCommands ?? [])}::jsonb,
          ${JSON.stringify({ confidence: data.confidence, rationale: data.rationale })}::jsonb,
          ${seq}, now()
        )
        ON CONFLICT (assistant_action_id) DO UPDATE
        SET state = 'proposed',
            proposed_commands = ${JSON.stringify(data.proposedCommands ?? [])}::jsonb,
            provenance = ${JSON.stringify({ confidence: data.confidence, rationale: data.rationale })}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;

    case EventTypes.AssistantActionApproved:
      await tx.execute(sql`
        UPDATE projection_assistant_action
        SET state = 'approved', last_event_seq = ${seq}, updated_at = now()
        WHERE assistant_action_id = ${id}
      `);
      break;

    case EventTypes.AssistantActionExecuted:
      await tx.execute(sql`
        UPDATE projection_assistant_action
        SET state = 'executed', last_event_seq = ${seq}, updated_at = now()
        WHERE assistant_action_id = ${id}
      `);
      break;

    case EventTypes.AssistantActionRejected:
      await tx.execute(sql`
        UPDATE projection_assistant_action
        SET state = 'rejected', last_event_seq = ${seq}, updated_at = now()
        WHERE assistant_action_id = ${id}
      `);
      break;

    // ----- Retry -----
    case EventTypes.RetryRequested:
      break;

    default:
      break;
  }

  // Update projection checkpoint for the aggregate type
  await tx.execute(sql`
    INSERT INTO projection_checkpoint (projector_name, last_event_seq)
    VALUES (${event.aggregate_type}, ${seq})
    ON CONFLICT (projector_name) DO UPDATE
    SET last_event_seq = GREATEST(projection_checkpoint.last_event_seq, ${seq})
  `);
}
