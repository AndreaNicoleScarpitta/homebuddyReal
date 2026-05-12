import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Info, ShieldCheck, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";
import { Link } from "wouter";

interface HomeHealthProps {
  score: number;
  systemsCount?: number;
  tasksCount?: number;
  urgentTasksCount?: number;
  overdueTasksCount?: number;
  poorSystemsCount?: number;
}

type HealthTier = "healthy" | "watch" | "needs-attention" | "unknown";

function getHealthTier(
  score: number, 
  systemsCount: number, 
  urgentTasksCount: number = 0,
  overdueTasksCount: number = 0,
  poorSystemsCount: number = 0
): { tier: HealthTier; label: string; description: string; actionParts: { text: string; link?: string }[] } {
  if (systemsCount === 0) {
    return {
      tier: "unknown",
      label: "Getting Started",
      description: "Add your home systems to see your health status",
      actionParts: []
    };
  }
  
  if (urgentTasksCount > 0 || overdueTasksCount > 0 || poorSystemsCount > 0) {
    const actionParts: { text: string; link?: string }[] = [];
    if (urgentTasksCount > 0) {
      actionParts.push({ text: `${urgentTasksCount} urgent task${urgentTasksCount > 1 ? 's' : ''}`, link: "/maintenance-log" });
    }
    if (overdueTasksCount > 0) {
      if (actionParts.length > 0) actionParts.push({ text: ", " });
      actionParts.push({ text: `${overdueTasksCount} overdue`, link: "/maintenance-log" });
    }
    if (poorSystemsCount > 0) {
      if (actionParts.length > 0) actionParts.push({ text: ", " });
      actionParts.push({ text: `${poorSystemsCount} system${poorSystemsCount > 1 ? 's' : ''} in poor condition`, link: "/systems" });
    }
    
    return {
      tier: "needs-attention",
      label: "Needs Attention",
      description: "",
      actionParts
    };
  }
  
  if (score >= 80) {
    return {
      tier: "healthy",
      label: "Healthy",
      description: "Your home is well-maintained with no urgent concerns",
      actionParts: []
    };
  }
  
  if (score >= 50) {
    return {
      tier: "watch",
      label: "Watch List",
      description: "A few items need attention soon, but nothing critical",
      actionParts: [{ text: "View maintenance tasks", link: "/maintenance-log" }]
    };
  }
  
  return {
    tier: "needs-attention",
    label: "Needs Attention",
    description: "Some repairs should be addressed to protect your home",
    actionParts: [{ text: "View tasks", link: "/maintenance-log" }]
  };
}

function getTierStyles(tier: HealthTier) {
  switch (tier) {
    case "healthy":
      return {
        icon: ShieldCheck,
        iconColor: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
        badgeClass: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
      };
    case "watch":
      return {
        icon: AlertTriangle,
        iconColor: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800",
        badgeClass: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      };
    case "needs-attention":
      return {
        icon: AlertCircle,
        iconColor: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        borderColor: "border-orange-200 dark:border-orange-800",
        badgeClass: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
      };
    default:
      return {
        icon: HelpCircle,
        iconColor: "text-muted-foreground",
        bgColor: "bg-muted/30",
        borderColor: "border-muted",
        badgeClass: "bg-muted text-muted-foreground border-muted"
      };
  }
}

export function HomeHealth({ 
  score, 
  systemsCount = 0, 
  tasksCount = 0,
  urgentTasksCount = 0,
  overdueTasksCount = 0,
  poorSystemsCount = 0
}: HomeHealthProps) {
  const { tier, label, description, actionParts } = getHealthTier(score, systemsCount, urgentTasksCount, overdueTasksCount, poorSystemsCount);
  const styles = getTierStyles(tier);
  const TierIcon = styles.icon;

  return (
    <Card className={`h-full border shadow-none ${styles.bgColor} ${styles.borderColor}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full ${styles.bgColor} border-2 ${styles.borderColor} flex items-center justify-center shrink-0`}>
            <TierIcon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-sm font-medium px-2.5 py-0.5 ${styles.badgeClass}`}>
                {label}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">How is this calculated?</p>
                  <p className="text-sm">Based on your system conditions, pending tasks, and completed repairs.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {description}
              </p>
            )}
            {actionParts.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {actionParts.map((part, i) =>
                  part.link ? (
                    <Link
                      key={i}
                      href={part.link}
                      className="font-medium text-foreground underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
                      data-testid={`link-health-action-${i}`}
                    >
                      {part.text}
                    </Link>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </p>
            )}
          </div>
        </div>

        {tier === "unknown" && (
          <p className="text-sm text-muted-foreground">
            Add your HVAC, roof, plumbing, and other systems to get a health assessment.
          </p>
        )}

        {tier !== "unknown" && (systemsCount > 0 || tasksCount > 0) && (
          <p className="text-xs text-muted-foreground">
            {systemsCount > 0 && `${systemsCount} system${systemsCount > 1 ? 's' : ''} tracked`}
            {systemsCount > 0 && tasksCount > 0 && ' · '}
            {tasksCount > 0 && (
              <Link
                href="/maintenance-log"
                className="hover:text-foreground transition-colors underline underline-offset-2"
                data-testid="link-health-tasks"
              >
                {tasksCount} active task{tasksCount > 1 ? 's' : ''}
              </Link>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
