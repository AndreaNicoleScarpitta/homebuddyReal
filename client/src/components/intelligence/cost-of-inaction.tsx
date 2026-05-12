import { DollarSign, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type HomeForecast } from "@/lib/api";

function formatCost(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

export function CostOfInaction({ forecast }: { forecast: HomeForecast }) {
  const withInaction = forecast.systemPredictions.filter(sp => sp.inactionInsight);
  if (withInaction.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Cost Forecast
      </h3>

      {/* Summary cost ranges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground">Next 12 months</p>
          <p className="text-lg font-semibold font-heading">
            {formatCost(forecast.totalEstimatedCostRange12Months[0])} – {formatCost(forecast.totalEstimatedCostRange12Months[1])}
          </p>
          <p className="text-xs text-muted-foreground">estimated risk-weighted range</p>
        </div>
        <div className="p-3 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground">Next 24 months</p>
          <p className="text-lg font-semibold font-heading">
            {formatCost(forecast.totalEstimatedCostRange24Months[0])} – {formatCost(forecast.totalEstimatedCostRange24Months[1])}
          </p>
          <p className="text-xs text-muted-foreground">estimated risk-weighted range</p>
        </div>
      </div>

      {/* Per-system inaction cards */}
      <div className="space-y-2">
        {withInaction.map(sp => {
          const insight = sp.inactionInsight!;
          const prob = Math.round(insight.probabilityOfCostEvent * 100);
          return (
            <div key={sp.systemId} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{sp.systemName}</span>
                <Badge variant="outline" className="text-xs">{prob}% chance</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{insight.riskSummary}</p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Recommended action {insight.recommendedActionWindow}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
