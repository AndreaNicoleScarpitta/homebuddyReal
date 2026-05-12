/**
 * UpgradeGate — wraps a feature/CTA and shows an upgrade prompt when the
 * user is at their plan limit or below the required tier.
 *
 * Usage:
 *   <UpgradeGate feature="homes">
 *     <Button>Add Home</Button>
 *   </UpgradeGate>
 *
 *   <UpgradeGate minPlan="plus" label="AI Suggestions">
 *     <AiSuggestionButton />
 *   </UpgradeGate>
 */

import { Link } from "wouter";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan, type PlanId } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

interface UpgradeGateProps {
  children: React.ReactNode;
  /** Countable feature — shows limit-reached state when usage >= limit. */
  feature?: "homes" | "activeTasks" | "docAnalyses" | "aiReports";
  /** Tier minimum — hides behind upgrade prompt if plan is below. */
  minPlan?: PlanId;
  /** Human label for the feature, shown in the CTA. */
  label?: string;
  /** Render an inline pill instead of replacing children. Default: full replacement. */
  inline?: boolean;
  className?: string;
}

const PLAN_NAMES: Record<PlanId, string> = { free: "Free", plus: "Plus", premium: "Premium" };

export function UpgradeGate({ children, feature, minPlan, label, inline, className }: UpgradeGateProps) {
  const { plan, isAtLimit, hasMinPlan, isLoading, data } = usePlan();

  if (isLoading) return <>{children}</>;

  const belowTier = minPlan ? !hasMinPlan(minPlan) : false;
  const atLimit = feature ? isAtLimit(feature) : false;
  const blocked = belowTier || atLimit;

  if (!blocked) return <>{children}</>;

  // Derive the upgrade target
  const targetPlan: PlanId =
    minPlan && !hasMinPlan(minPlan) ? minPlan :
    plan === "free" ? "plus" : "premium";

  const reason = belowTier
    ? `${label || "This feature"} requires ${PLAN_NAMES[minPlan!]} or higher`
    : `You've hit your ${PLAN_NAMES[plan]} limit${feature && data ? ` (${getCurrent(data, feature)}/${getLimit(data, feature)})` : ""}`;

  if (inline) {
    return (
      <Link href="/pricing" className="no-underline">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer",
            className
          )}
          data-testid="upgrade-gate-inline"
        >
          <Sparkles className="h-3 w-3" />
          Upgrade to {PLAN_NAMES[targetPlan]}
        </span>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3",
        className
      )}
      data-testid="upgrade-gate-block"
    >
      <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Lock className="h-5 w-5" />
      </div>
      <div>
        <p className="font-heading font-semibold text-foreground">{reason}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Upgrade to {PLAN_NAMES[targetPlan]} to unlock this.
        </p>
      </div>
      <Link href="/pricing" className="no-underline">
        <Button size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          See plans
        </Button>
      </Link>
    </div>
  );
}

function getCurrent(data: any, f: string): number {
  const map: Record<string, string> = {
    homes: "homes", activeTasks: "activeTasks",
    docAnalyses: "docAnalysesThisMonth", aiReports: "aiReportsThisMonth",
  };
  return data?.usage?.[map[f]] ?? 0;
}
function getLimit(data: any, f: string): number | string {
  const map: Record<string, string> = {
    homes: "maxHomes", activeTasks: "maxActiveTasks",
    docAnalyses: "maxDocAnalysesPerMonth", aiReports: "maxAiReportsPerMonth",
  };
  const v = data?.limits?.[map[f]];
  return v ?? "∞";
}
