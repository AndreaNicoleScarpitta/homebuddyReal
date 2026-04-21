import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { AgentRunner } from './agents/runner';
import { logger } from './lib/logger';
import { setUserPlan, type PlanId, type PlanStatus } from './lib/plans';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Also parse the event ourselves to trigger agents (dunning, etc.)
    // We re-verify the signature via the Stripe client — redundant but safe.
    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        // Previously we fell back to JSON.parse(payload) when the secret was
        // missing, trusting that stripe-replit-sync verified upstream. That
        // trust was misplaced: a misconfigured sync (or a direct POST to this
        // route) would let an unauthenticated attacker forge subscription
        // events and silently upgrade any user's plan. Fail loud instead.
        logger.error('STRIPE_WEBHOOK_SECRET is not set — refusing to process webhook. Set STRIPE_WEBHOOK_SECRET in env before accepting Stripe events.');
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
      }
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      if (event.type === 'invoice.payment_failed') {
        await handleInvoicePaymentFailed(event.data.object);
      }

      // Subscription lifecycle → update user plan
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'checkout.session.completed'
      ) {
        await handleSubscriptionChange(event);
      }
      if (event.type === 'customer.subscription.deleted') {
        await handleSubscriptionDeleted(event.data.object);
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Post-webhook agent trigger failed (non-fatal)');
    }
  }
}

function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PLUS) return 'plus';
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return 'premium';
  return null;
}

function planStatusFromStripe(status: string | undefined): PlanStatus {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired': return 'canceled';
    default: return 'active';
  }
}

async function handleSubscriptionChange(event: any): Promise<void> {
  try {
    const stripe = await getUncachableStripeClient();

    let subscription: any = null;
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode !== 'subscription' || !session.subscription) return;
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } else {
      subscription = event.data.object;
    }
    if (!subscription) return;

    const customerId: string = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) return;

    const priceId: string | undefined = subscription.items?.data?.[0]?.price?.id;
    const plan = planFromPriceId(priceId);
    if (!plan) {
      logger.warn({ priceId }, 'Subscription webhook: no matching plan for price id');
      return;
    }

    const status = planStatusFromStripe(subscription.status);
    const renewsAt = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await setUserPlan({
      stripeCustomerId: customerId,
      plan,
      status,
      subscriptionId: subscription.id,
      renewsAt,
    });

    logger.info({ customerId, plan, status }, 'User plan updated from Stripe webhook');
  } catch (err: any) {
    logger.error({ err: err?.message }, 'handleSubscriptionChange failed');
  }
}

async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  try {
    const customerId: string = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) return;

    await setUserPlan({
      stripeCustomerId: customerId,
      plan: 'free',
      status: 'canceled',
      subscriptionId: null,
      renewsAt: null,
    });
    logger.info({ customerId }, 'User downgraded to free after subscription deletion');
  } catch (err: any) {
    logger.error({ err: err?.message }, 'handleSubscriptionDeleted failed');
  }
}

async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  const email = invoice?.customer_email;
  if (!email) {
    logger.info('invoice.payment_failed: no customer_email, skipping dunning');
    return;
  }

  const attemptCount = Math.min(Math.max(invoice.attempt_count || 1, 1), 3);
  const amount = invoice.amount_due || invoice.amount_remaining || 0;
  const currency = invoice.currency || 'usd';
  const firstName = invoice.customer_name?.split(' ')[0] || null;

  // Generate Stripe customer portal link
  let updatePaymentUrl = '';
  try {
    const stripe = await getUncachableStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: invoice.customer,
      return_url: process.env.REPLIT_DEPLOYMENT_URL
        ? `${process.env.REPLIT_DEPLOYMENT_URL}/profile`
        : 'http://localhost:5000/profile',
    });
    updatePaymentUrl = portal.url;
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Failed to create billing portal — dunning email will use fallback link');
  }

  AgentRunner.run('dunning-agent', {
    stripeCustomerId: invoice.customer,
    email,
    firstName,
    amount,
    currency,
    attemptCount,
    updatePaymentUrl,
  }, 'webhook:stripe').catch((err) => {
    logger.error({ err: err?.message }, 'dunning-agent trigger failed');
  });
}
