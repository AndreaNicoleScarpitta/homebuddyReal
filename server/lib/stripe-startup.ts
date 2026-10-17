/**
 * One-time donations use Stripe Checkout directly; historical subscription
 * reconciliation and managed webhook synchronization are an explicit opt-in.
 */
export function shouldInitializeLegacyStripeSync(
  enabled: string | undefined = process.env.STRIPE_SYNC_ENABLED,
): boolean {
  return enabled === "1";
}
