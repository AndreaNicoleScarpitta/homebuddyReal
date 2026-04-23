/**
 * MaintenanceCard — the core task tile.
 *
 * Phase 2 changes vs Phase 1:
 *  - Pro-Only tasks no longer show a "Find a Pro on Angi" link that just
 *    opens Angi in a new tab. Instead they show the TaskContractorPanel,
 *    which walks the user through the full workflow: flag → search → quote
 *    → schedule. The Angi link is still in the panel but as a search action,
 *    not the only interaction.
 *  - A "pro status" badge appears next to the DIY badge when the task has a
 *    proStatus set (needs_pro / quoted / scheduled_pro) so the state is
 *    visible without expanding the card.
 *  - The panel is shown whenever the card is expanded AND (diyLevel === "Pro-Only"
 *    OR proStatus is set). This means "Caution" tasks can also enter the
 *    contractor workflow if the user decides they'd rather hire out.
 *
 * The `zipCode` prop is optional — passed down from the dashboard so the Angi
 * search link in the panel is pre-filled with the user's ZIP for local results.
 */

import { useState } from "react";
import { Calendar, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskContractorPanel } from "@/components/task-contractor-panel";
import type { V2Task } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

/**
 * Build a Google Calendar "Add event" deep link for a task.
 * Uses a timed 1-hour block when the contractor appointment date is set,
 * falls back to an all-day event on the task's due date.
 */
