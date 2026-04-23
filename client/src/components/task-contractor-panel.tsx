/**
 * TaskContractorPanel — per-task contractor workflow UI.
 *
 * Shown inline inside an expanded maintenance card when:
 *   a) the task's diyLevel is "Pro-Only", OR
 *   b) the task already has a proStatus set (user previously started the workflow)
 *
 * The workflow lives entirely on the task — no separate appointment entity.
 * Contractor data (name, phone, quoted cost, scheduled date, notes) is stored in
 * the task's `estimates` JSONB via a standard `updateTask` PATCH call. This
 * avoids the FK resolution problem that `contractor_appointments` would introduce
 * (that table uses integer task IDs; v2 tasks have UUID IDs).
 *
 * State machine (proStatus field in task):
 *
 *   [not set]  →  needs_pro  →  quoted  →  scheduled_pro  →  (task completed)
 *
 * Users can jump to any state and fill in the relevant fields. Completing the
 * task resets the UI to show completion — the contractor workflow is done.
 *
 * Design:  3-step track at the top (click a pill to advance/set).
 *          Below the track: context-appropriate fields.
 *          An Angi search link is always accessible.
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask } from "@/lib/api";
import type { V2Task, TaskProStatus } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ExternalLink, Phone, User2, DollarSign, CalendarClock, StickyNote, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Angi search URL builder (same mapping as contractor-section.tsx)
// ---------------------------------------------------------------------------
const SERVICE_TYPE_MAP: Record<string, string> = {
  "HVAC": "hvac",
  "Plumbing": "plumbing",
  "Electrical": "electricians",
  "Roof": "roofing",
  "Windows": "windows",
  "Siding/Exterior": "siding",
  "Foundation": "foundation-repair",
  "Appliances": "appliance-repair",
  "Water Heater": "water-heater",
  "Landscaping": "landscaping",
  "Pest": "pest-control",
  "Other": "home-improvement",
};

function angiUrl(category?: string | null, zipCode?: string | null): string {
  const svc = SERVICE_TYPE_MAP[category || "Other"] ?? "home-improvement";
  const params = new URLSearchParams({ search_query: svc });
  if (zipCode) params.set("postal_code", zipCode);
  return `https://www.angi.com/search/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface Step {
  value: TaskProStatus;
  label: string;
  hint: string;
}

const STEPS: Step[] = [
  { value: "needs_pro", label: "Need a pro", hint: "Flag it for contractor search" },
  { value: "quoted", label: "Got a quote", hint: "Record the contractor and price" },
  { value: "scheduled_pro", label: "Scheduled", hint: "Contractor is booked" },
];

function stepIndex(s?: TaskProStatus | null): number {
  if (!s) return -1;
  return STEPS.findIndex((st) => st.value === s);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskContractorPanelProps {
  task: V2Task;
  /** Home ZIP — passed through to Angi search for local contractors. */
  zipCode?: string | null;
}

