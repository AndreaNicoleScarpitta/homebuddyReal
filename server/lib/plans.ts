/**
 * Plans — single source of truth for Home Buddy's tiering model.
 *
 * This file is THE reference for:
 *   - What each plan includes (features, limits)
 *   - How to check if a user is allowed to do something
 *   - Middleware for gating routes
 *
 * Keep this in sync with:
 *   - server/billing-routes.ts (PLANS constant — the public metadata)
 *   - client/src/hooks/use-plan.ts (the frontend shape of /api/me/plan)
 *   - client/src/pages/pricing.tsx (marketing copy)
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export type PlanId = "free" | "plus" | "premium";
export type PlanStatus = "active" | "past_due" | "canceled" | "trialing";

export interface PlanLimits {
  /** How many homes a user can own. `null` = unlimited. */
  maxHomes: number | null;
  /** How many tracked systems per home. `null` = unlimited. */
  maxSystemsPerHome: number | null;
  /** How many active (non-completed) tasks across all homes. `null` = unlimited. */
  maxActiveTasks: number | null;
  /** How many document analyses per calendar month. `null` = unlimited. */
  maxDocAnalysesPerMonth: number | null;
  /** How many AI-generated home reports per month. `null` = unlimited. */
  maxAiReportsPerMonth: number | null;
  /** Whether the user can use AI-powered task suggestions. */
  aiTaskSuggestions: boolean;
  /** Whether the user gets seasonal prep campaigns (auto-emails). */
  seasonalCampaigns: boolean;
  /** Whether the user gets priority support SLA. */
  prioritySupport: boolean;
}

/**
 * The canonical plan definition. If you change a limit here, it's changed
 * everywhere — routes, middleware, frontend, and the /api/me/plan response.
 */
export const PLANS: Record<PlanId, { id: PlanId; name: string; priceMonthly: number; limits: PlanLimits }> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    limits: {
      maxHomes: 1,
      maxSystemsPerHome: 4,
      maxActiveTasks: null,
      maxDocAnalysesPerMonth: 2,
      maxAiReportsPerMonth: 0,
      aiTaskSuggestions: false,
      seasonalCampaigns: false,
      prioritySupport: false,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceMonthly: 5,
    limits: {
      maxHomes: 2,
      maxSystemsPerHome: null, // unlimited
      maxActiveTasks: null,
      maxDocAnalysesPerMonth: 10,
      maxAiReportsPerMonth: 2,
      aiTaskSuggestions: true,
      seasonalCampaigns: false,
      prioritySupport: false,
    },
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceMonthly: 9,
    limits: {
      maxHomes: 4,
      maxSystemsPerHome: null,
      maxActiveTasks: null,
      maxDocAnalysesPerMonth: null,
      maxAiReportsPerMonth: null,
      aiTaskSuggestions: true,
      seasonalCampaigns: true,
      prioritySupport: true,
    },
  },
};

/** Plan hierarchy — higher number = more access. */
const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, premium: 2 };

// ---------------------------------------------------------------------------
// Core lookups
// ---------------------------------------------------------------------------

