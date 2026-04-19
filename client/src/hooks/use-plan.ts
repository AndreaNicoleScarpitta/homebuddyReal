import { useQuery } from "@tanstack/react-query";

export type PlanId = "free" | "plus" | "premium";
export type PlanStatus = "active" | "past_due" | "canceled" | "trialing";

export interface PlanLimits {
  maxHomes: number | null;
  maxSystemsPerHome: number | null;
  maxActiveTasks: number | null;
  maxDocAnalysesPerMonth: number | null;
  maxAiReportsPerMonth: number | null;
  aiTaskSuggestions: boolean;
  seasonalCampaigns: boolean;
  prioritySupport: boolean;
}

export interface PlanUsage {
  homes: number;
  activeTasks: number;
  docAnalysesThisMonth: number;
  aiReportsThisMonth: number;
}

export interface MePlanResponse {
  plan: PlanId;
  planName: string;
  planStatus: PlanStatus;
  planRenewsAt: string | null;
  priceMonthly: number;
  limits: PlanLimits;
  usage: PlanUsage;
  hasStripeCustomer: boolean;
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, premium: 2 };

export function usePlan() {
  const query = useQuery<MePlanResponse>({
    queryKey: ["/api/me/plan"],
    queryFn: async () => {
      const res = await fetch("/api/me/plan", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute
    retry: false,
  });

  const plan = query.data?.plan ?? "free";
  const hasMinPlan = (minimum: PlanId) => PLAN_RANK[plan] >= PLAN_RANK[minimum];

  /** Percent of a limit used, 0-100. Returns 0 for unlimited. */
  const usagePct = (feature: keyof PlanUsage, limit: number | null | undefined): number => {
    if (!limit) return 0;
    const current = query.data?.usage?.[feature] ?? 0;
    return Math.min(100, Math.round((current / limit) * 100));
  };

  /** True if a countable feature is at/over its limit. */
  const isAtLimit = (feature: "homes" | "activeTasks" | "docAnalyses" | "aiReports"): boolean => {
    if (!query.data) return false;
    const { limits, usage } = query.data;
    switch (feature) {
      case "homes":         return limits.maxHomes !== null && usage.homes >= limits.maxHomes;
      case "activeTasks":   return limits.maxActiveTasks !== null && usage.activeTasks >= limits.maxActiveTasks;
      case "docAnalyses":   return limits.maxDocAnalysesPerMonth !== null && usage.docAnalysesThisMonth >= limits.maxDocAnalysesPerMonth;
      case "aiReports":     return limits.maxAiReportsPerMonth !== null && usage.aiReportsThisMonth >= limits.maxAiReportsPerMonth;
    }
  };

  return {
    ...query,
    plan,
    planName: query.data?.planName ?? "Free",
    isPaid: plan !== "free",
    hasMinPlan,
    usagePct,
    isAtLimit,
  };
}
