/**
 * ContractorSection — lightweight "Pro tasks" summary widget.
 *
 * Phase 2 redesign: the per-task contractor workflow (search, quote, schedule)
 * now lives directly on each MaintenanceCard via TaskContractorPanel. This
 * widget's job is reduced to a summary/discovery prompt:
 *
 *   "You have N tasks that may need a contractor. Expand any of them to track
 *    one."
 *
 * We intentionally don't repeat the Angi links here — duplicating them would
 * create confusion about which task the user is acting on. The card-level panel
 * is the authoritative place for that workflow.
 *
 * The widget is shown in the dashboard when there are unfinished Pro-Only tasks.
 * It hides itself when all such tasks are either completed or have entered the
 * contractor workflow (proStatus set).
 */

import { Users, Wrench } from "lucide-react";
import type { V2Task, TaskProStatus } from "@/lib/api";

const PRO_STATUS_LABEL: Record<TaskProStatus, string> = {
  needs_pro: "Searching",
  quoted: "Quoted",
  scheduled_pro: "Scheduled",
};

interface ContractorSectionProps {
  homeId: string | number;
  pendingTasks?: V2Task[];
  zipCode?: string;
}

export function ContractorSection({ pendingTasks = [] }: ContractorSectionProps) {
  const proTasks = pendingTasks.filter(
    (t) => t.diyLevel === "Pro-Only" && t.status !== "completed"
  );

  if (proTasks.length === 0) return null;

  // Split into "have started workflow" vs "haven't touched it yet"
  const inWorkflow = proTasks.filter((t) => t.proStatus);
  const notStarted = proTasks.filter((t) => !t.proStatus);

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          {proTasks.length} task{proTasks.length === 1 ? "" : "s"} need a contractor
        </p>
      </div>

      {inWorkflow.length > 0 && (
        <div className="space-y-1">
          {inWorkflow.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <Wrench className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{t.title}</span>
              <span className="shrink-0 font-medium">
                {PRO_STATUS_LABEL[t.proStatus!]}
              </span>
            </div>
          ))}
        </div>
      )}

      {notStarted.length > 0 && (
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {notStarted.length === proTasks.length
            ? "Expand a task below to track a contractor — search, quote, and schedule all from the card."
            : `${notStarted.length} more task${notStarted.length === 1 ? "" : "s"} still need a contractor — expand the card to start.`}
        </p>
      )}
    </div>
  );
}