function gcalUrl(task: V2Task): string {
  const title = encodeURIComponent(task.title);

  const detailParts: string[] = [];
  if (task.description) detailParts.push(task.description);
  const cost = task.quotedCost || task.estimatedCost;
  if (cost) detailParts.push(`${task.quotedCost ? "Quoted" : "Estimated"}: ${cost}`);
  if (task.contractorName) detailParts.push(`Contractor: ${task.contractorName}`);
  if (task.contractorPhone) detailParts.push(`Phone: ${task.contractorPhone}`);
  const details = encodeURIComponent(detailParts.join("\n"));

  let dates: string;
  if (task.scheduledProDate) {
    // Timed 1-hour block at the contractor appointment time
    const start = new Date(task.scheduledProDate);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    dates = `${fmt(start)}/${fmt(end)}`;
  } else if (task.dueDate) {
    // All-day event — Google Calendar DTEND is exclusive, so add one day
    const due = new Date(task.dueDate);
    const y = due.getUTCFullYear();
    const m = String(due.getUTCMonth() + 1).padStart(2, "0");
    const d = String(due.getUTCDate()).padStart(2, "0");
    const next = new Date(Date.UTC(y, due.getUTCMonth(), due.getUTCDate() + 1));
    const ny = next.getUTCFullYear();
    const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(next.getUTCDate()).padStart(2, "0");
    dates = `${y}${m}${d}/${ny}${nm}${nd}`;
  } else {
    return "";
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

const PRO_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  needs_pro: { label: "Needs Pro", cls: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  quoted: { label: "Quoted", cls: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  scheduled_pro: { label: "Scheduled", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

interface TaskProps {
  task: V2Task;
  onComplete?: (task: V2Task) => void;
  /** Home ZIP for Angi search pre-fill in the contractor panel. */
  zipCode?: string | null;
}

export function MaintenanceCard({ task, onComplete, zipCode }: TaskProps) {
  const [expanded, setExpanded] = useState(false);
  const isNow = task.urgency === "now";

  const getDiyBadgeColor = (level: string | null | undefined) => {
    switch (level) {
      case "DIY-Safe": return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-950/60 border-green-200 dark:border-green-800";
      case "Caution": return "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800";
      case "Pro-Only": return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/60 border-red-200 dark:border-red-800";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
    trackEvent("click", "task_card", expanded ? "collapse" : "expand");
  };

  const urgencyLabel =
    task.urgency === "now" ? "Urgent" :
    task.urgency === "soon" ? "Soon" :
    task.urgency === "monitor" ? "Monitor" : "Later";

  const urgencyA11yClass =
    task.urgency === "now" ? "border-l-destructive" :
    task.urgency === "soon" ? "border-l-orange-500" :
    task.urgency === "monitor" ? "border-l-blue-400" : "border-l-green-500";

  // Show the contractor panel when expanded and the task is Pro-Only OR
  // already has a pro workflow status set. This lets non-Pro tasks enter the
  // workflow if the user explicitly chose to hire out.
  const showContractorPanel =
    expanded &&
    task.status !== "completed" &&
    (task.diyLevel === "Pro-Only" || Boolean(task.proStatus));

  const proStatusMeta = task.proStatus ? PRO_STATUS_LABELS[task.proStatus] : null;
  const gcalHref = (task.dueDate || task.scheduledProDate) ? gcalUrl(task) : null;

  return (
    <Card
      className={`group overflow-hidden border-l-4 transition-all duration-300 hover:shadow-md ${urgencyA11yClass}`}
      role="article"
      aria-label={`${task.title} — urgency: ${urgencyLabel}`}
    >
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Urgency badge */}
              <Badge
                variant="outline"
                className={`text-xs font-semibold uppercase tracking-wider ${
                  task.urgency === "now" ? "text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" :
                  task.urgency === "soon" ? "text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30" :
                  task.urgency === "monitor" ? "text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30" :
                  "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
                }`}
                aria-label={`Urgency: ${urgencyLabel}`}
              >
                {task.urgency === "now" ? "⚠ Urgent" :
                 task.urgency === "soon" ? "● Soon" :
                 task.urgency === "monitor" ? "◉ Monitor" : "○ Later"}
              </Badge>

              {task.category && (
                <Badge variant="outline" className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {task.category}
                </Badge>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`text-xs border ${getDiyBadgeColor(task.diyLevel)} shadow-none cursor-help`}>
                    {task.diyLevel || "Unknown"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {task.diyLevel === "DIY-Safe" && <p>Safe for most homeowners to complete with basic tools.</p>}
                  {task.diyLevel === "Caution" && <p>Can be done yourself but requires care. Research first or consider hiring a pro.</p>}
                  {task.diyLevel === "Pro-Only" && <p>Requires licensed professionals. Expand to track a contractor.</p>}
                  {!task.diyLevel && <p>Difficulty level not yet determined.</p>}
                </TooltipContent>
              </Tooltip>

              {/* Pro-status badge — visible without expanding */}
              {proStatusMeta && (
                <Badge
                  variant="outline"
                  className={`text-xs border ${proStatusMeta.cls}`}
                  data-testid={`badge-pro-status-${task.id}`}
                >
                  {proStatusMeta.label}
                </Badge>
              )}

              {task.namespacePrefix && task.namespacePrefix !== "unknown_system" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      data-testid={`badge-namespace-${task.id}`}
                    >
                      {task.namespacePrefix.replace(/_/g, " ")}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>System namespace: <code className="text-xs">{task.namespacePrefix}</code></p>
                    <p className="text-muted-foreground mt-1">Attributes for this task are scoped to this system instance.</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <h3 className="font-heading font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {task.title}
            </h3>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground group-hover:text-primary shrink-0"
            onClick={toggleExpanded}
            data-testid={`button-task-${task.id}`}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>

        {task.safetyWarning && (
          <div className="mb-3 flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-2 rounded border border-orange-100 dark:border-orange-800">
            <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
            {task.safetyWarning}
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-4 pt-4 border-t border-dashed">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className={isNow ? "text-destructive font-medium" : ""}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not scheduled"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground justify-end">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">
              {task.quotedCost || task.estimatedCost || "TBD"}
            </span>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            )}

            {onComplete && task.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent("click", "task_card", "mark_done");
                  onComplete(task);
                }}
                className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-800 dark:hover:text-green-300"
                data-testid={`button-complete-task-${task.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Mark Done
              </Button>
            )}

            {/* Add to Google Calendar — shown when the task has any date */}
            {gcalHref && (
              <a
                href={gcalHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("click", "task_card", "add_to_gcal")}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all no-underline"
                data-testid={`btn-gcal-${task.id}`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Add to Google Calendar
              </a>
            )}

            {/* Contractor workflow panel — Pro-Only or already has pro status */}
            {showContractorPanel && (
              <TaskContractorPanel task={task} zipCode={zipCode} />
            )}
          </div>
        )}

        {/* Collapsed state: show a subtle "Book a pro" prompt for Pro-Only tasks
            that haven't entered the workflow yet. Tapping it expands the card. */}
        {!expanded && task.diyLevel === "Pro-Only" && task.status !== "completed" && !task.proStatus && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-md transition-colors"
            data-testid={`button-book-pro-${task.id}`}
          >
            Track a contractor for this task →
          </button>
        )}

        {/* Collapsed state: show scheduled contractor info if booked */}
        {!expanded && task.proStatus === "scheduled_pro" && task.contractorName && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {task.contractorName}
            {task.scheduledProDate && (
              <span className="text-muted-foreground">
                · {new Date(task.scheduledProDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
