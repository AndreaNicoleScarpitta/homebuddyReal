/**
 * "Me" routes — authenticated user context that isn't auth-specific.
 *
 * GET /api/me/plan  — current plan, status, usage, and limits.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { getUserPlan, getUserUsage, getLimitsFor, PLANS } from "./lib/plans";
import { logger } from "./lib/logger";

export function registerMeRoutes(app: Express): void {
  app.get("/api/me/plan", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [planInfo, usage] = await Promise.all([
        getUserPlan(user.id),
        getUserUsage(user.id),
      ]);
      const limits = getLimitsFor(planInfo.plan);

      res.json({
        plan: planInfo.plan,
        planName: PLANS[planInfo.plan].name,
        planStatus: planInfo.planStatus,
        planRenewsAt: planInfo.planRenewsAt,
        priceMonthly: PLANS[planInfo.plan].priceMonthly,
        limits,
        usage,
        hasStripeCustomer: Boolean(planInfo.stripeCustomerId),
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, "Failed to fetch user plan");
      res.status(500).json({ error: "Unable to load plan" });
    }
  });
}
