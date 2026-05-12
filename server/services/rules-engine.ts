/**
 * Rules Engine — Deterministic, modular rule evaluator for home systems.
 * Each rule is a pure function: (SystemContext) => RuleResult
 * No database dependencies. No LLM calls. Fully auditable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemData {
  id: number;
  category: string;
  name: string;
  installYear: number | null;
  condition: string | null;
  material: string | null;
  make: string | null;
  model: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  warrantyExpiry: string | null;
}

export interface WarrantyData {
  expiryDate: string | null;
  warrantyType: string | null;
  coverageSummary: string | null;
}

export interface RepairData {
  repairDate: string | null;
  cost: number | null;
  outcome: string | null;
  title: string;
}

export interface ReplacementData {
  replacementDate: string | null;
  cost: number | null;
  reason: string | null;
}

export interface TaskData {
  status: string;
  urgency: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

export interface ComponentData {
  condition: string | null;
  installYear: number | null;
  name: string;
}

export interface SystemContext {
  system: SystemData;
  warranties: WarrantyData[];
  repairs: RepairData[];
  replacements: ReplacementData[];
  tasks: TaskData[];
  components: ComponentData[];
  homeBuiltYear: number | null;
  currentDate: Date;
}

export interface RuleResult {
  riskDelta: number;
  findings: string[];
  actions: string[];
  confidencePenalty: number;
  missingData: string[];
}

export interface SystemEvaluation {
  riskLevel: number;          // 0-100
  confidenceScore: number;    // 0-100
  keyFindings: string[];
  recommendedActions: string[];
  missingDataSignals: string[];
  remainingLifeMonths: number | null;
  estimatedAge: number | null;
  expectedLifespanYears: number | null;
}

// ---------------------------------------------------------------------------
// Lifecycle Heuristics — Expected lifespans by category/material
// ---------------------------------------------------------------------------

interface LifecycleEntry {
  minYears: number;
  maxYears: number;
}

const LIFECYCLE_DATA: Record<string, LifecycleEntry> = {
  // Roof
  "Roof": { minYears: 20, maxYears: 30 },
  "Roof/Asphalt": { minYears: 20, maxYears: 30 },
  "Roof/Asphalt Shingle": { minYears: 20, maxYears: 30 },
  "Roof/Metal": { minYears: 40, maxYears: 70 },
  "Roof/Tile": { minYears: 40, maxYears: 50 },
  "Roof/Slate": { minYears: 75, maxYears: 100 },
  // HVAC
  "HVAC": { minYears: 15, maxYears: 20 },
  // Plumbing
  "Plumbing": { minYears: 40, maxYears: 50 },
  "Plumbing/Copper": { minYears: 50, maxYears: 70 },
  "Plumbing/PEX": { minYears: 40, maxYears: 50 },
  "Plumbing/Galvanized": { minYears: 20, maxYears: 40 },
  // Electrical
  "Electrical": { minYears: 30, maxYears: 40 },
  // Water Heater
  "Water Heater": { minYears: 8, maxYears: 12 },
  "Water Heater/Tank": { minYears: 8, maxYears: 12 },
  "Water Heater/Tankless": { minYears: 15, maxYears: 20 },
  "Water Heater/Hybrid": { minYears: 12, maxYears: 15 },
  // Windows
  "Windows": { minYears: 20, maxYears: 40 },
  "Windows/Vinyl": { minYears: 20, maxYears: 40 },
  "Windows/Wood": { minYears: 15, maxYears: 30 },
  "Windows/Aluminum": { minYears: 15, maxYears: 25 },
  // Foundation
  "Foundation": { minYears: 50, maxYears: 100 },
  // Other
  "Siding/Exterior": { minYears: 20, maxYears: 40 },
  "Chimney": { minYears: 30, maxYears: 50 },
  "Appliances": { minYears: 10, maxYears: 15 },
  "Landscaping": { minYears: 10, maxYears: 20 },
  "Paint": { minYears: 5, maxYears: 10 },
  "Pest": { minYears: 1, maxYears: 3 },
};

export function getLifecycleData(category: string, material?: string | null): LifecycleEntry {
  // Try specific material match first
  if (material) {
    const specificKey = `${category}/${material}`;
    if (LIFECYCLE_DATA[specificKey]) return LIFECYCLE_DATA[specificKey];
    // Try partial match
    for (const key of Object.keys(LIFECYCLE_DATA)) {
      if (key.startsWith(`${category}/`) && material.toLowerCase().includes(key.split("/")[1].toLowerCase())) {
        return LIFECYCLE_DATA[key];
      }
    }
  }
  // Fallback to category
  return LIFECYCLE_DATA[category] || { minYears: 15, maxYears: 25 };
}

function getSystemAge(ctx: SystemContext): number | null {
  const installYear = ctx.system.installYear;
  if (installYear) return ctx.currentDate.getFullYear() - installYear;
  if (ctx.homeBuiltYear) return ctx.currentDate.getFullYear() - ctx.homeBuiltYear;
  return null;
}

function monthsSince(dateStr: string | null, now: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

// ---------------------------------------------------------------------------
// Individual Rules
// ---------------------------------------------------------------------------

export function ageRiskRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };
  const age = getSystemAge(ctx);
  if (age === null) return result;

  const lifecycle = getLifecycleData(ctx.system.category, ctx.system.material);
  const avgLifespan = (lifecycle.minYears + lifecycle.maxYears) / 2;
  const ageRatio = age / avgLifespan;

  if (ageRatio > 0.9) {
    result.riskDelta = 40;
    result.findings.push(`Your ${ctx.system.name} is ${age} years old, nearing the end of its expected ${lifecycle.minYears}-${lifecycle.maxYears} year lifespan.`);
    result.actions.push(`Start planning for ${ctx.system.name.toLowerCase()} replacement within the next few years.`);
  } else if (ageRatio > 0.75) {
    result.riskDelta = 20;
    result.findings.push(`Your ${ctx.system.name} is ${age} years old — entering the later stage of its expected life.`);
    result.actions.push(`Schedule a professional inspection of your ${ctx.system.name.toLowerCase()} to assess remaining life.`);
  } else if (ageRatio > 0.5) {
    result.riskDelta = 5;
    result.findings.push(`Your ${ctx.system.name} is ${age} years old, roughly mid-life for this type of system.`);
  }

  return result;
}

export function maintenanceGapRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };
  const monthsGap = monthsSince(ctx.system.lastServiceDate, ctx.currentDate);

  // Check for HVAC-specific maintenance urgency
  const isHvac = ctx.system.category === "HVAC";
  const threshold = isHvac ? 12 : 24;

  if (monthsGap !== null && monthsGap > threshold) {
    result.riskDelta = isHvac ? 15 : 10;
    const timeAgo = monthsGap > 12 ? `${Math.floor(monthsGap / 12)} year${Math.floor(monthsGap / 12) > 1 ? "s" : ""}` : `${monthsGap} months`;
    result.findings.push(`No maintenance recorded for your ${ctx.system.name} in ${timeAgo}.`);
    result.actions.push(`Schedule routine maintenance for your ${ctx.system.name.toLowerCase()}.`);
  }

  // Also check for overdue tasks
  const overdueTasks = ctx.tasks.filter(t => {
    if (t.status === "completed" || t.status === "skipped") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < ctx.currentDate;
  });
  if (overdueTasks.length > 0) {
    result.riskDelta += 10;
    result.findings.push(`${overdueTasks.length} overdue maintenance task${overdueTasks.length > 1 ? "s" : ""} for ${ctx.system.name}.`);
  }

  return result;
}

export function warrantyExpiryRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };

  for (const w of ctx.warranties) {
    if (!w.expiryDate) continue;
    const months = monthsSince(ctx.currentDate.toISOString(), new Date(w.expiryDate));
    if (months === null) continue;
    // months is negative if expiry is in the future
    const monthsUntilExpiry = -months;

    if (monthsUntilExpiry < 0) {
      result.findings.push(`A warranty on your ${ctx.system.name} has expired.`);
    } else if (monthsUntilExpiry < 6) {
      result.findings.push(`A warranty on your ${ctx.system.name} expires in ${monthsUntilExpiry} months.`);
      result.actions.push(`Review warranty coverage and schedule any needed warranty work before it expires.`);
    } else if (monthsUntilExpiry < 12) {
      result.findings.push(`A warranty on your ${ctx.system.name} expires within the year.`);
    }
  }

  return result;
}

export function conditionDegradationRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };
  const condition = ctx.system.condition;

  if (condition === "Poor") {
    result.riskDelta = 30;
    result.findings.push(`Your ${ctx.system.name} is in poor condition.`);
    result.actions.push(`Get a professional assessment of your ${ctx.system.name.toLowerCase()} to determine repair vs. replacement options.`);
  } else if (condition === "Fair") {
    result.riskDelta = 15;
    result.findings.push(`Your ${ctx.system.name} is in fair condition — worth keeping an eye on.`);
    result.actions.push(`Monitor your ${ctx.system.name.toLowerCase()} and address any minor issues before they escalate.`);
  }

  // Check component conditions
  const poorComponents = ctx.components.filter(c => c.condition === "Poor");
  const fairComponents = ctx.components.filter(c => c.condition === "Fair");
  if (poorComponents.length > 0) {
    result.riskDelta += 10;
    result.findings.push(`${poorComponents.length} component${poorComponents.length > 1 ? "s" : ""} in poor condition: ${poorComponents.map(c => c.name).join(", ")}.`);
  }
  if (fairComponents.length > 0) {
    result.riskDelta += 5;
  }

  return result;
}

export function repairFrequencyRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };

  const recentRepairs = ctx.repairs.filter(r => {
    if (!r.repairDate) return false;
    const months = monthsSince(r.repairDate, ctx.currentDate);
    return months !== null && months <= 24;
  });

  if (recentRepairs.length >= 3) {
    result.riskDelta = 25;
    result.findings.push(`Your ${ctx.system.name} has needed ${recentRepairs.length} repairs in the last 2 years — a pattern worth paying attention to.`);
    result.actions.push(`Consider whether continued repairs are more cost-effective than replacement.`);
  } else if (recentRepairs.length >= 2) {
    result.riskDelta = 15;
    result.findings.push(`Your ${ctx.system.name} has had ${recentRepairs.length} repairs recently.`);
  }

  return result;
}

export function missingDataRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };

  if (!ctx.system.installYear && !ctx.homeBuiltYear) {
    result.confidencePenalty = 30;
    result.missingData.push(`Add the install date for your ${ctx.system.name} so we can track its age.`);
  }

  if (!ctx.system.condition || ctx.system.condition === "Unknown") {
    result.confidencePenalty += 20;
    result.missingData.push(`Set the condition of your ${ctx.system.name} for more accurate insights.`);
  }

  if (!ctx.system.lastServiceDate) {
    result.confidencePenalty += 10;
    result.missingData.push(`Record when your ${ctx.system.name} was last serviced.`);
  }

  if (!ctx.system.material) {
    result.confidencePenalty += 5;
    result.missingData.push(`Add the material type for your ${ctx.system.name} for better lifespan estimates.`);
  }

  return result;
}

export function costTrendRule(ctx: SystemContext): RuleResult {
  const result: RuleResult = { riskDelta: 0, findings: [], actions: [], confidencePenalty: 0, missingData: [] };

  const recentRepairCost = ctx.repairs
    .filter(r => {
      if (!r.repairDate || !r.cost) return false;
      const months = monthsSince(r.repairDate, ctx.currentDate);
      return months !== null && months <= 36;
    })
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  if (recentRepairCost > 0) {
    // Import cost ranges inline to avoid circular deps
    const costData = COST_RANGES[ctx.system.category];
    if (costData && recentRepairCost > costData.replaceMin * 0.5) {
      result.riskDelta = 10;
      result.findings.push(`You've spent $${(recentRepairCost / 100).toLocaleString()} on ${ctx.system.name} repairs recently — approaching the cost of replacement.`);
      result.actions.push(`Compare ongoing repair costs vs. replacement cost for your ${ctx.system.name.toLowerCase()}.`);
    }
  }

  return result;
}

// Cost ranges (cents) - also used by prediction engine
export const COST_RANGES: Record<string, { repairMin: number; repairMax: number; replaceMin: number; replaceMax: number }> = {
  "Roof": { repairMin: 50000, repairMax: 500000, replaceMin: 800000, replaceMax: 1500000 },
  "HVAC": { repairMin: 30000, repairMax: 250000, replaceMin: 400000, replaceMax: 800000 },
  "Plumbing": { repairMin: 20000, repairMax: 200000, replaceMin: 300000, replaceMax: 1000000 },
  "Electrical": { repairMin: 20000, repairMax: 150000, replaceMin: 200000, replaceMax: 500000 },
  "Water Heater": { repairMin: 15000, repairMax: 80000, replaceMin: 150000, replaceMax: 350000 },
  "Windows": { repairMin: 20000, repairMax: 100000, replaceMin: 50000, replaceMax: 150000 },
  "Foundation": { repairMin: 50000, repairMax: 500000, replaceMin: 1000000, replaceMax: 3000000 },
  "Siding/Exterior": { repairMin: 20000, repairMax: 200000, replaceMin: 500000, replaceMax: 1500000 },
  "Chimney": { repairMin: 20000, repairMax: 150000, replaceMin: 300000, replaceMax: 800000 },
  "Appliances": { repairMin: 10000, repairMax: 50000, replaceMin: 50000, replaceMax: 200000 },
  "Landscaping": { repairMin: 10000, repairMax: 50000, replaceMin: 50000, replaceMax: 200000 },
  "Paint": { repairMin: 5000, repairMax: 30000, replaceMin: 30000, replaceMax: 100000 },
  "Pest": { repairMin: 10000, repairMax: 50000, replaceMin: 20000, replaceMax: 80000 },
  "Other": { repairMin: 10000, repairMax: 100000, replaceMin: 50000, replaceMax: 300000 },
};

// ---------------------------------------------------------------------------
// System Criticality Weights
// ---------------------------------------------------------------------------

export const SYSTEM_WEIGHTS: Record<string, number> = {
  "Roof": 1.5,
  "Foundation": 1.5,
  "Electrical": 1.5,
  "HVAC": 1.2,
  "Plumbing": 1.2,
  "Water Heater": 1.2,
  "Windows": 1.0,
  "Siding/Exterior": 1.0,
  "Chimney": 1.0,
  "Appliances": 0.8,
  "Landscaping": 0.6,
  "Paint": 0.5,
  "Pest": 0.5,
  "Other": 0.8,
};

// ---------------------------------------------------------------------------
// Aggregation — Run all rules for a system
// ---------------------------------------------------------------------------

const ALL_RULES = [
  ageRiskRule,
  maintenanceGapRule,
  warrantyExpiryRule,
  conditionDegradationRule,
  repairFrequencyRule,
  missingDataRule,
  costTrendRule,
];

export function evaluateSystem(ctx: SystemContext): SystemEvaluation {
  let totalRisk = 0;
  let totalConfidencePenalty = 0;
  const allFindings: string[] = [];
  const allActions: string[] = [];
  const allMissing: string[] = [];

  for (const rule of ALL_RULES) {
    const result = rule(ctx);
    totalRisk += result.riskDelta;
    totalConfidencePenalty += result.confidencePenalty;
    allFindings.push(...result.findings);
    allActions.push(...result.actions);
    allMissing.push(...result.missingData);
  }

  // Compute remaining life
  const age = getSystemAge(ctx);
  const lifecycle = getLifecycleData(ctx.system.category, ctx.system.material);
  const avgLifespan = (lifecycle.minYears + lifecycle.maxYears) / 2;
  let remainingLifeMonths: number | null = null;
  if (age !== null) {
    const remainingYears = Math.max(0, avgLifespan - age);
    // Adjust by condition
    let conditionMultiplier = 1.0;
    if (ctx.system.condition === "Poor") conditionMultiplier = 0.5;
    else if (ctx.system.condition === "Fair") conditionMultiplier = 0.75;
    else if (ctx.system.condition === "Great") conditionMultiplier = 1.15;
    remainingLifeMonths = Math.round(remainingYears * 12 * conditionMultiplier);
  }

  return {
    riskLevel: Math.min(100, Math.max(0, totalRisk)),
    confidenceScore: Math.max(10, Math.min(100, 100 - totalConfidencePenalty)),
    keyFindings: allFindings,
    recommendedActions: allActions,
    missingDataSignals: allMissing,
    remainingLifeMonths,
    estimatedAge: age,
    expectedLifespanYears: avgLifespan,
  };
}