export interface UserPlanInfo {
  plan: PlanId;
  planStatus: PlanStatus;
  planRenewsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * Look up a user's current plan from the DB.
 * Always returns something — defaults to "free" if user not found
 * or the plan column is missing (graceful migration).
 */
export async function getUserPlan(userId: string): Promise<UserPlanInfo> {
  try {
    const result = await db.execute(sql`
      SELECT plan, plan_status, plan_renews_at, stripe_customer_id, stripe_subscription_id
      FROM users WHERE id = ${userId} LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (!row) return defaultPlan();

    // Treat past_due / canceled as "free" for enforcement purposes, but
    // surface the real status in the UI so the user can take action.
    const effectivePlan: PlanId =
      row.plan_status === "canceled" || row.plan_status === "past_due"
        ? "free"
        : (row.plan as PlanId) || "free";

    return {
      plan: effectivePlan,
      planStatus: (row.plan_status as PlanStatus) || "active",
      planRenewsAt: row.plan_renews_at ? new Date(row.plan_renews_at) : null,
      stripeCustomerId: row.stripe_customer_id || null,
      stripeSubscriptionId: row.stripe_subscription_id || null,
    };
  } catch {
    // Column may not exist yet if migration hasn't run
    return defaultPlan();
  }
}

function defaultPlan(): UserPlanInfo {
  return {
    plan: "free",
    planStatus: "active",
    planRenewsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

/** Returns the plan's limits. */
export function getLimitsFor(plan: PlanId): PlanLimits {
  return PLANS[plan]?.limits || PLANS.free.limits;
}

/** True if the given plan is at least as high as the minimum required. */
export function hasMinPlan(plan: PlanId, minimum: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

// ---------------------------------------------------------------------------
// Usage counters — the denominator side of limits
// ---------------------------------------------------------------------------

export interface UsageSnapshot {
  homes: number;
  activeTasks: number;
  docAnalysesThisMonth: number;
  aiReportsThisMonth: number;
}

export async function getUserUsage(userId: string): Promise<UsageSnapshot> {
  // Use raw SQL with COALESCE so we tolerate missing tables during early deploys.
  const safe = async (q: any): Promise<number> => {
    try {
      const r = await db.execute(q);
      const n = Number((r.rows[0] as any)?.count || 0);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const [homes, activeTasks, docs, reports] = await Promise.all([
    safe(sql`SELECT COUNT(*)::int AS count FROM homes WHERE user_id = ${userId}`),
    safe(sql`
      SELECT COUNT(*)::int AS count
      FROM maintenance_tasks t
      JOIN homes h ON h.id = t.home_id
      WHERE h.user_id = ${userId} AND COALESCE(t.status, 'pending') <> 'completed'
    `),
    safe(sql`
      SELECT COUNT(*)::int AS count
      FROM inspection_reports
      WHERE user_id = ${userId} AND created_at >= date_trunc('month', NOW())
    `),
    safe(sql`
      SELECT COUNT(*)::int AS count
      FROM agent_outputs
      WHERE output_type = 'home_report'
        AND metadata->>'userId' = ${userId}
        AND created_at >= date_trunc('month', NOW())
    `),
  ]);

  return {
    homes,
    activeTasks,
    docAnalysesThisMonth: docs,
    aiReportsThisMonth: reports,
  };
}

// ---------------------------------------------------------------------------
// Permission helpers — call these before doing the thing
// ---------------------------------------------------------------------------

export type LimitKey = "homes" | "activeTasks" | "docAnalyses" | "aiReports";

export interface LimitCheck {
  allowed: boolean;
  plan: PlanId;
  limit: number | null;   // null = unlimited
  current: number;
  feature: LimitKey;
  /** Human reason, shown in error responses. */
  message?: string;
}

/** Check if a user can perform an action, counting current usage. */
export async function checkLimit(userId: string, feature: LimitKey): Promise<LimitCheck> {
  const [planInfo, usage] = await Promise.all([getUserPlan(userId), getUserUsage(userId)]);
  const limits = getLimitsFor(planInfo.plan);

  let limit: number | null;
  let current: number;
  switch (feature) {
    case "homes":
      limit = limits.maxHomes;
      current = usage.homes;
      break;
    case "activeTasks":
      limit = limits.maxActiveTasks;
      current = usage.activeTasks;
      break;
    case "docAnalyses":
      limit = limits.maxDocAnalysesPerMonth;
      current = usage.docAnalysesThisMonth;
      break;
    case "aiReports":
      limit = limits.maxAiReportsPerMonth;
      current = usage.aiReportsThisMonth;
      break;
  }

  const allowed = limit === null || current < limit;
  return {
    allowed,
    plan: planInfo.plan,
    limit,
    current,
    feature,
    message: allowed
      ? undefined
      : `You've hit your ${planInfo.plan} plan limit (${current}/${limit}) for ${featureLabel(feature)}. Upgrade to continue.`,
  };
}

function featureLabel(f: LimitKey): string {
  switch (f) {
    case "homes": return "homes";
    case "activeTasks": return "active tasks";
    case "docAnalyses": return "document analyses this month";
    case "aiReports": return "AI reports this month";
  }
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/** Gate a route behind a minimum plan tier. */
export function requirePlan(min: PlanId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Not authenticated" });
    const { plan } = await getUserPlan(user.id);
    if (!hasMinPlan(plan, min)) {
      return res.status(402).json({
        error: "Upgrade required",
        currentPlan: plan,
        requiredPlan: min,
        upgradeUrl: "/pricing",
      });
    }
    next();
  };
}

/** Gate a route behind a specific feature flag (boolean). */
export function requireFeature(flag: keyof PlanLimits) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Not authenticated" });
    const { plan } = await getUserPlan(user.id);
    const limits = getLimitsFor(plan);
    if (!limits[flag]) {
      return res.status(402).json({
        error: `Feature '${flag}' not available on the ${plan} plan`,
        currentPlan: plan,
        upgradeUrl: "/pricing",
      });
    }
    next();
  };
}

