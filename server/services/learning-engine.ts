/**
 * Learning Engine — Closes the feedback loop between predictions and outcomes.
 * Analyzes real-world results to calibrate the intelligence system.
 * No ML — uses weighted statistical adjustments.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemReliabilityProfile {
  systemType: string;
  sampleSize: number;
  averageFailureAge: number | null;
  maintenanceImpactScore: number; // 0-1, how much maintenance reduces failures
  variance: number;
  confidence: number; // 0-100
}

export interface LearningAdjustment {
  parameterKey: string;
  parameterValue: number;
  reason: string;
  dataPoints: number;
  confidence: number;
}

export interface HomeLearningProfile {
  homeId: number;
  behaviorPattern: "proactive" | "reactive" | "neglectful" | "unknown";
  maintenanceComplianceRate: number; // 0-1
  averageResponseTimeDays: number | null;
  riskAdjustmentFactor: number; // multiplier: <1 = reduce risk, >1 = increase risk
  totalActions: number;
  totalOutcomes: number;
}

export interface LearningSummary {
  homeProfile: HomeLearningProfile;
  systemReliability: SystemReliabilityProfile[];
  adjustments: LearningAdjustment[];
  predictionAccuracy: {
    totalPredictions: number;
    accurateCount: number;
    accuracyRate: number;
    falsePositiveRate: number;
  };
  narrative: string;
}

// ---------------------------------------------------------------------------
// Home Behavior Analysis
// ---------------------------------------------------------------------------

export async function analyzeHomeBehavior(homeId: number): Promise<HomeLearningProfile> {
  // Count actions by type
  const actionsResult = await db.execute(sql`
    SELECT action_type, COUNT(*) as count FROM user_actions
    WHERE home_id = ${homeId}
    GROUP BY action_type
  `);

  const actionCounts: Record<string, number> = {};
  let totalActions = 0;
  for (const row of actionsResult.rows) {
    const r = row as any;
    actionCounts[r.action_type] = parseInt(r.count);
    totalActions += parseInt(r.count);
  }

  // Count outcomes
  const outcomesResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM outcome_events WHERE home_id = ${homeId}
  `);
  const totalOutcomes = parseInt((outcomesResult.rows[0] as any)?.count || "0");

  // Calculate compliance rate
  const completedTasks = (actionCounts["completed_task"] || 0) + (actionCounts["manual_fix"] || 0) + (actionCounts["hired_contractor"] || 0);
  const ignoredTasks = actionCounts["ignored_task"] || 0;
  const deferredTasks = actionCounts["deferred"] || 0;
  const totalDecisions = completedTasks + ignoredTasks + deferredTasks;
  const complianceRate = totalDecisions > 0 ? completedTasks / totalDecisions : 0.5;

  // Average response time (days between recommendation creation and action)
  const responseResult = await db.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (ua.action_date - r.created_at)) / 86400) as avg_days
    FROM user_actions ua
    JOIN recommendations r ON r.id = ua.related_recommendation_id
    WHERE ua.home_id = ${homeId} AND ua.related_recommendation_id IS NOT NULL
  `);
  const avgResponseDays = (responseResult.rows[0] as any)?.avg_days
    ? Math.round(parseFloat((responseResult.rows[0] as any).avg_days))
    : null;

  // Determine behavior pattern
  let behaviorPattern: "proactive" | "reactive" | "neglectful" | "unknown" = "unknown";
  if (totalDecisions >= 3) {
    if (complianceRate >= 0.7) behaviorPattern = "proactive";
    else if (complianceRate >= 0.4) behaviorPattern = "reactive";
    else behaviorPattern = "neglectful";
  }

  // Risk adjustment: proactive users get lower risk, neglectful get higher
  let riskAdjustmentFactor = 1.0;
  if (behaviorPattern === "proactive") riskAdjustmentFactor = 0.85;
  else if (behaviorPattern === "neglectful") riskAdjustmentFactor = 1.2;
  else if (behaviorPattern === "reactive") riskAdjustmentFactor = 1.05;

  return {
    homeId,
    behaviorPattern,
    maintenanceComplianceRate: Math.round(complianceRate * 100) / 100,
    averageResponseTimeDays: avgResponseDays,
    riskAdjustmentFactor,
    totalActions,
    totalOutcomes,
  };
}

// ---------------------------------------------------------------------------
// System Reliability Profiles
// ---------------------------------------------------------------------------

export async function computeSystemReliability(homeId: number): Promise<SystemReliabilityProfile[]> {
  // Get outcomes grouped by system category
  const result = await db.execute(sql`
    SELECT s.category,
           COUNT(DISTINCT oe.id) as outcome_count,
           COUNT(DISTINCT CASE WHEN oe.outcome_type = 'failure' THEN oe.id END) as failure_count,
           COUNT(DISTINCT CASE WHEN oe.outcome_type = 'avoided_issue' THEN oe.id END) as avoided_count,
           COUNT(DISTINCT CASE WHEN oe.outcome_type = 'improved' THEN oe.id END) as improved_count,
           AVG(s.install_year) as avg_install_year,
           AVG(CASE WHEN oe.outcome_type = 'failure' THEN EXTRACT(YEAR FROM oe.occurred_at) - s.install_year END) as avg_failure_age
    FROM systems s
    LEFT JOIN outcome_events oe ON oe.system_id = s.id
    WHERE s.home_id = ${homeId}
    GROUP BY s.category
  `);

  return result.rows.map((row: any) => {
    const outcomeCount = parseInt(row.outcome_count || "0");
    const failureCount = parseInt(row.failure_count || "0");
    const avoidedCount = parseInt(row.avoided_count || "0");
    const improvedCount = parseInt(row.improved_count || "0");

    // Maintenance impact: ratio of avoided/improved to total outcomes
    const positiveOutcomes = avoidedCount + improvedCount;
    const maintenanceImpact = outcomeCount > 0 ? positiveOutcomes / outcomeCount : 0.5;

    // Confidence based on sample size
    const confidence = Math.min(100, Math.round(outcomeCount * 15 + 10));

    return {
      systemType: row.category || "Other",
      sampleSize: outcomeCount,
      averageFailureAge: row.avg_failure_age ? Math.round(parseFloat(row.avg_failure_age)) : null,
      maintenanceImpactScore: Math.round(maintenanceImpact * 100) / 100,
      variance: outcomeCount > 2 ? 0.3 : 0.6, // Lower variance with more data
      confidence,
    };
  });
}

// ---------------------------------------------------------------------------
// Compute Learning Adjustments
// ---------------------------------------------------------------------------

export async function computeAdjustments(homeId: number): Promise<LearningAdjustment[]> {
  const adjustments: LearningAdjustment[] = [];
  const profile = await analyzeHomeBehavior(homeId);
  const reliability = await computeSystemReliability(homeId);

  // Adjustment 1: User behavior risk modifier
  if (profile.totalActions >= 3) {
    adjustments.push({
      parameterKey: "risk_adjustment_factor",
      parameterValue: profile.riskAdjustmentFactor,
      reason: profile.behaviorPattern === "proactive"
        ? "You consistently maintain your home, which reduces risk."
        : profile.behaviorPattern === "neglectful"
        ? "Deferred maintenance increases risk of unexpected issues."
        : "Your maintenance habits are factored into your risk profile.",
      dataPoints: profile.totalActions,
      confidence: Math.min(90, profile.totalActions * 10),
    });
  }

  // Adjustment 2: Per-category reliability adjustments
  for (const rel of reliability) {
    if (rel.sampleSize >= 2) {
      // If actual failure age is lower than expected, shift risk curve
      if (rel.averageFailureAge !== null) {
        adjustments.push({
          parameterKey: `lifecycle_shift_${rel.systemType}`,
          parameterValue: rel.averageFailureAge,
          reason: `Based on ${rel.sampleSize} outcomes, your ${rel.systemType} systems tend to last about ${rel.averageFailureAge} years.`,
          dataPoints: rel.sampleSize,
          confidence: rel.confidence,
        });
      }

      // If maintenance clearly helps, boost maintenance gap rule weight
      if (rel.maintenanceImpactScore > 0.6) {
        adjustments.push({
          parameterKey: `maintenance_weight_${rel.systemType}`,
          parameterValue: 1.3, // 30% boost to maintenance importance
          reason: `Maintenance has a strong positive impact on your ${rel.systemType} systems.`,
          dataPoints: rel.sampleSize,
          confidence: rel.confidence,
        });
      }
    }
  }

  return adjustments;
}

// ---------------------------------------------------------------------------
// Save Adjustments to DB
// ---------------------------------------------------------------------------

export async function persistAdjustments(homeId: number, adjustments: LearningAdjustment[]): Promise<void> {
  for (const adj of adjustments) {
    await db.execute(sql`
      INSERT INTO learning_adjustments (home_id, parameter_key, parameter_value, reason, data_points, confidence, updated_at)
      VALUES (${homeId}, ${adj.parameterKey}, ${String(adj.parameterValue)}, ${adj.reason}, ${adj.dataPoints}, ${adj.confidence}, now())
      ON CONFLICT ON CONSTRAINT learning_adjustments_home_param_unique
      DO UPDATE SET parameter_value = ${String(adj.parameterValue)}, reason = ${adj.reason},
                    data_points = ${adj.dataPoints}, confidence = ${adj.confidence}, updated_at = now()
    `);
  }
}

// ---------------------------------------------------------------------------
// Load Adjustments for a Home
// ---------------------------------------------------------------------------

export async function loadAdjustments(homeId: number): Promise<Record<string, number>> {
  const result = await db.execute(sql`
    SELECT parameter_key, parameter_value FROM learning_adjustments
    WHERE home_id = ${homeId} AND confidence >= 30
  `);
  const params: Record<string, number> = {};
  for (const row of result.rows) {
    const r = row as any;
    params[r.parameter_key] = parseFloat(r.parameter_value);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Prediction Accuracy
// ---------------------------------------------------------------------------

export async function computePredictionAccuracy(homeId: number): Promise<{
  totalPredictions: number;
  accurateCount: number;
  accuracyRate: number;
  falsePositiveRate: number;
}> {
  // Compare outcomes with the systems' risk levels
  // A prediction is "accurate" if high-risk systems had failures and low-risk ones didn't
  const outcomeResult = await db.execute(sql`
    SELECT oe.outcome_type, oe.system_id, s.condition
    FROM outcome_events oe
    JOIN systems s ON s.id = oe.system_id
    WHERE oe.home_id = ${homeId}
  `);

  const total = outcomeResult.rows.length;
  if (total === 0) return { totalPredictions: 0, accurateCount: 0, accuracyRate: 0, falsePositiveRate: 0 };

  let accurate = 0;
  let falsePositives = 0;

  for (const row of outcomeResult.rows) {
    const r = row as any;
    const condition = r.condition || "Unknown";
    const isHighRisk = condition === "Poor" || condition === "Fair";
    const hadFailure = r.outcome_type === "failure" || r.outcome_type === "degraded";

    if ((isHighRisk && hadFailure) || (!isHighRisk && !hadFailure)) {
      accurate++;
    }
    if (isHighRisk && !hadFailure) {
      falsePositives++;
    }
  }

  return {
    totalPredictions: total,
    accurateCount: accurate,
    accuracyRate: Math.round((accurate / total) * 100) / 100,
    falsePositiveRate: Math.round((falsePositives / total) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Full Learning Summary
// ---------------------------------------------------------------------------

export async function computeLearningSummary(homeId: number): Promise<LearningSummary> {
  const [homeProfile, systemReliability, adjustments, accuracy] = await Promise.all([
    analyzeHomeBehavior(homeId),
    computeSystemReliability(homeId),
    computeAdjustments(homeId),
    computePredictionAccuracy(homeId),
  ]);

  // Persist adjustments
  if (adjustments.length > 0) {
    await persistAdjustments(homeId, adjustments).catch(() => {});  // Non-fatal
  }

  // Generate narrative
  let narrative = "";
  if (homeProfile.totalActions === 0 && homeProfile.totalOutcomes === 0) {
    narrative = "As you track maintenance actions and outcomes, HomeBuddy will learn from your home's real history to give you more accurate predictions.";
  } else if (homeProfile.totalActions > 0 && homeProfile.totalOutcomes === 0) {
    narrative = `You've recorded ${homeProfile.totalActions} action${homeProfile.totalActions > 1 ? "s" : ""}. Recording outcomes (what actually happened) will help us calibrate our predictions for your home.`;
  } else {
    const dataPoints = homeProfile.totalActions + homeProfile.totalOutcomes;
    narrative = `HomeBuddy is learning from ${dataPoints} data point${dataPoints > 1 ? "s" : ""} about your home. `;
    if (homeProfile.behaviorPattern === "proactive") {
      narrative += "Your consistent maintenance is reducing your home's risk profile.";
    } else if (homeProfile.behaviorPattern === "reactive") {
      narrative += "Staying ahead of maintenance can prevent costly surprises.";
    }
    if (accuracy.totalPredictions > 0) {
      narrative += ` Our predictions have been ${Math.round(accuracy.accuracyRate * 100)}% accurate so far.`;
    }
  }

  return {
    homeProfile,
    systemReliability,
    adjustments,
    predictionAccuracy: accuracy,
    narrative,
  };
}
