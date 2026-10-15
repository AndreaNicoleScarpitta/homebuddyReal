import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { HeartHandshake, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trackSlugPageView } from "@/lib/analytics";

const AMOUNTS = [5, 10, 25, 50] as const;

export default function Support() {
  const [amount, setAmount] = useState<number>(10);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const search = useSearch();
  const success = new URLSearchParams(search).get("donation") === "success";
  useEffect(() => { trackSlugPageView("support"); }, []);

  const donate = async () => {
    setPending(true);
    try {
      const csrf = await fetch("/api/csrf-token", { credentials: "include" });
      if (!csrf.ok) throw new Error("Unable to start a secure checkout.");
      const { token } = await csrf.json();
      const res = await fetch("/api/donations/checkout", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Donation checkout is unavailable.");
      window.location.assign(data.url);
    } catch (error) {
      toast({ title: "Donation unavailable", description: error instanceof Error ? error.message : "Please try again later.", variant: "destructive" });
    } finally { setPending(false); }
  };

  return <div className="min-h-screen bg-background px-5 py-12">
    <main className="max-w-lg mx-auto space-y-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/> Home Buddy</Link>
      <div className="rounded-2xl border bg-card p-7 space-y-6" data-testid="donation-page">
        <HeartHandshake className="h-9 w-9 text-primary" />
        <div className="space-y-2">
          <h1 className="text-3xl font-heading font-bold">Support Home Buddy</h1>
          <p className="text-muted-foreground">Home Buddy is free for homeowners. If it helps you care for your house, you can support its development with a voluntary one-time donation.</p>
          <p className="text-sm text-muted-foreground">No subscriptions, no upgrade tiers, and no exclusive features for donors.</p>
        </div>
        {success && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">Thank you for supporting Home Buddy. Your payment confirmation is provided by Stripe.</p>}
        <fieldset className="space-y-3"><legend className="font-medium text-sm">Choose an amount (USD)</legend>
          <div className="grid grid-cols-4 gap-2">
            {AMOUNTS.map(n => <button key={n} type="button" onClick={() => setAmount(n)}
              aria-pressed={amount === n}
              className={`rounded-lg border p-3 font-medium focus-visible:outline-2 focus-visible:outline-primary ${amount === n ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
              data-testid={`donation-amount-${n}`}>${n}</button>)}
          </div>
        </fieldset>
        <Button className="w-full" disabled={pending} onClick={donate} data-testid="button-donate-checkout">{pending ? "Opening secure checkout…" : `Donate $${amount} once`}</Button>
        <p className="text-xs text-center text-muted-foreground">Payments are processed by Stripe. Donations do not alter existing billing subscriptions.</p>
      </div>
    </main>
  </div>;
}
