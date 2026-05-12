import { useQuery } from "@tanstack/react-query";
import { getHome, getHomeIntelligence } from "@/lib/api";
import { Layout } from "@/components/layout";
import { HealthScoreRing } from "@/components/intelligence/health-score-ring";
import { RiskCard } from "@/components/intelligence/risk-card";
import { MissingDataPrompts } from "@/components/intelligence/missing-data-prompt";
import { CostOfInaction } from "@/components/intelligence/cost-of-inaction";
import { RiskTimeline } from "@/components/intelligence/risk-timeline";
import { Brain, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecordActionDialog, RecordOutcomeDialog } from "@/components/learning/outcome-prompt";
import { LearningSummaryCard } from "@/components/learning/learning-summary-card";
import { AvoidedRiskCard } from "@/components/learning/avoided-risk-card";

export default function Intelligence() {
  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const homeId = home?.id;

  const { data: intelligence, isLoading } = useQuery({
    queryKey: ["intelligence", homeId],
    queryFn: () => getHomeIntelligence(homeId!),
    enabled: !!homeId,
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Home Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Structured insights based on your home's systems, age, condition, and maintenance history.
          </p>
          {homeId && (
            <div className="flex gap-2 mt-3">
              <RecordActionDialog homeId={homeId} />
              <RecordOutcomeDialog homeId={homeId} />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="flex justify-center"><div className="w-48 h-48 rounded-full bg-muted animate-pulse" /></div>
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : !intelligence ? (
          <div className="text-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No intelligence data</h3>
            <p className="text-muted-foreground text-sm mt-1">Add home systems to generate insights.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Health Score */}
            <section className="flex justify-center py-4">
              <HealthScoreRing insight={intelligence.insight} />
            </section>

            {/* Top Risks */}
            {intelligence.systems.filter(s => s.conditionStatus !== "good").length > 0 && (
              <section>
                <h2 className="text-lg font-heading font-semibold mb-3">Systems to Watch</h2>
                <div className="space-y-3">
                  {intelligence.systems
                    .filter(s => s.conditionStatus !== "good")
                    .sort((a, b) => b.riskLevel - a.riskLevel)
                    .map(s => <RiskCard key={s.systemId} insight={s} />)}
                </div>
              </section>
            )}

            {/* Systems in Good Shape */}
            {intelligence.systems.filter(s => s.conditionStatus === "good").length > 0 && (
              <section>
                <h2 className="text-lg font-heading font-semibold mb-3">Looking Good</h2>
                <div className="space-y-3">
                  {intelligence.systems
                    .filter(s => s.conditionStatus === "good")
                    .map(s => <RiskCard key={s.systemId} insight={s} />)}
                </div>
              </section>
            )}

            {/* Recommended Actions */}
            {intelligence.insight.upcomingMaintenance.length > 0 && (
              <section>
                <h2 className="text-lg font-heading font-semibold mb-3">Recommended Actions</h2>
                <div className="space-y-2">
                  {intelligence.insight.upcomingMaintenance.slice(0, 8).map((m, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm">{m.action}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {m.systemName}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        m.urgency === "high" ? "bg-red-100 text-red-700" :
                        m.urgency === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {m.urgency}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cost Forecast */}
            <section>
              <CostOfInaction forecast={intelligence.forecast} />
            </section>

            {/* Risk Timeline */}
            <section>
              <RiskTimeline forecast={intelligence.forecast} />
            </section>

            {/* Missing Data */}
            <section>
              <MissingDataPrompts items={intelligence.insight.missingCriticalData} />
            </section>

            {/* Learning Engine */}
            <section>
              <AvoidedRiskCard homeId={homeId!} />
            </section>

            <section>
              <LearningSummaryCard homeId={homeId!} />
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