/** Gate a route behind a countable limit. */
export function requireUnderLimit(feature: LimitKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Not authenticated" });
    const check = await checkLimit(user.id, feature);
    if (!check.allowed) {
      return res.status(402).json({
        error: check.message,
        feature: check.feature,
        current: check.current,
        limit: check.limit,
        currentPlan: check.plan,
        upgradeUrl: "/pricing",
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Per-home limits (systems) — usage is scoped to a specific home
// ---------------------------------------------------------------------------

/** Count how many systems a specific home currently has. */
async function countSystemsForHome(homeId: number | string): Promise<number> {
  try {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM systems WHERE home_id = ${homeId}
    `);
    return Number((r.rows[0] as any)?.count || 0);
  } catch {
    return 0;
  }
}

/** Check if a user can add another system to a specific home. */
export async function checkSystemsLimit(userId: string, homeId: number | string): Promise<LimitCheck> {
  const planInfo = await getUserPlan(userId);
  const limits = getLimitsFor(planInfo.plan);
  const current = await countSystemsForHome(homeId);
  const limit = limits.maxSystemsPerHome;
  const allowed = limit === null || current < limit;
  return {
    allowed,
    plan: planInfo.plan,
    limit,
    current,
    feature: "homes", // reuse shape
    message: allowed
      ? undefined
      : `You've hit your ${planInfo.plan} plan limit (${current}/${limit}) for systems in this home. Upgrade to track unlimited systems.`,
  };
}

/**
 * Middleware for routes that add a system to a specific home.
 * The home ID must be available at `req.params.homeId`.
 */
export function requireUnderSystemsLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Not authenticated" });
    const homeId = req.params.homeId;
    if (!homeId) return res.status(400).json({ error: "Missing home id" });
    const check = await checkSystemsLimit(user.id, homeId);
    if (!check.allowed) {
      return res.status(402).json({
        error: check.message,
        feature: "systemsPerHome",
        current: check.current,
        limit: check.limit,
        currentPlan: check.plan,
        upgradeUrl: "/pricing",
      });
    }
    next();
  };
}

/** Update a user's plan based on a Stripe subscription event. */
export async function setUserPlan(params: {
  stripeCustomerId: string;
  plan: PlanId;
  status: PlanStatus;
  subscriptionId: string | null;
  renewsAt: Date | null;
}): Promise<void> {
  await db.execute(sql`
    UPDATE users
    SET
      plan = ${params.plan},
      plan_status = ${params.status},
      stripe_subscription_id = ${params.subscriptionId},
      plan_renews_at = ${params.renewsAt},
      updated_at = NOW()
    WHERE stripe_customer_id = ${params.stripeCustomerId}
  `);
}
