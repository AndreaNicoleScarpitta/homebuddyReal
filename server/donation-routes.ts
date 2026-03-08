import type { Express } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { logInfo, logError } from "./lib/logger";

export function registerDonationRoutes(app: Express) {
  app.get("/api/donations/config", isAuthenticated, async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();

      let donations: any[] = [];
      try {
        const result = await db.execute(sql`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            pr.id as price_id,
            pr.unit_amount
          FROM stripe.products p
          JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true AND p.metadata->>'type' = 'donation'
          ORDER BY pr.unit_amount ASC
        `);
        donations = result.rows.map((row: any) => ({
          productId: row.product_id,
          productName: row.product_name,
          description: row.product_description,
          priceId: row.price_id,
          amount: row.unit_amount,
        }));
      } catch (dbErr) {
        logError("donations.config", "DB query failed, trying Stripe API directly", { error: dbErr });
      }

      if (donations.length === 0) {
        try {
          const stripe = await getUncachableStripeClient();
          const products = await stripe.products.search({ query: "metadata['type']:'donation'" });
          for (const product of products.data) {
            if (!product.active) continue;
            const prices = await stripe.prices.list({ product: product.id, active: true });
            for (const price of prices.data) {
              donations.push({
                productId: product.id,
                productName: product.name,
                description: product.description,
                priceId: price.id,
                amount: price.unit_amount,
              });
            }
          }
          donations.sort((a: any, b: any) => (a.amount || 0) - (b.amount || 0));
        } catch (stripeErr) {
          logError("donations.config", "Stripe API fallback also failed", { error: stripeErr });
        }
      }

      res.json({ publishableKey, donations });
    } catch (error) {
      logError("donations.config", "Failed to load donation config", { error });
      res.status(500).json({ message: "Failed to load donation configuration" });
    }
  });

  app.get("/api/donations/status", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      res.json({
        loginCount: user.loginCount || 0,
        hasDonated: user.hasDonated || false,
        snoozeUntilLoginCount: user.donationPromptSnoozeUntilLoginCount || null,
      });
    } catch (error) {
      logError("donations.status", "Failed to load donation status", { error });
      res.status(500).json({ message: "Failed to load donation status" });
    }
  });

  app.post("/api/donations/checkout", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { priceId } = req.body;

      if (!priceId || typeof priceId !== "string") {
        return res.status(400).json({ message: "priceId is required" });
      }

      const validPrices = await db.execute(sql`
        SELECT pr.id FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId} AND pr.active = true AND p.active = true AND p.metadata->>'type' = 'donation'
      `);
      if (validPrices.rows.length === 0) {
        return res.status(400).json({ message: "Invalid donation price" });
      }

      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: user.id },
        });
        await authStorage.updateStripeCustomerId(user.id, customer.id);
        customerId = customer.id;
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: `${baseUrl}/profile?donation=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/profile?donation=cancelled`,
        metadata: { userId: user.id, type: "donation" },
      });

      logInfo("donations.checkout", "Checkout session created", { userId: user.id, priceId });
      res.json({ url: session.url });
    } catch (error) {
      logError("donations.checkout", "Failed to create checkout session", { error });
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/donations/snooze", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentLoginCount = user.loginCount || 0;
      const snoozeUntil = currentLoginCount + 20;
      await authStorage.snoozeDonationPrompt(user.id, snoozeUntil);
      logInfo("donations.snooze", "Donation prompt snoozed", { userId: user.id, snoozeUntil });
      res.json({ snoozeUntilLoginCount: snoozeUntil });
    } catch (error) {
      logError("donations.snooze", "Failed to snooze donation prompt", { error });
      res.status(500).json({ message: "Failed to snooze donation prompt" });
    }
  });

  app.post("/api/donations/verify-and-mark", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { sessionId } = req.body;

      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ message: "sessionId is required" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }
      if (session.metadata?.userId !== user.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }
      if (session.metadata?.type !== "donation") {
        return res.status(400).json({ message: "Not a donation session" });
      }

      await authStorage.markDonated(user.id);
      logInfo("donations.verified", "Donation verified and marked", { userId: user.id, sessionId });
      res.json({ hasDonated: true });
    } catch (error) {
      logError("donations.verify", "Failed to verify donation", { error });
      res.status(500).json({ message: "Failed to verify donation" });
    }
  });
}
