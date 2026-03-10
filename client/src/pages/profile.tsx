import { Layout } from "@/components/layout";
import { NotificationSettings } from "@/components/notification-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { User, MapPin, Home, Shield, Trash2, Wrench, Heart, Coffee, Sparkles, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHome, getNotificationPreferences, updateNotificationPreferences } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackSlugPageView, trackModalOpen } from "@/lib/analytics";
import { PAGE_SLUGS, MODAL_SLUGS } from "@/lib/slug-registry";
import { useSearch } from "wouter";
import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}

function SupportCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const supportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.get("section") === "support" && supportRef.current) {
      setTimeout(() => {
        supportRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [searchString]);

  const { data: config } = useQuery({
    queryKey: ["donationConfig"],
    queryFn: async () => {
      const res = await fetch("/api/donations/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ publishableKey: string; donations: { priceId: string; amount: number; productName: string }[] }>;
    },
  });

  const { data: status } = useQuery({
    queryKey: ["donationStatus"],
    queryFn: async () => {
      const res = await fetch("/api/donations/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ hasDonated: boolean }>;
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
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Error", description: "Could not start checkout. Please try again.", variant: "destructive" });
    },
  });

  const verifyDonationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch("/api/donations/verify-and-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donationStatus"] });
    },
  });

  useEffect(() => {
    const donationParam = params.get("donation");
    const sessionId = params.get("session_id");
    if (donationParam === "success" && sessionId) {
      verifyDonationMutation.mutate(sessionId);
      toast({ title: "Thank you!", description: "Your donation means a lot. Home Buddy will stay free for everyone." });
      trackEvent("donation_completed", "donations", "success");
      window.history.replaceState({}, "", "/profile");
    } else if (donationParam === "cancelled") {
      window.history.replaceState({}, "", "/profile");
    }
  }, []);

  const tierIcons = [Coffee, Heart, Sparkles];
  const tierLabels = ["$1", "$5", "$10"];

  return (
    <Card ref={supportRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Support Home Buddy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.hasDonated ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Thank you for your support! Your donation helps keep Home Buddy free for everyone.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Home Buddy is completely free — no ads, no premium tiers, no data selling.
              If you find it helpful, a small one-time donation helps cover hosting costs and keeps development going.
            </p>
            {config?.donations && config.donations.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {config.donations.map((tier, i) => {
                  const Icon = tierIcons[i] || Heart;
                  return (
                    <Button
                      key={tier.priceId}
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4 hover:border-primary hover:bg-primary/5 transition-colors"
                      onClick={() => {
                        trackEvent("donation_profile_click", "donations", `$${tier.amount / 100}`);
                        checkoutMutation.mutate(tier.priceId);
                      }}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-profile-donate-${tier.amount}`}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-lg font-semibold">{tierLabels[i]}</span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  trackEvent("donation_profile_click", "donations", "default_$5");
                  checkoutMutation.mutate("price_1T8mUJCsyvg4oGAnj6XYLAGy");
                }}
                disabled={checkoutMutation.isPending}
                data-testid="button-profile-donate-default"
              >
                <Heart className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending ? "Redirecting to Stripe..." : "Donate $5"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              One-time payment via Stripe. No recurring charges.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ContractorModeCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
  });

  const toggleMutation = useMutation({
    mutationFn: (contractorMode: boolean) => updateNotificationPreferences({ contractorMode } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update settings.", variant: "destructive" });
    },
  });

  const isOn = (prefs as any)?.contractorMode ?? false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Contractor Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="contractor-mode" className="text-sm font-medium">
              Enable Contractor Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, you can manually override the AI-determined DIY safety level on tasks. This is intended for licensed contractors or experienced homeowners who can safely perform work that would normally require a professional.
            </p>
          </div>
          <Switch
            id="contractor-mode"
            checked={isOn}
            disabled={isLoading || toggleMutation.isPending}
            onCheckedChange={(checked) => {
              trackEvent("toggle_contractor_mode", "settings", checked ? "enable" : "disable");
              toggleMutation.mutate(checked);
            }}
            data-testid="switch-contractor-mode"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { trackSlugPageView(PAGE_SLUGS.profile); }, []);

  const { data: home, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });


  const { data: privacy, isLoading: privacyLoading } = useQuery({
    queryKey: ["privacy"],
    queryFn: async () => {
      const res = await fetch("/api/user/privacy", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load privacy settings");
      return res.json() as Promise<{ dataStorageOptOut: boolean }>;
    },
  });

  const privacyMutation = useMutation({
    mutationFn: async (dataStorageOptOut: boolean) => {
      const res = await fetch("/api/user/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataStorageOptOut }),
      });
      if (!res.ok) throw new Error("Failed to update privacy settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy"] });
      toast({ title: "Privacy settings updated", description: "Your preference has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update privacy settings.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/data", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete data");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Data deleted", description: "All your home data has been permanently removed." });
      trackEvent("delete_all_data", "privacy", "user_data_deletion");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete your data. Please try again.", variant: "destructive" });
    },
  });


  if (isLoading) {
    return (
      <Layout>
        <ProfileSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            Profile
          </h1>
          <p className="text-muted-foreground">
            Manage your account and notification preferences
          </p>
        </header>

        <section className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Home Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="space-y-2">
                  <Label htmlFor="displayname">Name</Label>
                  <Input
                    id="displayname"
                    value={[user.firstName, user.lastName].filter(Boolean).join(" ") || "Not set"}
                    disabled
                    className="bg-muted"
                    data-testid="input-displayname"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your name is managed through your Replit account
                  </p>
                </div>
              )}

              {user?.email && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                    data-testid="input-email"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Home Address
                </Label>
                <Input
                  id="address"
                  value={home?.address || "Not set"}
                  disabled
                  className="bg-muted"
                  data-testid="input-address"
                />
                <p className="text-xs text-muted-foreground">
                  Your address is set from your home profile on the Overview page
                </p>
              </div>
            </CardContent>
          </Card>

          <NotificationSettings />

          <ContractorModeCard />

          <SupportCard />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Data & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="opt-out" className="text-sm font-medium">
                    Opt out of data storage
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, chat messages and photos will not be saved. You can still use the assistant, but conversation history will not persist between sessions.
                  </p>
                </div>
                <Switch
                  id="opt-out"
                  checked={privacy?.dataStorageOptOut ?? false}
                  disabled={privacyLoading || privacyMutation.isPending}
                  onCheckedChange={(checked) => {
                    trackEvent("toggle_data_opt_out", "privacy", checked ? "opt_out" : "opt_in");
                    privacyMutation.mutate(checked);
                  }}
                  data-testid="switch-data-opt-out"
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-destructive">
                    Delete all data
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove all your home data including systems, maintenance tasks, chat history, budget information, inspection reports, and event history. Your login account will remain active but all stored data will be gone. This cannot be undone.
                  </p>
                </div>
                <AlertDialog onOpenChange={(open) => { if (open) trackModalOpen(MODAL_SLUGS.deleteAccount); }}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-all-data"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleteMutation.isPending ? "Deleting..." : "Delete All My Data"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your home data including systems, maintenance tasks, chat history, budget information, inspection reports, and event history. Your login account will remain, but all stored data will be gone forever. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        Yes, delete everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
