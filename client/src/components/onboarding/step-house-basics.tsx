/**
 * Step 1 of the onboarding flip: ZIP only required.
 *
 * Design intent — we ruthlessly trim the original "full address + state
 * dropdown + city field" form down to a single required ZIP. Year built
 * and square footage are shown inline but suggested, not required; the
 * whole screen should feel like "10 seconds of typing, see value next."
 *
 * Full address (street, city, state) is deferred to the profile page
 * under a "Complete your address" nudge that unlocks contractor matching
 * and permit lookups. See `client/src/pages/profile.tsx`.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";
import { FieldTooltip } from "@/components/field-tooltip";

export interface HouseBasics {
  zipCode: string;
  builtYear: string;
  sqFt: string;
}

interface StepHouseBasicsProps {
  value: HouseBasics;
  onChange: (next: HouseBasics) => void;
  onNext: () => void;
}

export function StepHouseBasics({ value, onChange, onNext }: StepHouseBasicsProps) {
  const { zipCode, builtYear, sqFt } = value;

  const zipValid = /^\d{5}(-\d{4})?$/.test(zipCode.trim());

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-heading font-bold text-foreground"
          data-testid="text-welcome"
        >
          What's your ZIP code?
        </h1>
        <p className="text-muted-foreground mt-1">
          That's all we need to get you your first maintenance plan — we'll
          use it for local climate, codes, and typical costs.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2 max-w-[220px]">
          <Label htmlFor="zip" className="text-sm font-medium flex items-center gap-1">
            ZIP Code <span className="text-destructive">*</span>
            <FieldTooltip termSlug="zip-code" screenName="onboarding" />
          </Label>
          <Input
            id="zip"
            value={zipCode}
            onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
            placeholder="90210"
            className="h-12 bg-secondary/30 border-border/50 focus:bg-background text-lg tracking-wide"
            maxLength={10}
            inputMode="numeric"
            data-testid="input-zip"
            autoComplete="postal-code"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              htmlFor="year"
              className="text-sm font-medium flex items-center gap-1"
            >
              Year built <span className="text-muted-foreground text-xs">(optional)</span>
              <FieldTooltip termSlug="year-built" screenName="onboarding" />
            </Label>
            <Input
              id="year"
              type="number"
              min={1600}
              max={new Date().getFullYear()}
              placeholder="e.g., 1985"
              className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
              value={builtYear}
              onChange={(e) => onChange({ ...value, builtYear: e.target.value })}
              data-testid="input-year"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="sqft"
              className="text-sm font-medium flex items-center gap-1"
            >
              Sq ft <span className="text-muted-foreground text-xs">(optional)</span>
              <FieldTooltip termSlug="square-footage" screenName="onboarding" />
            </Label>
            <Input
              id="sqft"
              type="number"
              min={100}
              max={100000}
              placeholder="e.g., 2400"
              className="h-12 bg-secondary/30 border-border/50 focus:bg-background"
              value={sqFt}
              onChange={(e) => onChange({ ...value, sqFt: e.target.value })}
              data-testid="input-sqft"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Shield className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            We don't ask for your street address yet — you can add it later
            when you want contractor matching or permit lookups. Your data
            is encrypted in transit and at rest.
          </span>
        </div>
      </div>

      <Button
        className="w-full h-12 font-medium"
        onClick={onNext}
        disabled={!zipValid}
        data-testid="button-continue"
      >
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
