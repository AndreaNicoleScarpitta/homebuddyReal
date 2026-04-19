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

    // ----- Circuit Map -----
    case EventTypes.CircuitMapCreated:
      await tx.execute(sql`
        INSERT INTO projection_circuit_map (map_id, home_id, system_id, image_url, store_image, state, breakers, last_event_seq, created_at, updated_at)
        VALUES (
          ${id},
          ${(data.homeId as string) ?? ""},
          ${(data.systemId as string) ?? null},
          ${(data.imageUrl as string) ?? null},
          ${(data.storeImage as boolean) ? 1 : 0},
          'saved',
          ${JSON.stringify(data.breakers ?? [])}::jsonb,
          ${seq}, now(), now()
        )
        ON CONFLICT (map_id) DO UPDATE
        SET state = 'saved',
            image_url = COALESCE(${(data.imageUrl as string) ?? null}, projection_circuit_map.image_url),
            store_image = ${(data.storeImage as boolean) ? 1 : 0},
            breakers = ${JSON.stringify(data.breakers ?? [])}::jsonb,
            last_event_seq = ${seq},
            updated_at = now()
      `);
      break;

    case EventTypes.CircuitMapAnnotated:
      await tx.execute(sql`
        UPDATE projection_circuit_map
        SET breakers = ${JSON.stringify(data.breakers ?? [])}::jsonb,
            image_url = COALESCE(${(data.imageUrl as string) ?? null}, projection_circuit_map.image_url),
            store_image = CASE WHEN ${(data.storeImage as boolean | undefined) !== undefined ? 1 : null}::int IS NOT NULL
                          THEN ${(data.storeImage as boolean) ? 1 : 0}
                          ELSE projection_circuit_map.store_image END,
            state = 'saved',
            last_event_seq = ${seq},
            updated_at = now()
        WHERE map_id = ${id}
      `);
      break;

    case EventTypes.CircuitMapDeleted:
      await tx.execute(sql`
        DELETE FROM projection_circuit_map WHERE map_id = ${id}
      `);
      break;

    // ----- File Analysis -----
    case EventTypes.FileAnalysisCompleted:
    case EventTypes.SuggestedSystemApproved:
    case EventTypes.SuggestedSystemDeclined:
      break;

    // ----- Retry -----
    case EventTypes.RetryRequested:
      break;

    // ----- Component -----
    case EventTypes.ComponentCreated: {
      await tx.execute(sql`
        INSERT INTO components (home_id, system_id, name, component_type, material, install_year, condition, notes, provenance_source, provenance_confidence)
        VALUES (${data.homeId as number}, ${data.systemId as number}, ${data.name as string}, ${(data.componentType as string) ?? null}, ${(data.material as string) ?? null}, ${(data.installYear as number) ?? null}, ${(data.condition as string) || 'Unknown'}, ${(data.notes as string) ?? null}, ${(data.provenanceSource as string) || 'manual'}, ${(data.provenanceConfidence as number) ?? null})
      `);
      break;
    }

    case EventTypes.ComponentUpdated: {
      await tx.execute(sql`
        UPDATE components
        SET name = COALESCE(${(data.name as string) ?? null}, name),
            component_type = COALESCE(${(data.componentType as string) ?? null}, component_type),
            material = COALESCE(${(data.material as string) ?? null}, material),
            install_year = COALESCE(${(data.installYear as number) ?? null}, install_year),
            condition = COALESCE(${(data.condition as string) ?? null}, condition),
            notes = COALESCE(${(data.notes as string) ?? null}, notes),
            updated_at = now()
        WHERE id = ${Number(id)}
      `);
      break;
    }

    case EventTypes.ComponentDeleted: {
      await tx.execute(sql`DELETE FROM components WHERE id = ${Number(id)}`);
      break;
    }

    // ----- Warranty -----
    case EventTypes.WarrantyCreated: {
      await tx.execute(sql`
        INSERT INTO warranties (home_id, system_id, component_id, warranty_provider, warranty_type, coverage_summary, start_date, expiry_date, is_transferable, document_id, notes, provenance_source, provenance_confidence)
        VALUES (${data.homeId as number}, ${(data.systemId as number) ?? null}, ${(data.componentId as number) ?? null}, ${(data.warrantyProvider as string) ?? null}, ${(data.warrantyType as string) ?? null}, ${(data.coverageSummary as string) ?? null}, ${(data.startDate as string) ?? null}::timestamptz, ${(data.expiryDate as string) ?? null}::timestamptz, ${(data.isTransferable as boolean) ?? false}, ${(data.documentId as number) ?? null}, ${(data.notes as string) ?? null}, ${(data.provenanceSource as string) || 'manual'}, ${(data.provenanceConfidence as number) ?? null})
      `);
      break;
    }

    case EventTypes.WarrantyUpdated: {
      await tx.execute(sql`
        UPDATE warranties
        SET warranty_provider = COALESCE(${(data.warrantyProvider as string) ?? null}, warranty_provider),
            warranty_type = COALESCE(${(data.warrantyType as string) ?? null}, warranty_type),
            coverage_summary = COALESCE(${(data.coverageSummary as string) ?? null}, coverage_summary),
            start_date = COALESCE(${(data.startDate as string) ?? null}::timestamptz, start_date),
            expiry_date = COALESCE(${(data.expiryDate as string) ?? null}::timestamptz, expiry_date),
            notes = COALESCE(${(data.notes as string) ?? null}, notes),
            updated_at = now()
        WHERE id = ${Number(id)}
      `);
      break;
    }

    case EventTypes.WarrantyDeleted: {
      await tx.execute(sql`DELETE FROM warranties WHERE id = ${Number(id)}`);
      break;
    }

    // ----- Recommendation -----
    case EventTypes.RecommendationCreated: {
      await tx.execute(sql`
        INSERT INTO recommendations (home_id, system_id, component_id, finding_id, source, title, description, urgency, confidence, rationale, estimated_cost, status)
        VALUES (${data.homeId as number}, ${(data.systemId as number) ?? null}, ${(data.componentId as number) ?? null}, ${(data.findingId as number) ?? null}, ${data.source as string}, ${data.title as string}, ${(data.description as string) ?? null}, ${(data.urgency as string) || 'later'}, ${(data.confidence as number) ?? null}, ${(data.rationale as string) ?? null}, ${(data.estimatedCost as string) ?? null}, 'open')
      `);
      break;
    }

    case EventTypes.RecommendationAccepted: {
      await tx.execute(sql`
        UPDATE recommendations
        SET status = 'accepted',
            task_id = COALESCE(${(data.taskId as number) ?? null}, task_id),
            updated_at = now()
        WHERE id = ${Number(id)}
      `);
      break;
    }

    case EventTypes.RecommendationDismissed: {
      await tx.execute(sql`
        UPDATE recommendations
        SET status = 'dismissed', updated_at = now()
        WHERE id = ${Number(id)}
      `);
      break;
    }

    // ----- Repair -----
    case EventTypes.RepairRecorded: {
      const repairResult = await tx.execute(sql`
        INSERT INTO repairs (home_id, system_id, component_id, task_id, contractor_id, title, description, repair_date, cost, parts_used, outcome, provenance_source, provenance_confidence)
        VALUES (${data.homeId as number}, ${(data.systemId as number) ?? null}, ${(data.componentId as number) ?? null}, ${(data.taskId as number) ?? null}, ${(data.contractorId as number) ?? null}, ${data.title as string}, ${(data.description as string) ?? null}, ${(data.repairDate as string) ?? null}::timestamptz, ${(data.cost as number) ?? null}, ${(data.partsUsed as string) ?? null}, ${(data.outcome as string) || 'resolved'}, ${(data.provenanceSource as string) || 'manual'}, ${(data.provenanceConfidence as number) ?? null})
        RETURNING id
      `);
      const repairId = (repairResult.rows[0] as { id: number })?.id;
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
        VALUES (${data.homeId as number}, COALESCE(${(data.repairDate as string) ?? null}::timestamptz, now()), 'repair', ${data.title as string}, ${(data.description as string) ?? null}, 'wrench', 'repair', ${repairId}, ${(data.cost as number) ?? null}, ${(data.provenanceSource as string) || 'manual'})
      `);
      break;
    }

    // ----- Replacement -----
    case EventTypes.ReplacementRecorded: {
      const replacementResult = await tx.execute(sql`
        INSERT INTO replacements (home_id, system_id, component_id, replaced_system_name, replaced_make, replaced_model, replacement_date, cost, contractor_id, reason, document_id, provenance_source, provenance_confidence)
        VALUES (${data.homeId as number}, ${(data.systemId as number) ?? null}, ${(data.componentId as number) ?? null}, ${(data.replacedSystemName as string) ?? null}, ${(data.replacedMake as string) ?? null}, ${(data.replacedModel as string) ?? null}, ${(data.replacementDate as string) ?? null}::timestamptz, ${(data.cost as number) ?? null}, ${(data.contractorId as number) ?? null}, ${(data.reason as string) ?? null}, ${(data.documentId as number) ?? null}, ${(data.provenanceSource as string) || 'manual'}, ${(data.provenanceConfidence as number) ?? null})
        RETURNING id
      `);
      const replacementId = (replacementResult.rows[0] as { id: number })?.id;
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source)
        VALUES (${data.homeId as number}, COALESCE(${(data.replacementDate as string) ?? null}::timestamptz, now()), 'replacement', ${(data.replacedSystemName as string) || 'System replacement'}, ${(data.reason as string) ?? null}, 'refresh-cw', 'replacement', ${replacementId}, ${(data.cost as number) ?? null}, ${(data.provenanceSource as string) || 'manual'})
      `);
      break;
    }

    // ----- Permit -----
    case EventTypes.PermitCreated: {
      const permitResult = await tx.execute(sql`
        INSERT INTO permits (home_id, system_id, permit_number, permit_type, issued_date, status, issuing_authority, description, document_id, provenance_source, provenance_confidence)
        VALUES (${data.homeId as number}, ${(data.systemId as number) ?? null}, ${(data.permitNumber as string) ?? null}, ${(data.permitType as string) ?? null}, ${(data.issuedDate as string) ?? null}::timestamptz, ${(data.status as string) || 'unknown'}, ${(data.issuingAuthority as string) ?? null}, ${(data.description as string) ?? null}, ${(data.documentId as number) ?? null}, ${(data.provenanceSource as string) || 'manual'}, ${(data.provenanceConfidence as number) ?? null})
        RETURNING id
      `);
      const permitId = (permitResult.rows[0] as { id: number })?.id;
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, provenance_source)
        VALUES (${data.homeId as number}, COALESCE(${(data.issuedDate as string) ?? null}::timestamptz, now()), 'permit', ${(data.permitType as string) || 'Permit'}, ${(data.description as string) ?? null}, 'file-text', 'permit', ${permitId}, ${(data.provenanceSource as string) || 'manual'})
      `);
      break;
    }

    // ----- Timeline Event -----
    case EventTypes.TimelineEventRecorded: {
      await tx.execute(sql`
        INSERT INTO timeline_events (home_id, event_date, category, title, description, icon, entity_type, entity_id, cost, provenance_source, metadata)
        VALUES (${data.homeId as number}, ${data.eventDate as string}::timestamptz, ${data.category as string}, ${data.title as string}, ${(data.description as string) ?? null}, ${(data.icon as string) ?? null}, ${(data.entityType as string) ?? null}, ${(data.entityId as number) ?? null}, ${(data.cost as number) ?? null}, ${(data.provenanceSource as string) ?? null}, ${(data.metadata as string) ?? null})
      `);
      break;
    }

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
