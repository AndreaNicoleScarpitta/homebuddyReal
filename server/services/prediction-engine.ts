/**
 * Prediction Engine — Rule-based probabilistic failure prediction and cost modeling.
 * Uses logistic curve for failure probability, static cost ranges, and cost-of-inaction analysis.
 * No ML, no LLM. Fully deterministic and explainable.
 */

import {
  type SystemContext,
  type SystemEvaluation,
  getLifecycleData,
  COST_RANGES,
} from "./rules-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemPrediction {
  failureProbability12Months: number;  // 0-1
  failureProbability24Months: number;  // 0-1
  estimatedTimeToFailureMonths: number | null;
  severityIfFailure: "critical" | "major" | "moderate";
  confidenceScore: number;
}

export interface SystemCostProjection {
  repairCostRange: [number, number];       // [min, max] in cents
  replacementCostRange: [number, number];  // [min, max] in cents
}

export interface InactionInsight {
  riskSummary: string;
  probabilityOfCostEvent: number;  // 0-1
  estimatedFinancialImpact: [number, number];  // [min, max] in cents
  recommendedActionWindow: string;
}

export interface HomeForecast {
  systemPredictions: Array<{
    systemId: number;
    systemName: string;
    systemCategory: string;
    prediction: SystemPrediction;
    costProjection: SystemCostProjection;
    inactionInsight: InactionInsight | null;
  }>;
  totalEstimatedCostRange12Months: [number, number];
  totalEstimatedCostRange24Months: [number, number];
  highestPriorityInterventions: Array<{
    systemId: number;
    systemName: string;
    action: string;
    urgency: string;
    estimatedCost: string;
  }>;
}

// ---------------------------------------------------------------------------
// Severity by system type
// ---------------------------------------------------------------------------

const SEVERITY_MAP: Record<string, "critical" | "major" | "moderate"> = {
  "Roof": "critical",
  "Foundation": "critical",
  "Electrical": "critical",
  "HVAC": "major",
  "Plumbing": "major",
  "Water Heater": "major",
  "Windows": "moderate",
  "Siding/Exterior": "moderate",
  "Chimney": "moderate",
  "Appliances": "moderate",
  "Landscaping": "moderate",
  "Paint": "moderate",
  "Pest": "moderate",
  "Other": "moderate",
};

// ---------------------------------------------------------------------------
// Failure Probability — Logistic curve
// ---------------------------------------------------------------------------

