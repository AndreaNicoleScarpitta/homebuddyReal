/**
 * Step 3 — the magic moment.
 *
 * After the user picks their systems in step 2, the orchestrator in
 * `onboarding.tsx` has created the home + systems, which caused the
 * server's `generateTasksForSystem` templates to fire and populate
 * `maintenance_tasks`. Here we just read that list back and show it:
 * "Look what we already built for you."
 *
 * Goal: "first useful output in under 2 minutes." This is the moment
 * the user sees evidence that the product is doing work on their
 * behalf — it's the screen that decides whether they stay or bounce.
 * Resist the urge to stuff more UI in here: just the list, urgency
 * colors, and a "Take me to my dashboard" button.
 *
 * Empty state: if the tasks query returned zero rows (e.g. transient
 * server hiccup while writing), we still show a friendly "Your plan
 * is ready" with the systems count and a dashboard CTA — never block
 * the user from getting into the app.
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Sparkles, Calendar, Upload } from "lucide-react";
import type { V2Task } from "@/lib/api";

interface StepFirstTasksProps {
  tasks: V2Task[];
  systemsCount: number;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
  onUploadInspection: () => void;
}

const URGENCY_LABEL: Record<string, { label: string; dot: string; order: number }> = {
  now: { label: "Do now", dot: "bg-destructive", order: 0 },
  soon: { label: "Coming up", dot: "bg-amber-500", order: 1 },
  later: { label: "Later this year", dot: "bg-emerald-500", order: 2 },
  monitor: { label: "Just watch", dot: "bg-sky-500", order: 3 },
};

function urgencyOrder(u?: string | null): number {
  if (!u) return 4;
  return URGENCY_LABEL[u]?.order ?? 4;
}

export function StepFirstTasks({
  tasks,
  systemsCount,
  isLoading,
  onNext,
  onBack,
  onUploadInspection,
}: StepFirstTasksProps) {
  // Show the ~8 most urgent tasks — enough to feel meaty, not so many
  // the scroll kills the celebration.
  const preview = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const ua = urgencyOrder(a.urgency);
      const ub = urgencyOrder(b.urgency);
      if (ua !== ub) return ua - ub;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db2 = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db2;
    });
    return sorted.slice(0, 8);
  }, [tasks]);

  const remaining = Math.max(0, tasks.length - preview.length);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-magic-moment">
            Your plan is ready.
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-plan-summary">
            {isLoading
              ? "Building your starter tasks…"
              : tasks.length > 0
              ? `We lined up ${tasks.length} task${tasks.length === 1 ? "" : "s"} across ${systemsCount} system${systemsCount === 1 ? "" : "s"} in your home.`
              : `Covered ${systemsCount} system${systemsCount === 1 ? "" : "s"} in your home. We'll add tasks as you tell us more.`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden bg-card">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Generating tasks…
          </div>
        ) : preview.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No tasks generated — that's unusual. You can add them by hand on
            the dashboard.
          </div>
        ) : (
          preview.map((task) => {
            const meta = URGENCY_LABEL[task.urgency || "later"] || URGENCY_LABEL.later;
            return (
              <div
                key={task.id}
                className="p-3.5 flex items-start gap-3"
                data-testid={`row-task-${task.id}`}
              >
                <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${meta.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{meta.label}</span>
                    {task.estimatedCost && (
                      <>
                        <span>•</span>
                        <span>{task.estimatedCost}</span>
                      </>
                    )}
                    {task.diyLevel && (
                      <>
                        <span>•</span>
                        <span>{task.diyLevel}</span>
                      </>
                    )}
                    {task.dueDate && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {remaining > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          + {remaining} more waiting for you on the dashboard
        </p>
      )}

      <div className="space-y-3">
        <Button
          className="w-full h-12 font-medium"
          onClick={onNext}
          data-testid="button-go-to-dashboard"
        >
          Take me to my dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          className="w-full h-11 font-medium"
          onClick={onUploadInspection}
          data-testid="button-upload-inspection"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload an inspection report first (optional)
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Have an inspection PDF? It'll pull out dozens of specific findings and
        add them to your plan.
      </p>
    </div>
  );
}
