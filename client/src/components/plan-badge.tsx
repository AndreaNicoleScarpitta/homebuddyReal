import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Home } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";

const PLAN_META = {
  free:    { icon: Home, className: "bg-muted text-muted-foreground border-transparent" },
  plus:    { icon: Sparkles, className: "bg-primary/10 text-primary border-primary/20" },
  premium: { icon: Crown, className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
} as const;

interface PlanBadgeProps {
  /** When true, clicking the badge routes to /pricing. */
  linkToPricing?: boolean;
  /** Compact variant hides the label on small screens. */
  compact?: boolean;
}

export function PlanBadge({ linkToPricing = true, compact = false }: PlanBadgeProps) {
  const { plan, planName, data, isLoading } = usePlan();
  if (isLoading) return null;

  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  const isPastDue = data?.planStatus === "past_due";

  const content = (
    <Badge
      variant="outline"
      className={`gap-1.5 h-6 px-2 font-medium transition-colors ${meta.className} ${isPastDue ? "ring-1 ring-destructive/40" : ""}`}
      data-testid="plan-badge"
    >
      <Icon className="h-3 w-3" />
      <span className={compact ? "hidden sm:inline" : ""}>{planName}</span>
      {isPastDue && <span className="text-destructive ml-0.5 text-[10px] uppercase tracking-wide">!</span>}
    </Badge>
  );

  if (!linkToPricing) return content;
  return (
    <Link href="/pricing" className="no-underline" data-testid="plan-badge-link">
      {content}
    </Link>
  );
}