function logistic(x: number, midpoint: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

export function computeFailureProbability(
  ageRatio: number,
  condition: string | null,
  recentRepairCount: number,
  windowMonths: 12 | 24,
  riskAdjustmentFactor?: number
): number {
  // Base probability from age ratio using logistic curve
  // Centered at 0.85 (85% of lifespan) with steepness 10
  let prob = logistic(ageRatio, 0.85, 10);

  // Extend probability for 24-month window
  if (windowMonths === 24) {
    prob = 1 - Math.pow(1 - prob, 2); // 1 - (1-p)^2 for two independent periods
  }

  // Condition modifiers
  if (condition === "Poor") prob = Math.min(1, prob + 0.2);
  else if (condition === "Fair") prob = Math.min(1, prob + 0.1);
  else if (condition === "Great") prob = Math.max(0, prob - 0.1);

  // Repair frequency modifier
  if (recentRepairCount >= 3) prob = Math.min(1, prob + 0.15);
  else if (recentRepairCount >= 2) prob = Math.min(1, prob + 0.1);

  // Apply home-specific learning adjustment
  if (riskAdjustmentFactor && riskAdjustmentFactor !== 1.0) {
    prob = Math.min(1, Math.max(0, prob * riskAdjustmentFactor));
  }

  return Math.round(prob * 100) / 100; // Round to 2 decimals
}

export function computeSystemPrediction(
  ctx: SystemContext,
  evaluation: SystemEvaluation,
  riskAdjustmentFactor?: number
): SystemPrediction {
  const lifecycle = getLifecycleData(ctx.system.category, ctx.system.material);
  const avgLifespan = (lifecycle.minYears + lifecycle.maxYears) / 2;
  const age = evaluation.estimatedAge;
  const ageRatio = age !== null ? age / avgLifespan : 0.5; // Default to mid-life if unknown

  const recentRepairs = ctx.repairs.filter(r => {
    if (!r.repairDate) return false;
    const d = new Date(r.repairDate);
    const monthsAgo = (ctx.currentDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return monthsAgo <= 24;
  }).length;

  const prob12 = computeFailureProbability(ageRatio, ctx.system.condition, recentRepairs, 12, riskAdjustmentFactor);
  const prob24 = computeFailureProbability(ageRatio, ctx.system.condition, recentRepairs, 24, riskAdjustmentFactor);

  // Confidence: lower if we don't have install year or condition
  let confidence = evaluation.confidenceScore;

  return {
    failureProbability12Months: prob12,
    failureProbability24Months: prob24,
    estimatedTimeToFailureMonths: evaluation.remainingLifeMonths,
    severityIfFailure: SEVERITY_MAP[ctx.system.category] || "moderate",
    confidenceScore: confidence,
  };
}

// ---------------------------------------------------------------------------
// Cost Projection
// ---------------------------------------------------------------------------

export function computeCostProjection(category: string): SystemCostProjection {
  const costs = COST_RANGES[category] || COST_RANGES["Other"];
  return {
    repairCostRange: [costs.repairMin, costs.repairMax],
    replacementCostRange: [costs.replaceMin, costs.replaceMax],
  };
}

// ---------------------------------------------------------------------------
// Cost of Inaction
// ---------------------------------------------------------------------------

export function computeInactionInsight(
  ctx: SystemContext,
  prediction: SystemPrediction,
  costProjection: SystemCostProjection
): InactionInsight | null {
  // Only generate inaction insights for systems with meaningful risk
  if (prediction.failureProbability12Months < 0.1) return null;

  const prob = prediction.failureProbability12Months;
  const severity = prediction.severityIfFailure;

  // Financial impact is weighted toward replacement cost for high probability
  const impactMin = costProjection.repairCostRange[0];
  const impactMax = prob > 0.5
    ? costProjection.replacementCostRange[1]
    : costProjection.replacementCostRange[0];

  // Action window
  let actionWindow: string;
  if (prob > 0.5) actionWindow = "within 6 months";
  else if (prob > 0.3) actionWindow = "within 12 months";
  else actionWindow = "within 18 months";

  // Human-readable summary
  const probPercent = Math.round(prob * 100);
  const costMin = Math.round(impactMin / 100);
  const costMax = Math.round(impactMax / 100);
  const riskSummary = `There's roughly a ${probPercent}% chance your ${ctx.system.name.toLowerCase()} could need $${costMin.toLocaleString()}-$${costMax.toLocaleString()} in work within the next 12 months.`;

  return {
    riskSummary,
    probabilityOfCostEvent: prob,
    estimatedFinancialImpact: [impactMin, impactMax],
    recommendedActionWindow: actionWindow,
  };
}

// ---------------------------------------------------------------------------
// Home Forecast — Aggregate predictions
// ---------------------------------------------------------------------------

export function computeHomeForecast(
  systemResults: Array<{
    systemId: number;
    systemName: string;
    systemCategory: string;
    ctx: SystemContext;
    evaluation: SystemEvaluation;
  }>,
  riskAdjustmentFactor?: number
): HomeForecast {
  const systemPredictions = systemResults.map(({ systemId, systemName, systemCategory, ctx, evaluation }) => {
    const prediction = computeSystemPrediction(ctx, evaluation, riskAdjustmentFactor);
    const costProjection = computeCostProjection(systemCategory);
    const inactionInsight = computeInactionInsight(ctx, prediction, costProjection);
    return { systemId, systemName, systemCategory, prediction, costProjection, inactionInsight };
  });

  // Aggregate cost ranges
  let min12 = 0, max12 = 0, min24 = 0, max24 = 0;
  for (const sp of systemPredictions) {
    const expectedRepair12 = sp.prediction.failureProbability12Months * sp.costProjection.repairCostRange[0];
    const expectedMax12 = sp.prediction.failureProbability12Months * sp.costProjection.replacementCostRange[1];
    min12 += expectedRepair12;
    max12 += expectedMax12;

    const expectedRepair24 = sp.prediction.failureProbability24Months * sp.costProjection.repairCostRange[0];
    const expectedMax24 = sp.prediction.failureProbability24Months * sp.costProjection.replacementCostRange[1];
    min24 += expectedRepair24;
    max24 += expectedMax24;
  }

  // Priority interventions: systems with highest risk
  const highestPriority = systemPredictions
    .filter(sp => sp.prediction.failureProbability12Months > 0.15 || sp.inactionInsight)
    .sort((a, b) => b.prediction.failureProbability12Months - a.prediction.failureProbability12Months)
    .slice(0, 5)
    .map(sp => {
      const costs = COST_RANGES[sp.systemCategory] || COST_RANGES["Other"];
      return {
        systemId: sp.systemId,
        systemName: sp.systemName,
        action: sp.inactionInsight ? `Address ${sp.systemName.toLowerCase()} ${sp.inactionInsight.recommendedActionWindow}` : `Monitor ${sp.systemName.toLowerCase()}`,
        urgency: sp.prediction.failureProbability12Months > 0.5 ? "high" : sp.prediction.failureProbability12Months > 0.3 ? "medium" : "low",
        estimatedCost: `$${Math.round(costs.repairMin / 100).toLocaleString()}-$${Math.round(costs.replaceMax / 100).toLocaleString()}`,
      };
    });

  return {
    systemPredictions,
    totalEstimatedCostRange12Months: [Math.round(min12), Math.round(max12)],
    totalEstimatedCostRange24Months: [Math.round(min24), Math.round(max24)],
    highestPriorityInterventions: highestPriority,
  };
}
