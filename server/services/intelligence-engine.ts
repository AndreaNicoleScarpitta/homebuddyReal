/**
 * Intelligence Engine — Orchestrator that loads Home Graph data, evaluates systems,
 * and produces structured intelligence outputs.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  type SystemContext,
  type SystemData,
  evaluateSystem,
  SYSTEM_WEIGHTS,
} from "./rules-engine";
import {
  computeSystemPrediction,
  computeCostProjection,
  computeInactionInsight,
  computeHomeForecast,
  type SystemPrediction,
  type SystemCostProjection,
  type InactionInsight,
  type HomeForecast,
} from "./prediction-engine";

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface SystemInsight {
  systemId: number;
  systemType: string;
  systemName: string;
  conditionStatus: "good" | "watch" | "at-risk";
  riskLevel: number;
  remainingLifeEstimateMonths: number | null;
  estimatedAge: number | null;
  expectedLifespanYears: number | null;
  keyFindings: string[];
  recommendedActions: string[];
  missingDataSignals: string[];
  confidenceScore: number;
}

export interface HomeInsight {
  overallHealthScore: number;
  highRiskSystems: Array<{ systemId: number; name: string; riskLevel: number; status: string }>;
  upcomingMaintenance: Array<{ systemId: number; systemName: string; action: string; urgency: string }>;
  missingCriticalData: Array<{ systemId: number; systemName: string; signal: string }>;
  summaryNarrative: string;
}

export interface HomeIntelligenceResponse {
  insight: HomeInsight;
  forecast: HomeForecast;
  systems: SystemInsight[];
}

export interface SystemInsightResponse {
  insight: SystemInsight;
  prediction: SystemPrediction;
  costProjection: SystemCostProjection;
  inactionInsight: InactionInsight | null;
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

async function loadAllSystemContexts(homeId: number): Promise<Array<{ ctx: SystemContext; system: any }>> {
  // Load home for builtYear
  const homeResult = await db.execute(sql`SELECT built_year FROM homes WHERE id = ${homeId}`);
  const homeBuiltYear = homeResult.rows.length > 0 ? (homeResult.rows[0] as any).built_year : null;

  // Load all systems for the home
  const systemsResult = await db.execute(sql`
    SELECT id, category, name, install_year, condition, material, make, model,
           last_service_date, next_service_date, warranty_expiry, entity_type
    FROM systems WHERE home_id = ${homeId} AND (entity_type = 'asset' OR entity_type IS NULL)
    ORDER BY category
  `);

  const contexts: Array<{ ctx: SystemContext; system: any }> = [];

  for (const sysRow of systemsResult.rows) {
    const sys = sysRow as any;
    const systemId = sys.id;

    // Load related data in parallel
    const [warrantiesRes, repairsRes, replacementsRes, tasksRes, componentsRes] = await Promise.all([
      db.execute(sql`SELECT expiry_date, warranty_type, coverage_summary FROM warranties WHERE system_id = ${systemId}`),
      db.execute(sql`SELECT repair_date, cost, outcome, title FROM repairs WHERE system_id = ${systemId} ORDER BY repair_date DESC`),
      db.execute(sql`SELECT replacement_date, cost, reason FROM replacements WHERE system_id = ${systemId}`),
      db.execute(sql`SELECT status, urgency, due_date, completed_at FROM maintenance_tasks WHERE related_system_id = ${systemId}`),
      db.execute(sql`SELECT condition, install_year, name FROM components WHERE system_id = ${systemId}`),
    ]);

    const systemData: SystemData = {
      id: sys.id,
      category: sys.category || "Other",
      name: sys.name,
      installYear: sys.install_year,
      condition: sys.condition,
      material: sys.material,
      make: sys.make,
      model: sys.model,
      lastServiceDate: sys.last_service_date,
      nextServiceDate: sys.next_service_date,
      warrantyExpiry: sys.warranty_expiry,
    };

    const ctx: SystemContext = {
      system: systemData,
      warranties: warrantiesRes.rows.map((r: any) => ({
        expiryDate: r.expiry_date,
        warrantyType: r.warranty_type,
        coverageSummary: r.coverage_summary,
      })),
      repairs: repairsRes.rows.map((r: any) => ({
        repairDate: r.repair_date,
        cost: r.cost,
        outcome: r.outcome,
        title: r.title,
      })),
      replacements: replacementsRes.rows.map((r: any) => ({
        replacementDate: r.replacement_date,
        cost: r.cost,
        reason: r.reason,
      })),
      tasks: tasksRes.rows.map((r: any) => ({
        status: r.status,
        urgency: r.urgency,
        dueDate: r.due_date,
        completedAt: r.completed_at,
      })),
      components: componentsRes.rows.map((r: any) => ({
        condition: r.condition,
        installYear: r.install_year,
        name: r.name,
      })),
      homeBuiltYear,
      currentDate: new Date(),
    };

    contexts.push({ ctx, system: sys });
  }

  return contexts;
}

// ---------------------------------------------------------------------------
// Compute System Insight
// ---------------------------------------------------------------------------

function toConditionStatus(riskLevel: number): "good" | "watch" | "at-risk" {
  if (riskLevel >= 40) return "at-risk";
  if (riskLevel >= 20) return "watch";
  return "good";
}

function computeSystemInsightFromContext(ctx: SystemContext): SystemInsight {
  const evaluation = evaluateSystem(ctx);
  return {
    systemId: ctx.system.id,
    systemType: ctx.system.category,
    systemName: ctx.system.name,
    conditionStatus: toConditionStatus(evaluation.riskLevel),
    riskLevel: evaluation.riskLevel,
    remainingLifeEstimateMonths: evaluation.remainingLifeMonths,
    estimatedAge: evaluation.estimatedAge,
    expectedLifespanYears: evaluation.expectedLifespanYears,
    keyFindings: evaluation.keyFindings,
    recommendedActions: evaluation.recommendedActions,
    missingDataSignals: evaluation.missingDataSignals,
    confidenceScore: evaluation.confidenceScore,
  };
}

// ---------------------------------------------------------------------------
// Generate Summary Narrative
// ---------------------------------------------------------------------------

function generateNarrative(healthScore: number, systemInsights: SystemInsight[]): string {
  const atRiskCount = systemInsights.filter(s => s.conditionStatus === "at-risk").length;
  const watchCount = systemInsights.filter(s => s.conditionStatus === "watch").length;
  const totalMissing = systemInsights.reduce((sum, s) => sum + s.missingDataSignals.length, 0);

  if (systemInsights.length === 0) {
    return "Add your home systems to get personalized insights and recommendations.";
  }

  let narrative = "";
  if (healthScore >= 80) {
    narrative = "Your home is in good overall shape.";
  } else if (healthScore >= 60) {
    narrative = "Your home is doing well, with a few areas to keep an eye on.";
  } else if (healthScore >= 40) {
    narrative = "Your home needs some attention — a few systems could use care.";
  } else {
    narrative = "Your home has several systems that need attention soon.";
  }

  if (atRiskCount > 0) {
    narrative += ` ${atRiskCount} system${atRiskCount > 1 ? "s" : ""} may need action soon.`;
  }
  if (watchCount > 0 && atRiskCount === 0) {
    narrative += ` ${watchCount} system${watchCount > 1 ? "s are" : " is"} worth monitoring.`;
  }
  if (totalMissing > 0) {
    narrative += ` Adding more details about your systems will improve these insights.`;
  }

  return narrative;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function computeHomeIntelligence(homeId: number): Promise<HomeIntelligenceResponse> {
  const allContexts = await loadAllSystemContexts(homeId);

  // Load learning adjustments (non-fatal if fails)
  let learningParams: Record<string, number> = {};
  try {
    const { loadAdjustments } = await import("./learning-engine");
    learningParams = await loadAdjustments(homeId);
  } catch {
    // Non-fatal: default to no adjustments
  }
  const riskAdjustmentFactor = learningParams["risk_adjustment_factor"] ?? 1.0;

  // Compute insights for each system
  const systemInsights: SystemInsight[] = allContexts.map(({ ctx }) => computeSystemInsightFromContext(ctx));

  // Compute health score (weighted average of 100 - riskLevel)
  let weightedSum = 0;
  let totalWeight = 0;
  for (const insight of systemInsights) {
    const weight = SYSTEM_WEIGHTS[insight.systemType] || 1.0;
    weightedSum += (100 - insight.riskLevel) * weight;
    totalWeight += weight;
  }
  const overallHealthScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Collect high-risk systems
  const highRiskSystems = systemInsights
    .filter(s => s.riskLevel >= 30)
    .sort((a, b) => b.riskLevel - a.riskLevel)
    .map(s => ({ systemId: s.systemId, name: s.systemName, riskLevel: s.riskLevel, status: s.conditionStatus }));

  // Collect upcoming maintenance actions
  const upcomingMaintenance = systemInsights
    .flatMap(s => s.recommendedActions.map(action => ({
      systemId: s.systemId,
      systemName: s.systemName,
      action,
      urgency: s.riskLevel >= 40 ? "high" : s.riskLevel >= 20 ? "medium" : "low",
    })))
    .sort((a, b) => {
      const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
    })
    .slice(0, 10);

  // Collect missing data
  const missingCriticalData = systemInsights
    .flatMap(s => s.missingDataSignals.map(signal => ({
      systemId: s.systemId,
      systemName: s.systemName,
      signal,
    })));

  const summaryNarrative = generateNarrative(overallHealthScore, systemInsights);

  const insight: HomeInsight = {
    overallHealthScore,
    highRiskSystems,
    upcomingMaintenance,
    missingCriticalData,
    summaryNarrative,
  };

  // Compute forecast
  const forecastInput = allContexts.map(({ ctx, system }) => ({
    systemId: system.id as number,
    systemName: system.name as string,
    systemCategory: (system.category || "Other") as string,
    ctx,
    evaluation: evaluateSystem(ctx),
  }));
  const forecast = computeHomeForecast(forecastInput, riskAdjustmentFactor);

  return { insight, forecast, systems: systemInsights };
}

export async function computeSystemInsightDetail(systemId: number, homeId: number): Promise<SystemInsightResponse> {
  // Load single system context
  const allContexts = await loadAllSystemContexts(homeId);
  const match = allContexts.find(c => c.system.id === systemId);

  if (!match) throw new Error("System not found");

  // Load learning adjustments (non-fatal if fails)
  let learningParams: Record<string, number> = {};
  try {
    const { loadAdjustments } = await import("./learning-engine");
    learningParams = await loadAdjustments(homeId);
  } catch {
    // Non-fatal: default to no adjustments
  }
  const riskAdjustmentFactor = learningParams["risk_adjustment_factor"] ?? 1.0;

  const { ctx } = match;
  const evaluation = evaluateSystem(ctx);
  const insight = computeSystemInsightFromContext(ctx);
  const prediction = computeSystemPrediction(ctx, evaluation, riskAdjustmentFactor);
  const costProjection = computeCostProjection(ctx.system.category);
  const inactionInsight = computeInactionInsight(ctx, prediction, costProjection);

  return { insight, prediction, costProjection, inactionInsight };
}
