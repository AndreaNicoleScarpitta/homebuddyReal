/**
 * Step-inspection-alt — the "power user" fork of onboarding.
 *
 * This is not a mandatory step. It surfaces when the user clicks the
 * inspection CTA from the magic-moment screen. Instead of rebuilding
 * the whole upload pipeline here (PDF parsing, findings review, task
 * confirmation) we redirect to `/inspections` — that page already owns
 * the full upload → analyze → confirm flow and integrates with the v2
 * file-analysis pipeline.
 *
 * Why we still keep it as its own component rather than a direct link:
 * the copy matters. Users arriving here just saw their plan, and we're
 * asking them to do more work. The framing should be "we'll supercharge
 * what you just saw" — not "upload this file please." Tone calibration
 * is the whole reason this component exists.
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, FileText, Zap } from "lucide-react";

interface StepInspectionAltProps {
  onUpload: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepInspectionAlt({ onUpload, onSkip, onBack }: StepInspectionAltProps) {
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

      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-inspection-alt-title">
          Add your inspection report?
        </h1>
        <p className="text-muted-foreground mt-1">
          If you have a PDF from your home inspector, we'll pull out every
          finding and line it up as tasks — much more specific than the
          starter plan you just saw.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Every finding becomes a task</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Cracked caulk, missing GFCI, aging water heater — each one gets
              its own card with urgency and estimated cost.
            </div>
          </div>
        </div>
        <div className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Usually takes ~30 seconds</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              We'll walk you through the findings and let you accept the ones
              that still matter.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          className="w-full h-12 font-medium"
          onClick={onUpload}
          data-testid="button-open-inspection-upload"
        >
          Upload inspection PDF
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          className="w-full h-11 font-medium"
          onClick={onSkip}
          data-testid="button-skip-inspection"
        >
          No thanks — take me to my dashboard
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        You can upload an inspection any time from the Inspections page.
      </p>
    </div>
  );
}
