import { useQuery } from "@tanstack/react-query";
import { getLearningSummary, type LearningSummary } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Shield, Activity } from "lucide-react";

const behaviorColors = {
  proactive: "bg-green-100 text-green-700",
  reactive: "bg-amber-100 text-amber-700",
  neglectful: "bg-red-100 text-red-700",
  unknown: "bg-gray-100 text-gray-600",
};

const behaviorLabels = {
  proactive: "Proactive",
  reactive: "Reactive",
  neglectful: "Needs Attention",
  unknown: "Getting Started",
};

export function LearningSummaryCard({ homeId }: { homeId: number | string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["learning-summary", homeId],
    queryFn: () => getLearningSummary(homeId),
    enabled: !!homeId,
  });

  if (isLoading || !summary) return null;

  const { homeProfile, predictionAccuracy, narrative } = summary;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Brain className="h-4 w-4" />
        Learning Engine
      </h3>

      <p className="text-sm text-muted-foreground">{narrative}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border bg-card text-center">
          <Activity className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-semibold">{homeProfile.totalActions}</p>
          <p className="text-xs text-muted-foreground">Actions</p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-semibold">{homeProfile.totalOutcomes}</p>
          <p className="text-xs text-muted-foreground">Outcomes</p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <Shield className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-semibold">{Math.round(homeProfile.maintenanceComplianceRate * 100)}%</p>
          <p className="text-xs text-muted-foreground">Compliance</p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <Badge variant="outline" className={`text-xs ${behaviorColors[homeProfile.behaviorPattern]}`}>
            {behaviorLabels[homeProfile.behaviorPattern]}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">Pattern</p>
        </div>
      </div>

      {predictionAccuracy.totalPredictions > 0 && (
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Prediction accuracy</span>
            <span className="text-sm font-semibold">{Math.round(predictionAccuracy.accuracyRate * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${predictionAccuracy.accuracyRate * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Based on {predictionAccuracy.totalPredictions} outcomes</p>
        </div>
      )}
    </div>
  );
}
