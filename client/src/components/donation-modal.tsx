import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent, trackModalOpen } from "@/lib/analytics";
import { MODAL_SLUGS } from "@/lib/slug-registry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, X, Coffee, Sparkles } from "lucide-react";

interface DonationStatus {
  loginCount: number;
  hasDonated: boolean;
  snoozeUntilLoginCount: number | null;
}

interface DonationTier {
  productId: string;
  productName: string;
  description: string;
  priceId: string;
  amount: number;
}

interface DonationConfig {
  publishableKey: string;
  donations: DonationTier[];
}

function shouldShowModal(status: DonationStatus): boolean {
  if (status.hasDonated) return false;
  const count = status.loginCount || 0;
  if (count < 3) return false;
  if (count > 200) return false;
  if (status.snoozeUntilLoginCount && count < status.snoozeUntilLoginCount) return false;
  if (count <= 10) return true;
  if (status.snoozeUntilLoginCount && count >= status.snoozeUntilLoginCount) return true;
  return false;
}

const tierIcons = [Coffee, Heart, Sparkles];
const tierLabels = ["$1", "$5", "$10"];

export function DonationModal() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: status } = useQuery<DonationStatus>({
    queryKey: ["donationStatus"],
    queryFn: async () => {
      const res = await fetch("/api/donations/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch donation status");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10,
  });

  const { data: config } = useQuery<DonationConfig>({
    queryKey: ["donationConfig"],
    queryFn: async () => {
      const res = await fetch("/api/donations/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch donation config");
      return res.json();
    },
    enabled: isAuthenticated && open,
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/donations/snooze", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to snooze");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donationStatus"] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  useEffect(() => { if (open) trackModalOpen(MODAL_SLUGS.donation); }, [open]);

  useEffect(() => {
    if (status && !dismissed && shouldShowModal(status)) {
      const sessionKey = `donation_modal_shown_${status.loginCount}`;
      if (!sessionStorage.getItem(sessionKey)) {
        const timer = setTimeout(() => {
          setOpen(true);
          sessionStorage.setItem(sessionKey, "true");
          trackEvent("donation_modal_shown", "donations", `login_${status.loginCount}`);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [status, dismissed]);

  const handleDismiss = (explicit = false) => {
    setOpen(false);
    setDismissed(true);
    if (explicit) {
      snoozeMutation.mutate();
      trackEvent("donation_modal_dismissed", "donations", "snooze");
    } else {
      trackEvent("donation_modal_closed", "donations", "backdrop");
    }
  };

  const handleDonate = (priceId: string, amount: number) => {
    trackEvent("donation_checkout_started", "donations", `$${amount / 100}`);
    checkoutMutation.mutate(priceId);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(false); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-donation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <Heart className="h-5 w-5 text-primary" />
            Support Home Buddy
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            If Home Buddy has been helpful, a small one-time donation helps keep it running.
            No pressure at all.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4">
          {(config?.donations || []).map((tier, i) => {
            const Icon = tierIcons[i] || Heart;
            return (
              <Button
                key={tier.priceId}
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4 hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => handleDonate(tier.priceId, tier.amount)}
                disabled={checkoutMutation.isPending}
                data-testid={`button-donate-${tier.amount}`}
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">{tierLabels[i]}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDismiss(true)}
            className="text-muted-foreground text-xs"
            data-testid="button-donation-dismiss"
          >
            No thanks, maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
