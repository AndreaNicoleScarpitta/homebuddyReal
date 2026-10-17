/**
 * Only former subscription features need StripeSync managed webhooks/backfill.
 * One-time donations use Stripe Checkout directly. Keep legacy synchronization
 * opt-in so unrelated app boot / home usage are not tied to Stripe account API.
 */
export function shouldInitializeLegacyStripeSync(
  env: { STRIPE_SYNC_ENABLED?: string } = process.env,
): boolean {
  return env.STRIPE_SYNC_ENABLED === "1";
}
