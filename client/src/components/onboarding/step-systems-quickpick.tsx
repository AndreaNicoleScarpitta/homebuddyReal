/**
 * Step 2 — tap-to-add the big-ticket systems in the user's home.
 *
 * This is the "minimum viable home model" step. Every house has HVAC,
 * plumbing, electrical, and a roof, so those four are pre-selected.
 * The user taps to add/remove, then Continues. Each selected category
 * becomes a System in the DB on submit, which triggers the server-side
 * `generateTasksForSystem` pipeline — that's what produces the task
 * preview on step 3. Do not gate this step on server writes — we let
 * the parent orchestrator do the create-home + create-systems sequence
 * as an await chain on "Continue" so the UI stays responsive.
 *
 * The category names here MUST match the keys in
 * `server/services/maintenance-templates.ts` — otherwise the task
 * generation falls back to a generic template and the magic moment is
 * less magical.
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

export interface SystemChoice {
  category: string;
  /** Display name used as the system's name in the DB. */
  name: string;
  /** Emoji for the chip — keeps it playful without requiring icon imports. */
  emoji: string;
  /** Short hint under the chip label. */
  hint: string;
}

/**
 * The menu. Order is deliberate: top-of-mind-big-ticket first so users
 * land on "yes, that's my house" immediately. Keys match category names
 * in `server/services/maintenance-templates.ts`.
 */
export const SYSTEM_CHOICES: SystemChoice[] = [
  { category: "HVAC", name: "Heating & Cooling", emoji: "🌡️", hint: "Furnace, AC, heat pump" },
  { category: "Water Heater", name: "Water Heater", emoji: "🚿", hint: "Tank or tankless" },
  { category: "Plumbing", name: "Plumbing", emoji: "🚰", hint: "Pipes, fixtures, drains" },
  { category: "Electrical", name: "Electrical", emoji: "⚡", hint: "Panel, outlets, wiring" },
  { category: "Roof", name: "Roof", emoji: "🏠", hint: "Shingles, gutters, flashing" },
  { category: "Appliances", name: "Major Appliances", emoji: "🧺", hint: "Dishwasher, laundry, fridge" },
  { category: "Windows", name: "Windows", emoji: "🪟", hint: "Seals, weatherstripping" },
  { category: "Foundation", name: "Foundation", emoji: "🧱", hint: "Cracks, drainage, settling" },
  { category: "Siding/Exterior", name: "Exterior / Siding", emoji: "🪵", hint: "Siding, paint, trim" },
  { category: "Chimney", name: "Chimney", emoji: "🔥", hint: "Flue, cap, masonry" },
  { category: "Landscaping", name: "Yard & Landscaping", emoji: "🌿", hint: "Trees, irrigation, grading" },
  { category: "Pest", name: "Pest Control", emoji: "🐜", hint: "Termite, rodent, ant" },
];

/**
 * Default selections. Rationale: ~every home has these four, and having
 * something pre-selected means the Continue button is enabled on first
 * render — no empty-state fiddling. Users can un-tap anything they don't
 * have (e.g. renters with no roof).
 */
export const DEFAULT_SELECTED = new Set<string>(["HVAC", "Plumbing", "Electrical", "Roof"]);

interface StepSystemsQuickpickProps {
  selected: Set<string>;
  onToggle: (category: string) => void;
  onNext: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function StepSystemsQuickpick({
  selected,
  onToggle,
  onNext,
  onBack,
  isSubmitting,
}: StepSystemsQuickpickProps) {
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
        <h1 className="text-2xl font-heading font-bold text-foreground">
          What's in your home?
        </h1>
        <p className="text-muted-foreground mt-1">
          Tap what applies. We'll build a starter maintenance plan around it —
          you can add more later.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SYSTEM_CHOICES.map((choice) => {
          const isOn = selected.has(choice.category);
          return (
            <button
              key={choice.category}
              type="button"
              onClick={() => onToggle(choice.category)}
              data-testid={`chip-system-${choice.category.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={[
                "relative rounded-xl border px-3 py-3 text-left transition-all",
                "hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/40",
                isOn
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-secondary/30",
              ].join(" ")}
            >
              {isOn && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className="text-xl leading-none">{choice.emoji}</div>
              <div className="mt-1.5 text-sm font-medium text-foreground">
                {choice.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                {choice.hint}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-selected-count">
        {selected.size} selected
      </p>

      <Button
        className="w-full h-12 font-medium"
        onClick={onNext}
        disabled={selected.size === 0 || isSubmitting}
        data-testid="button-generate-plan"
      >
        {isSubmitting ? "Building your plan…" : "Show me my maintenance plan"}
        {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}
