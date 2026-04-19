import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, CheckCircle } from "lucide-react";
import { type SystemInsight } from "@/lib/api";

const statusConfig = {
  "good": { label: "Good", icon: CheckCircle, bg: "bg-green-100 text-green-700", border: "border-green-200" },
  "watch": { label: "Watch", icon: Eye, bg: "bg-amber-100 text-amber-700", border: "border-amber-200" },
  "at-risk": { label: "At Risk", icon: AlertTriangle, bg: "bg-red-100 text-red-700", border: "border-red-200" },
};

export function RiskCard({ insight }: { insight: SystemInsight }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[insight.conditionStatus];
  const Icon = config.icon;

  const mainFinding = insight.keyFindings[0] || "No specific concerns at this time.";

  return (
    <div className={`rounded-lg border ${config.border} bg-card p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${config.bg}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{insight.systemName}</span>
              <Badge variant="outline" className={`text-xs ${config.bg}`}>{config.label}</Badge>
              {insight.confidenceScore < 60 && (
                <span className="text-xs text-muted-foreground">({insight.confidenceScore}% confidence)</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{mainFinding}</p>
            {insight.estimatedAge != null && insight.expectedLifespanYears != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Age: {insight.estimatedAge}y / Expected lifespan: {Math.round(insight.expectedLifespanYears)}y
                {insight.remainingLifeEstimateMonths != null && ` · ~${Math.round(insight.remainingLifeEstimateMonths / 12)}y remaining`}
              </p>
            )}
          </div>
        </div>
        {(insight.keyFindings.length > 1 || insight.recommendedActions.length > 0) && (
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {insight.keyFindings.length > 1 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Findings</h5>
              <ul className="space-y-1">
                {insight.keyFindings.map((f, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-muted-foreground/50 mt-1">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insight.recommendedActions.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Recommended Actions</h5>
              <ul className="space-y-1">
                {insight.recommendedActions.map((a, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
