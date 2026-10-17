import { describe, expect, it } from "vitest";
import { shouldInitializeLegacyStripeSync } from "../server/lib/stripe-startup";

describe("legacy subscription sync startup gate", () => {
  it("is disabled when not opted in", () => {
    expect(shouldInitializeLegacyStripeSync(undefined)).toBe(false);
    expect(shouldInitializeLegacyStripeSync("0")).toBe(false);
  });

  it("requires explicit exact opt-in", () => {
    expect(shouldInitializeLegacyStripeSync("true")).toBe(false);
    expect(shouldInitializeLegacyStripeSync("1")).toBe(true);
  });
});
