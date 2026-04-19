import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { Check, Home, Sparkles, Crown, ArrowRight, Settings } from "lucide-react";
import { trackSlugPageView } from "@/lib/analytics";

interface Plan {
  id: "free" | "plus" | "premium";
  name: string;
  priceMonthly: number;
  features: string[];
  popular: boolean;
  available: boolean;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Home,
  plus: Sparkles,
  premium: Crown,
};

const PLAN_TAGLINES: Record<string, string> = {
  free: "For one home, up to 4 systems",
  plus: "Two homes, every system tracked",
  premium: "Up to four homes — for landlords and multi-property owners",
};

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { plan: currentPlan, data: planData, isPaid } = usePlan();

  useEffect(() => {
    trackSlugPageView("pricing");
  }, []);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/billing/plans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: "plus" | "premium") => {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Checkout unavailable", description: err.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unable to open billing portal");
      }
      return res.json();
    },
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (err: Error) => {
      toast({ title: "Billing portal unavailable", description: err.message, variant: "destructive" });
    },
  });

  const handlePlanClick = (plan: Plan) => {
    // Current plan → open billing portal (if paid) or go to dashboard (if free)
    if (plan.id === currentPlan) {
      if (isPaid && planData?.hasStripeCustomer) {
        portalMutation.mutate();
      } else {
        setLocation(isAuthenticated ? "/dashboard" : "/signup");
      }
      return;
    }
    if (plan.id === "free") {
      setLocation(isAuthenticated ? "/dashboard" : "/signup");
      return;
    }
    if (!isAuthenticated) {
      setLocation(`/signup?next=/pricing`);
      return;
    }
    checkoutMutation.mutate(plan.id as "plus" | "premium");
  };

  const buttonLabel = (plan: Plan): string => {
    if (plan.id === currentPlan) return isPaid ? "Manage billing" : "Current plan";
    if (plan.priceMonthly === 0) return "Start free";
    const isDowngrade = currentPlan === "premium" && plan.id === "plus";
    return isDowngrade ? "Downgrade" : "Get " + plan.name;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/home-buddy-icon.webp" alt="Home Buddy" className="h-8 w-8 rounded-lg" loading="lazy" width="32" height="32" />
            <span className="font-heading font-semibold text-lg">Home Buddy</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link href="/signup"><Button size="sm">Get started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30">
          Simple pricing
        </Badge>
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4 tracking-tight">
          Know what your home needs.<br />
          <span className="text-primary">Before it becomes a crisis.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Start free. Upgrade when you're ready to stop juggling spreadsheets, sticky notes, and your mental calendar.
        </p>
      </div>

      {/* Current usage snapshot (authenticated only) */}
      {isAuthenticated && planData && (
        <div className="max-w-4xl mx-auto px-6 pb-10">
          <div className="border border-border rounded-xl p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Your usage this month</h3>
              <span className="text-xs text-muted-foreground">
                {planData.planName} plan
              </span>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: "Homes", current: planData.usage.homes, limit: planData.limits.maxHomes },
                { label: "Active tasks", current: planData.usage.activeTasks, limit: planData.limits.maxActiveTasks },
                { label: "Doc analyses", current: planData.usage.docAnalysesThisMonth, limit: planData.limits.maxDocAnalysesPerMonth },
                { label: "AI reports", current: planData.usage.aiReportsThisMonth, limit: planData.limits.maxAiReportsPerMonth },
              ] as const).map((row) => {
                const pct = row.limit ? Math.min(100, Math.round((row.current / row.limit) * 100)) : 0;
                const atLimit = row.limit !== null && row.current >= row.limit;
                return (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className={`text-sm font-semibold ${atLimit ? "text-destructive" : "text-foreground"}`}>
                        {row.current}<span className="text-muted-foreground">/{row.limit ?? "∞"}</span>
                      </span>
                    </div>
                    {row.limit !== null ? (
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
              })}
            </div>
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-2xl p-8 animate-pulse h-96 bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = PLAN_ICONS[plan.id];
              const isPopular = plan.popular;
              const isCurrent = isAuthenticated && plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`relative border rounded-2xl p-8 bg-card transition-all ${
                    isCurrent ? "border-primary ring-2 ring-primary/30 shadow-lg" :
                    isPopular ? "border-primary shadow-lg scale-[1.02]" :
                    "border-border hover:border-primary/30"
                  }`}
                  data-testid={`pricing-card-${plan.id}`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Your plan</Badge>
                    </div>
                  )}
                  {!isCurrent && isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg ${isPopular ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-heading font-bold text-xl">{plan.name}</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-6">{PLAN_TAGLINES[plan.id]}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-heading font-bold text-foreground">
                        ${plan.priceMonthly}
                      </span>
                      {plan.priceMonthly > 0 && (
                        <span className="text-sm text-muted-foreground">/month</span>
                      )}
                    </div>
                    {plan.priceMonthly === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Free forever. No credit card.</p>
                    )}
                  </div>

                  <Button
                    onClick={() => handlePlanClick(plan)}
                    disabled={(!plan.available && plan.id !== "free" && !isCurrent) || checkoutMutation.isPending || portalMutation.isPending}
                    className="w-full gap-1.5"
                    variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
                    size="lg"
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {isCurrent && isPaid ? <Settings className="h-4 w-4" /> : null}
                    {buttonLabel(plan)}
                    {!isCurrent && <ArrowRight className="h-4 w-4" />}
                  </Button>
                  {isCurrent && planData?.planStatus === "past_due" && (
                    <p className="text-xs text-destructive mt-2 text-center font-medium">
                      Payment past due — update card in billing portal
                    </p>
                  )}
                  {isCurrent && planData?.planRenewsAt && planData.planStatus === "active" && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Renews {new Date(planData.planRenewsAt).toLocaleDateString()}
                    </p>
                  )}

                  {!plan.available && plan.id !== "free" && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Checkout not yet configured
                    </p>
                  )}

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isPopular ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-heading font-bold text-center mb-8">Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. One-click cancel from your profile. No phone call, no cancellation survey. Your data stays with you.",
              },
              {
                q: "What happens to my data if I downgrade?",
                a: "Nothing gets deleted. You'll just lose access to premium features until you upgrade again.",
              },
              {
                q: "Is there a free trial on Plus or Pro?",
                a: "The Free plan is your trial — no time limit. Use it forever, upgrade when you want more.",
              },
              {
                q: "Do you offer a lifetime deal?",
                a: "Not yet. We're still early and want to keep things sustainable for everyone.",
              },
              {
                q: "Who built this?",
                a: "A homeowner who got tired of watching their friends drown in deferred maintenance. Home Buddy is built by one person who uses it every day.",
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-border pb-6 last:border-0">
                <h3 className="font-heading font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">Not ready to commit? Start with the free plan.</p>
          <Link href={isAuthenticated ? "/dashboard" : "/signup"}>
            <Button size="lg" variant="outline" className="gap-1.5">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
