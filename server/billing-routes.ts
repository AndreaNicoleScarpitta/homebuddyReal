/**
 * Billing routes — Stripe Checkout + Customer Portal
 *
 * Env vars used:
 *   STRIPE_PRICE_PLUS     — Stripe Price ID for the Plus tier ($5/mo)
 *   STRIPE_PRICE_PREMIUM  — Stripe Price ID for the Premium tier ($9/mo)
 *
 * POST /api/billing/create-checkout-session { plan: "plus" | "premium" }
 * POST /api/billing/portal   — opens Stripe Customer Portal
 * GET  /api/billing/plans    — returns plan metadata (public)
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";
import { db, stripeBreaker } from "./db";
import { sql } from "drizzle-orm";

const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceId: null,
    features: [
      "1 home",
      "Unlimited systems per home",
      "Manual task tracking",
      "Calendar subscription feed",
      "Document analysis (5/mo)",
      "Community support",
    ],
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceMonthly: 5,
    priceId: process.env.STRIPE_PRICE_PLUS || null,
    features: [
      "2 homes",
      "Unlimited systems per home",
      "AI task suggestions",
      "Document analysis (10/mo)",
      "Smart reminders",
      "Email support",
    ],
    popular: true,
  },
  // Unlisted: Premium's headline promise is multiple homes, and the app
  // cannot deliver it — /v2/home returns a single home per user and there is
  // no way to switch between them in the UI. Selling it would be selling
  // something that does not exist, so the tier is hidden and its checkout
  // path is closed. Entitlements in lib/plans.ts are deliberately untouched,
  // so anyone already subscribed keeps everything they are paying for.
  // Relist once multi-home is actually built.
  premium: {
    id: "premium",
    name: "Premium",
    priceMonthly: 9,
    listed: false,
    priceId: process.env.STRIPE_PRICE_PREMIUM || null,
    features: [
      "4 homes",
      "Unlimited systems per home",
      "Unlimited document analysis",
      "Unlimited AI home reports",
      "Seasonal prep campaigns",
      "Priority support",
      "Early access to new features",
    ],
  },
};

function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

export function registerBillingRoutes(app: Express): void {
  // Public — plan metadata for pricing page
  app.get("/api/billing/plans", (_req, res) => {
    const plansPublic = Object.values(PLANS)
      .filter((p) => p.id === "free")
      .map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.priceMonthly,
        features: p.features,
        popular: (p as any).popular || false,
        available: p.priceId !== null || p.id === "free",
      }));
    res.json(plansPublic);
  });

  // Subscriptions are discontinued. No new recurring checkout sessions.
  // Keep the existing billing portal so current subscribers can manage/cancel.
  app.post("/api/billing/create-checkout-session", isAuthenticated, (_req, res) => {
    res.status(410).json({ error: "Paid plan upgrades are discontinued. Home Buddy is supported by voluntary donations." });
  });

  // Voluntary ONE-TIME contribution. Never creates a subscription or
  // grants different feature entitlements; a payment is not a paid plan.
  app.post("/api/donations/checkout", async (req: Request, res: Response) => {
    const amount = Number(req.body?.amount);
    if (![5, 10, 25, 50].includes(amount)) {
      return res.status(400).json({ error: "Choose a supported donation amount." });
    }
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripeBreaker.execute(() => stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: amount * 100,
            product_data: { name: "Support Home Buddy", description: "Optional, one-time contribution. No subscription or additional features." },
          },
          quantity: 1,
        }],
        success_url: `${appUrl()}/support?donation=success`,
        cancel_url: `${appUrl()}/support?donation=canceled`,
        metadata: { purpose: "donation" },
      }));
      res.json({ url: session.url });
    } catch (err: any) {
      logger.error({ err: err?.message }, "Failed to create donation checkout");
      res.status(503).json({ error: "Donations are temporarily unavailable. Please try again later." });
    }
  });

  app.post("/api/billing/portal", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const row = await db.execute(sql`
        SELECT stripe_customer_id FROM users WHERE id = ${user.id} LIMIT 1
      `);
      const customerId = (row.rows[0] as any)?.stripe_customer_id;
      if (!customerId) {
        return res.status(404).json({ error: "No Stripe customer on file" });
      }
      const stripe = await getUncachableStripeClient();
      const portal = await stripeBreaker.execute(() => stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl()}/profile`,
      }));
      res.json({ url: portal.url });
    } catch (err: any) {
      logger.error({ err: err?.message }, "Failed to open billing portal");
      res.status(500).json({ error: "Unable to open billing portal" });
    }
  });
}
