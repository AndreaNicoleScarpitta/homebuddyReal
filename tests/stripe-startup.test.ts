import { describe, expect, it } from "vitest";
import { shouldInitializeLegacyStripeSync } from "../server/lib/stripe-startup";

describe("legacy subscription sync startup gate", () => {
  it("defaults to disabled for donation-only deployments", () => {
    expect(shouldInitializeLegacyStripeSync({})).toBe(false);
    expect(shouldInitializeLegacyStripeSync({ STRIPE_SYNC_ENABLED: "0" })).toBe(false);
  });

  it("requires explicit exact opt-in, never a Stripe key alone", () => {
    expect(shouldInitializeLegacyStripeSync({ STRIPE_SYNC_ENABLED: "true" })).toBe(false);
    expect(shouldInitializeLegacyStripeSync({ STRIPE_SYNC_ENABLED: "1" })).toBe(true);
  });
});
