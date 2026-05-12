import { type HomeForecast } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "lucide-react";

const severityColors = {
  critical: "bg-red-500",
  major: "bg-orange-500",
  moderate: "bg-amber-400",
};

export function RiskTimeline({ forecast }: { forecast: HomeForecast }) {
  const predictions = forecast.systemPredictions
    .filter(sp => sp.prediction.estimatedTimeToFailureMonths != null && sp.prediction.estimatedTimeToFailureMonths <= 24)
    .sort((a, b) => (a.prediction.estimatedTimeToFailureMonths || 0) - (b.prediction.estimatedTimeToFailureMonths || 0));

  if (predictions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Risk Timeline — Next 24 Months
      </h3>

      <div className="relative">
        {/* Timeline bar */}
        <div className="h-2 bg-muted rounded-full relative">
          {/* Year markers */}
          <div className="absolute left-[50%] top-0 bottom-0 w-px bg-border" />
        </div>

        {/* Labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Now</span>
          <span>12 months</span>
          <span>24 months</span>
        </div>

        {/* System markers */}
        <div className="mt-3 space-y-2">
          {predictions.map(sp => {
            const months = sp.prediction.estimatedTimeToFailureMonths || 0;
            const position = Math.min(100, (months / 24) * 100);
            const severity = sp.prediction.severityIfFailure;
            const prob12 = Math.round(sp.prediction.failureProbability12Months * 100);

            return (
              <div key={sp.systemId} className="relative h-8 flex items-center">
                <div className="absolute left-0 text-xs text-muted-foreground w-28 truncate">{sp.systemName}</div>
                <div className="ml-28 flex-1 relative h-1.5 bg-muted/50 rounded-full">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${severityColors[severity]} border-2 border-background cursor-pointer hover:scale-125 transition-transform`}
                        style={{ left: `${position}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{sp.systemName}</p>
                      <p className="text-xs">~{months} months estimated · {prob12}% risk in 12mo</p>
                      <p className="text-xs capitalize">Severity: {severity}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Major</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate</span>
        </div>
      </div>
    </div>
  );
}
