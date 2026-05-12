/**
 * Dunning Agent — failed payment recovery.
 *
 * Triggered (manually or by webhook) with input:
 *   { stripeCustomerId, email, firstName, amount, attemptCount, updatePaymentUrl }
 *
 * Generates a voice-appropriate email for the given dunning stage:
 *   attempt 1 (1d after failure) → polite "heads up, card was declined"
 *   attempt 2 (3d) → helpful "still working on getting this sorted?"
 *   attempt 3 (7d) → last-chance "we'll have to pause your account"
 *
 * Output: email (one per run). Also directly sends via Resend.
 *
 * Separately, the Stripe webhook at /api/stripe/webhook can enqueue this agent
 * when invoice.payment_failed fires.
 */

import { registerAgent, type AgentContext } from "../runner";
import { sendEmail } from "../../lib/email";
import { logInfo, logWarn } from "../../lib/logger";

type Stage = 1 | 2 | 3;

interface DunningInput {
  stripeCustomerId?: string;
  email: string;
  firstName?: string | null;
  amount?: number;       // in cents
  currency?: string;     // "usd"
  attemptCount?: Stage;  // 1, 2, or 3
  updatePaymentUrl?: string;  // Stripe customer portal URL
}

function fmtMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function buildEmail(stage: Stage, firstName: string, amount: string, updateUrl: string): { subject: string; body: string } {
  if (stage === 1) {
    return {
      subject: "Small hiccup with your Home Buddy payment",
      body: `Hey ${firstName},

Just a heads up — your card didn't go through for your Home Buddy subscription (${amount}). Happens all the time, usually an expired card or a bank flag.

No rush, but when you get a minute, updating your card takes about 30 seconds:
${updateUrl}

Your account is still fully active — nothing's changed. I just didn't want you to miss anything.

— Drew`,
    };
  }
  if (stage === 2) {
    return {
      subject: "Your Home Buddy card is still giving us trouble",
      body: `Hey ${firstName},

Circling back — we're still having trouble charging the card on file (${amount}). No worries, but wanted to make sure this didn't slip past.

Updating the card is quick:
${updateUrl}

If something's off — maybe you're re-evaluating Home Buddy, maybe the timing is bad — just hit reply and tell me. I'd rather know than guess.

— Drew`,
    };
  }
  // stage 3
  return {
    subject: "Last note before we pause your Home Buddy account",
    body: `Hey ${firstName},

Didn't want this to catch you off guard: we've tried the card a few times and it hasn't gone through (${amount}), so in a couple of days I'll pause the subscription side of your account.

You won't lose anything — all your data, homes, tasks, and documents stay exactly where they are. You just won't get new AI suggestions or the automated reminders until payment is sorted.

Two options:
  1. Update payment → ${updateUrl}
  2. Reply and tell me what's up

Either is fine. I just don't want you to find out by surprise.

— Drew`,
  };
}

registerAgent("dunning-agent", async (ctx: AgentContext) => {
  const input = ctx.input as unknown as DunningInput;

  if (!input.email) {
    logWarn("agent.dunning", "No email provided — skipping");
    return;
  }

  const stage: Stage = (input.attemptCount === 2 || input.attemptCount === 3) ? input.attemptCount : 1;
  const firstName = input.firstName || "there";
  const amount = fmtMoney(input.amount ?? 0, input.currency || "usd");
  const updateUrl = input.updatePaymentUrl || `${appUrl()}/profile/billing`;

  const { subject, body } = buildEmail(stage, firstName, amount, updateUrl);

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="white-space:pre-line;font-size:15px;line-height:1.6;color:#1f2937;">${body}</div>
    <div style="margin-top:32px;text-align:center;">
      <a href="${updateUrl}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Update payment method</a>
    </div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Billing question? Reply directly to this email.
    </div>
  </div>
</body></html>`.trim();

  const sent = await sendEmail({ to: input.email, subject, html });

  logInfo("agent.dunning", `Stage ${stage} dunning sent`, { email: input.email, amount, sent });

  await ctx.emit({
    outputType: "email",
    title: `Dunning stage ${stage} → ${input.email}`,
    content: html,
    metadata: {
      stage, email: input.email, amount: input.amount,
      stripeCustomerId: input.stripeCustomerId, sent,
    },
  });
});

function appUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}
