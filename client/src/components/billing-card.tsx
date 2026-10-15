/**
 * BillingCard — drop-in for the profile page.
 *
 * Shows current plan, renews-at date, status, and buttons:
 *   - Manage billing  (paid users) → Stripe portal
 *   - Upgrade         (free users)  → /pricing
 */

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { useToast } from "@/hooks/use-toast";

export function BillingCard() {
  const { data, planName, isLoading } = usePlan();
  const { toast } = useToast();

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unable to open billing portal");
      }
      return res.json();
    },
    onSuccess: (r) => { if (r.url) window.location.href = r.url; },
    onError: (err: Error) => {
      toast({ title: "Billing portal unavailable", description: err.message, variant: "destructive" });
    },
  });

  // Existing subscribers must retain a route to cancel/manage ongoing
  // charges. Free users see donations in Settings, never paid upgrades.
  if (isLoading || !data?.hasStripeCustomer) return null;

  return (
    <Card data-testid="billing-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Existing subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Home Buddy no longer offers paid upgrades. If you have an existing
          subscription, you can manage or cancel it in Stripe.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Current billing status: {data?.planStatus}</span>
          {data?.planStatus === "past_due" && <Badge variant="destructive">Past due</Badge>}
          {data?.planStatus === "canceled" && <Badge variant="outline">Canceled</Badge>}
        </div>
        <Button
          variant="outline"
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending || !data?.hasStripeCustomer}
          data-testid="button-billing-portal"
        >Manage or cancel subscription</Button>
      </CardContent>
    </Card>
  );
}