export function TaskContractorPanel({ task, zipCode }: TaskContractorPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(task.contractorName || "");
  const [phone, setPhone] = useState(task.contractorPhone || "");
  const [quoted, setQuoted] = useState(task.quotedCost || "");
  const [scheduledDate, setScheduledDate] = useState(
    task.scheduledProDate ? task.scheduledProDate.slice(0, 16) : ""
  );
  const [notes, setNotes] = useState(task.contractorNotes || "");
  const [dirty, setDirty] = useState(false);

  const currentStep = task.proStatus || null;

  const mutation = useMutation({
    mutationFn: (patch: Partial<V2Task> & { proStatus?: TaskProStatus | null }) =>
      updateTask(task.id, patch as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.homeId] });
      setDirty(false);
      toast({ title: "Saved" });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const setProStatus = useCallback(
    (status: TaskProStatus) => {
      trackEvent("task_contractor", "pro_status", status);
      mutation.mutate({ proStatus: status });
    },
    [mutation]
  );

  const saveFields = useCallback(() => {
    mutation.mutate({
      contractorName: name.trim() || null,
      contractorPhone: phone.trim() || null,
      quotedCost: quoted.trim() || null,
      scheduledProDate: scheduledDate || null,
      contractorNotes: notes.trim() || null,
    } as any);
  }, [mutation, name, phone, quoted, scheduledDate, notes]);

  const clearProStatus = useCallback(() => {
    mutation.mutate({
      proStatus: null,
      contractorName: null,
      contractorPhone: null,
      quotedCost: null,
      scheduledProDate: null,
      contractorNotes: null,
    } as any);
    setName(""); setPhone(""); setQuoted(""); setScheduledDate(""); setNotes("");
  }, [mutation]);

  const activeIdx = stepIndex(currentStep);

  return (
    <div className="mt-3 pt-3 border-t border-dashed space-y-3" data-testid={`contractor-panel-${task.id}`}>
      {/* Status track */}
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Contractor workflow steps">
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.value;
          const isPast = activeIdx > idx;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => setProStatus(step.value)}
              disabled={mutation.isPending}
              title={step.hint}
              data-testid={`btn-pro-step-${step.value}`}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : isPast
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              ].join(" ")}
            >
              {isPast && !isActive ? "✓ " : ""}{step.label}
            </button>
          );
        })}
        {currentStep && (
          <button
            type="button"
            onClick={clearProStatus}
            disabled={mutation.isPending}
            className="text-xs text-muted-foreground hover:text-destructive ml-auto"
            data-testid="btn-clear-pro-status"
          >
            Clear
          </button>
        )}
      </div>

      {/* Angi link — always accessible once the user enters the workflow */}
      {currentStep && (
        <a
          href={angiUrl(task.category, zipCode)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          data-testid={`link-angi-${task.id}`}
        >
          <ExternalLink className="h-3 w-3" />
          Search for {task.category || "home"} pros on Angi
        </a>
      )}

      {/* Fields — appear from "quoted" onward */}
      {(currentStep === "quoted" || currentStep === "scheduled_pro") && (
        <div className="space-y-2.5 pt-1" data-testid="contractor-fields">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor={`con-name-${task.id}`} className="text-xs flex items-center gap-1">
                <User2 className="h-3 w-3" />
                Contractor name
              </Label>
              <Input
                id={`con-name-${task.id}`}
                value={name}
                onChange={(e) => { setName(e.target.value); setDirty(true); }}
                placeholder="e.g., Smith HVAC"
                className="h-8 text-sm"
                data-testid={`input-con-name-${task.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`con-phone-${task.id}`} className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone
              </Label>
              <Input
                id={`con-phone-${task.id}`}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
                placeholder="(555) 000-0000"
                className="h-8 text-sm"
                type="tel"
                data-testid={`input-con-phone-${task.id}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor={`con-quoted-${task.id}`} className="text-xs flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Quoted cost
              </Label>
              <Input
                id={`con-quoted-${task.id}`}
                value={quoted}
                onChange={(e) => { setQuoted(e.target.value); setDirty(true); }}
                placeholder="e.g., $400"
                className="h-8 text-sm"
                data-testid={`input-con-quoted-${task.id}`}
              />
            </div>

            {currentStep === "scheduled_pro" && (
              <div className="space-y-1">
                <Label htmlFor={`con-date-${task.id}`} className="text-xs flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Scheduled date
                </Label>
                <Input
                  id={`con-date-${task.id}`}
                  value={scheduledDate}
                  onChange={(e) => { setScheduledDate(e.target.value); setDirty(true); }}
                  type="datetime-local"
                  className="h-8 text-sm"
                  data-testid={`input-con-date-${task.id}`}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={`con-notes-${task.id}`} className="text-xs flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              Notes
            </Label>
            <Input
              id={`con-notes-${task.id}`}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              placeholder="Permit required, bring ladder, etc."
              className="h-8 text-sm"
              data-testid={`input-con-notes-${task.id}`}
            />
          </div>

          {dirty && (
            <Button
              size="sm"
              onClick={saveFields}
              disabled={mutation.isPending}
              className="h-8"
              data-testid={`btn-save-contractor-${task.id}`}
            >
              {mutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Save contractor details
            </Button>
          )}
        </div>
      )}

      {/* Nudge when user just clicked "needs_pro" — encourage them to search */}
      {currentStep === "needs_pro" && (
        <p className="text-xs text-muted-foreground">
          Use the Angi link above to find local pros. Once you have a quote, advance to "Got a quote."
        </p>
      )}
    </div>
  );
}
