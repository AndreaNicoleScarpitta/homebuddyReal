import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function QuickGuidePanel({ moment, hint, empty, onDismiss, onNext, onUpload }: { moment: number; hint?: boolean; empty?: boolean; onDismiss: () => void; onNext: () => void; onUpload: () => void }) {

  function advance() {
    onNext();
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("[data-quick-guide-heading]") ?? document.getElementById("plan-task-list");
      target?.focus({ preventScroll: true });
    });
  }
  function dismiss() {
    onDismiss();
    document.querySelector<HTMLElement>('[aria-controls="plan-task-list"][aria-pressed="true"]')?.focus({ preventScroll: true });
  }
  return <section aria-labelledby={`guide-heading-${moment}`} className="relative my-4 rounded-xl border border-orange-300 bg-orange-50 p-4 text-stone-900 dark:border-orange-800 dark:bg-stone-900 dark:text-stone-100" data-testid={`quick-guide-${moment}`}>
    <button aria-label="Dismiss guide" onClick={dismiss} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4"/></button>
    <p className="pr-10 text-xs font-semibold uppercase tracking-wide">Quick guide · {moment} of 3</p>
    <h3 id={`guide-heading-${moment}`} data-quick-guide-heading tabIndex={-1} className="pr-8 mt-2 font-heading font-semibold focus-visible:outline focus-visible:outline-2">{moment === 1 ? empty ? "Your plan starts here" : "Choose what to focus on" : moment === 2 ? hint ? "Open a task to review the details." : "Review before you act" : "Know where to go"}</h3>
    <p className="mt-2 text-base leading-relaxed">{moment === 1 ? empty ? "No tasks yet. Add systems to get maintenance suggestions, or add a task of your own. Summary cards filter your saved tasks." : "Tap a summary card to see those tasks. Then open a task to review it." : moment === 2 ? hint ? "Your real tasks are below. Choose one to see what needs doing." : "Read the task details. Mark it complete only after the work is done." : "Home shows what needs attention. My House holds systems, shutoffs, and Documents. Plan is where you act."}</p>
    {moment === 3 && <Button variant="outline" className="mt-3 w-full min-h-11" onClick={onUpload}>Upload a document</Button>}
    <div className="mt-2 flex justify-between gap-3"><Button variant="ghost" className="min-h-11" onClick={dismiss}>Skip guide</Button>{!(moment === 2 && hint) && <Button variant="ghost" className="min-h-11" onClick={advance}>{moment === 3 ? "Done" : "Got it"}</Button>}</div>
  </section>;
}
