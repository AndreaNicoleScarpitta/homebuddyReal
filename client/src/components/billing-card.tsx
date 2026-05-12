/**
 * BillingCard — drop-in for the profile page.
 *
 * Shows current plan, renews-at date, status, and buttons:
 *   - Manage billing  (paid users) → Stripe portal
 *   - Upgrade         (free users)  → /pricing
 */

import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { useToast } from "@/hooks/use-toast";

export function BillingCard() {
  const { data, plan, planName, isPaid, isLoading } = usePlan();
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

  if (isLoading) return null;

  const pastDue = data?.planStatus === "past_due";
  const canceled = data?.planStatus === "canceled";

  return (
    <Card data-testid="billing-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Billing & Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-heading font-bold">{planName}</span>
              {isPaid && <Badge variant="outline" className="text-primary border-primary/30">${data?.priceMonthly}/mo</Badge>}
              {pastDue && <Badge variant="destructive">Past due</Badge>}
              {canceled && <Badge variant="outline" className="text-muted-foreground">Canceled</Badge>}
            </div>
            {data?.planRenewsAt && data.planStatus === "active" && (
              <p className="text-sm text-muted-foreground">
                Renews {new Date(data.planRenewsAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
            {!isPaid && (
              <p className="text-sm text-muted-foreground">
                You're on the free plan. Upgrade anytime to unlock more.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPaid ? (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending || !data?.hasStripeCustomer}
                data-testid="button-billing-portal"
              >
                Manage billing
              </Button>
            ) : (
              <Link href="/pricing">
                <Button className="gap-1.5" data-testid="button-upgrade">
                  <Sparkles className="h-4 w-4" />
                  Upgrade
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {pastDue && (
          <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Your last payment failed. Update your payment method in the billing portal to keep your {planName} features.
            </div>
          </div>
        )}

        {/* Usage summary */}
        {data && (
          <div className="pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <UsageCell label="Homes" current={data.usage.homes} limit={data.limits.maxHomes} />
            <UsageCell label="Active tasks" current={data.usage.activeTasks} limit={data.limits.maxActiveTasks} />
            <UsageCell label="Doc analyses" current={data.usage.docAnalysesThisMonth} limit={data.limits.maxDocAnalysesPerMonth} />
            <UsageCell label="AI reports" current={data.usage.aiReportsThisMonth} limit={data.limits.maxAiReportsPerMonth} />
          </div>
        )}

        {plan !== "premium" && (
          <div className="pt-2">
            <Link href="/pricing" className="text-sm text-primary hover:underline">
              Compare plans →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsageCell({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const atLimit = limit !== null && current >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-semibold ${atLimit ? "text-destructive" : "text-foreground"}`}>
          {current}<span className="text-muted-foreground">/{limit ?? "∞"}</span>
        </span>
      </div>
      {limit !== null ? (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${atLimit ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 bg-primary/20 rounded-full" />
      )}
    </div>
  );
}
