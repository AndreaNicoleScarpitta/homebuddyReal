/**
 * Onboarding — the "first useful output in under 2 minutes" flow.
 *
 * Phase 1 flip: we no longer block a new user behind a long address +
 * demographics form. The only required field is ZIP. Everything else is
 * deferred to "when you want a feature that needs it" (the profile page
 * gets a nudge for full address).
 *
 * Step choreography:
 *
 *   1. house-basics       ZIP + optional year/sqft. Creates the home row.
 *   2. systems-quickpick  Tap-to-add system chips. Each selection POSTs a
 *                         system, which causes the server to generate
 *                         starter maintenance tasks via templates.
 *   3. first-tasks        The magic moment — we read back the generated
 *                         tasks so the user sees immediate value.
 *   4. inspection-alt     Optional fork for "power users" who want to
 *                         upload an inspection PDF. Otherwise skip to
 *                         the dashboard.
 *
 * The orchestration is intentionally state-only (no server draft). If the
 * user bails mid-flow, nothing is persisted until step 2 submits.
 *
 * Error recovery: step 2 is where things can fail (CSRF, network, 500).
 * We keep the user on the step with a retry button rather than failing
 * silently. If the systems POST fails but the home POST succeeded, we
 * still let the user continue — the home exists, they can add systems
 * later from the dashboard.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createHome, createSystem, getTasks } from "@/lib/api";
import type { V2Home } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, trackSlugPageView } from "@/lib/analytics";
import { PAGE_SLUGS } from "@/lib/slug-registry";
import { StepHouseBasics, type HouseBasics } from "@/components/onboarding/step-house-basics";
import {
  StepSystemsQuickpick,
  SYSTEM_CHOICES,
  DEFAULT_SELECTED,
} from "@/components/onboarding/step-systems-quickpick";
import { StepFirstTasks } from "@/components/onboarding/step-first-tasks";
import { StepInspectionAlt } from "@/components/onboarding/step-inspection-alt";

type Step = "house-basics" | "systems-quickpick" | "first-tasks" | "inspection-alt";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("house-basics");
  const [basics, setBasics] = useState<HouseBasics>({ zipCode: "", builtYear: "", sqFt: "" });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [createdHome, setCreatedHome] = useState<V2Home | null>(null);

  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.onboarding);
  }, []);

  // ---------------------------------------------------------------------
  // Mutations — createHome, then createSystem per selected category.
  // Kept as two separate mutations rather than one big batch because the
  // server has them as distinct endpoints, and if systems fail we still
  // want the home to exist so the user isn't "stuck at zero."
  // ---------------------------------------------------------------------

  const createHomeMutation = useMutation({
    mutationFn: createHome,
    onSuccess: (newHome) => {
      queryClient.setQueryData(["home"], newHome);
      queryClient.invalidateQueries({ queryKey: ["home"] });
      setCreatedHome(newHome);
    },
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error("[onboarding] createHome failed:", error);
      toast({
        title: "Couldn't create your home profile",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const createSystemsMutation = useMutation({
    mutationFn: async ({ homeId, categories }: { homeId: string; categories: string[] }) => {
      // Create systems sequentially — the server uses an idempotency key
      // per request, and running them in parallel would make it hard to
      // tell which failed if one does. The category list is ~4-6 items,
      // so the wall time is dominated by network latency, not CPU.
      const results = [];
      for (const category of categories) {
        const choice = SYSTEM_CHOICES.find((c) => c.category === category);
        if (!choice) continue;
        try {
          const created = await createSystem(homeId, {
            name: choice.name,
            category: choice.category,
            source: "onboarding-quickpick",
          });
          results.push(created);
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.error(`[onboarding] createSystem(${category}) failed:`, err);
          // Keep going — partial success is better than total failure.
        }
      }
      return results;
    },
    onSuccess: () => {
      // Tasks are generated server-side as systems are written, so the
      // next `getTasks` call will pick them up.
      if (createdHome) {
        queryClient.invalidateQueries({ queryKey: ["systems", createdHome.id] });
        queryClient.invalidateQueries({ queryKey: ["tasks", createdHome.id] });
      }
    },
  });

  const errorMessage = createHomeMutation.error?.message ?? "";
  const looksLikeCsrfError = /csrf|session|403/i.test(errorMessage);

  const handleRefreshAndRetry = useCallback(async () => {
    try {
      await fetch("/api/csrf-token", { credentials: "include", cache: "no-store" });
    } catch {
      // non-fatal
    }
    createHomeMutation.reset();
  }, [createHomeMutation]);

  // ---------------------------------------------------------------------
  // Fetch the generated tasks after systems creation for step 3.
  // Using useQuery rather than cramming it into the mutation because the
  // dashboard will also read this and we want the cache populated here.
  // ---------------------------------------------------------------------
  const tasksQuery = useQuery({
    queryKey: ["tasks", createdHome?.id],
    queryFn: () => getTasks(createdHome!.id),
    enabled: Boolean(createdHome?.id) && step === "first-tasks",
    // Task generation is fire-and-write on the server — give it a moment
    // to finish before we poll a second time, but don't spam the DB.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 800;
      if (data.length === 0) return 1500;
      return false;
    },
    staleTime: 0,
  });

  // ---------------------------------------------------------------------
  // Step transitions
  // ---------------------------------------------------------------------

  const handleHouseBasicsNext = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "zip_completed");
    setStep("systems-quickpick");
  }, []);

  const handleSystemsToggle = useCallback((category: string) => {
    setSelectedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleSystemsNext = useCallback(async () => {
    trackEvent("onboarding_step", "onboarding", "systems_selected", selectedSystems.size);

    // We create the home lazily here rather than on house-basics → systems
    // so that if the user backs out, nothing is persisted. The tradeoff is
    // one slightly longer wait when they hit "Show me my plan."
    let home = createdHome;
    if (!home) {
      try {
        home = await createHomeMutation.mutateAsync({
          zipCode: basics.zipCode.trim(),
          builtYear: basics.builtYear ? parseInt(basics.builtYear) : undefined,
          sqFt: basics.sqFt ? parseInt(basics.sqFt) : undefined,
          type: "Single Family Home",
        });
      } catch {
        // onError toast already fired; stay on this step for retry
        return;
      }
    }

    if (!home?.id) {
      toast({
        title: "Couldn't create your home",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Fire systems creation (non-blocking for the UI transition).
    // The first-tasks step polls for tasks, so it will show generated
    // results as they land.
    createSystemsMutation.mutate({
      homeId: home.id,
      categories: Array.from(selectedSystems),
    });

    setStep("first-tasks");
  }, [createdHome, basics, selectedSystems, createHomeMutation, createSystemsMutation, toast]);

  const handleUploadInspectionFork = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "inspection_fork_chosen");
    setStep("inspection-alt");
  }, []);

  const handleGoToDashboard = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "done_to_dashboard");
    toast({
      title: "You're all set!",
      description: "Your maintenance plan is ready.",
    });
    setLocation("/dashboard");
  }, [setLocation, toast]);

  const handleGoToInspectionsUpload = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "inspection_upload_redirect");
    setLocation("/inspections");
  }, [setLocation]);

  // Progress dots — one per step in the happy path. The inspection-alt
  // fork is intentionally not counted — it's a branch, not a gate.
  const progressIndex =
    step === "house-basics" ? 0 : step === "systems-quickpick" ? 1 : 2;

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
            <Home className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-heading font-bold text-foreground">
            Let's get your first plan in 90 seconds.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            ZIP, a few taps for what's in your home, and we'll have a starter
            maintenance plan waiting for you — no long forms.
          </p>
          <div className="flex gap-2 pt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-12 rounded-full ${
                  progressIndex >= i ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start md:items-center justify-center p-6 overflow-y-auto">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8 my-auto py-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-heading font-bold">Home Buddy</span>
          </div>

          <div className="lg:hidden flex gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  progressIndex >= i ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>

          {step === "house-basics" && (
            <StepHouseBasics
              value={basics}
              onChange={setBasics}
              onNext={handleHouseBasicsNext}
            />
          )}

          {step === "systems-quickpick" && (
            <>
              <StepSystemsQuickpick
                selected={selectedSystems}
                onToggle={handleSystemsToggle}
                onNext={handleSystemsNext}
                onBack={() => setStep("house-basics")}
                isSubmitting={createHomeMutation.isPending}
              />
              {createHomeMutation.isError && (
                <div
                  className="mt-4 flex gap-3 items-start p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm"
                  data-testid="onboarding-error"
                  role="alert"
                >
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-destructive">
                      Couldn't create your home profile
                    </p>
                    <p className="text-muted-foreground break-words">
                      {errorMessage || "Unknown error"}
                    </p>
                    {looksLikeCsrfError && (
                      <p className="text-xs text-muted-foreground">
                        This usually clears after refreshing your session.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRefreshAndRetry}
                        className="text-sm underline text-primary"
                        data-testid="button-refresh-retry"
                      >
                        Refresh session
                      </button>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="text-sm underline text-muted-foreground"
                        data-testid="button-hard-reload"
                      >
                        Hard reload
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === "first-tasks" && (
            <StepFirstTasks
              tasks={tasksQuery.data ?? []}
              systemsCount={selectedSystems.size}
              isLoading={
                createSystemsMutation.isPending ||
                tasksQuery.isLoading ||
                (tasksQuery.data?.length === 0 && createSystemsMutation.isPending)
              }
              onNext={handleGoToDashboard}
              onBack={() => setStep("systems-quickpick")}
              onUploadInspection={handleUploadInspectionFork}
            />
          )}

          {step === "inspection-alt" && (
            <StepInspectionAlt
              onUpload={handleGoToInspectionsUpload}
              onSkip={handleGoToDashboard}
              onBack={() => setStep("first-tasks")}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
