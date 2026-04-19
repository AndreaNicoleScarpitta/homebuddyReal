import { useQuery } from "@tanstack/react-query";
import { getOutcomes, type OutcomeEvent } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

export function AvoidedRiskCard({ homeId }: { homeId: number | string }) {
  const { data: outcomes = [] } = useQuery({
    queryKey: ["outcomes", homeId],
    queryFn: () => getOutcomes(homeId),
    enabled: !!homeId,
  });

  const avoided = outcomes.filter((o: OutcomeEvent) => o.outcome_type === "avoided_issue" || o.outcome_type === "improved");
  if (avoided.length === 0) return null;

  return (
    <div className="p-4 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-sm text-green-700 dark:text-green-400">
          {avoided.length} issue{avoided.length > 1 ? "s" : ""} avoided or improved
        </h4>
      </div>
      <p className="text-sm text-green-600 dark:text-green-400">
        Your maintenance decisions have kept your home running smoothly. Keep it up.
      </p>
    </div>
  );
}
