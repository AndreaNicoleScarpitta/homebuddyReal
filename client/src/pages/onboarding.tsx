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
 *                         system and atomically commits starter maintenance
 *                         task events in the V2 model.
 *   3. first-tasks        The magic moment — we read back the generated
 *                         tasks so the user sees immediate value.
 *   4. inspection-alt     Optional fork for "power users" who want to
 *                         upload an inspection PDF. Otherwise skip to
 *                         the dashboard.
 *
 * The orchestrator waits until all selected systems are saved before
 * showing starter tasks. Failed categories remain retryable.
 *
 * Error recovery: step 2 is where things can fail (CSRF, network, 500).
 * We keep the user on the step with an explicit error and retry the
 * failed categories rather than falsely reporting plan creation.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createHome, createSystem, getHome, getSystems, getTasks, repairStarterTasks } from "@/lib/api";
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
  const createdCategories = useRef(new Set<string>());
  const [systemError, setSystemError] = useState<string | null>(null);
  const [createdSystemsCount, setCreatedSystemsCount] = useState(0);
  const [resuming, setResuming] = useState(true);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.onboarding);
  }, []);

  // Recover from refresh or a lost POST response using database state, not
  // ephemeral React mutation state. Only the selected category IDs (never an
  // address or credentials) are cached in this tab for interrupted onboarding.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const home = await getHome();
        if (!active || !home?.id) return;
        setCreatedHome(home);
        setBasics({
          zipCode: home.zipCode || "",
          builtYear: home.builtYear ? String(home.builtYear) : "",
          sqFt: home.sqFt ? String(home.sqFt) : "",
        });
        const systems = await getSystems(home.id);
        if (!active) return;
        const saved = systems.filter(system => system.source === "onboarding-quickpick");
        createdCategories.current = new Set(saved.map(system => system.category));
        setCreatedSystemsCount(saved.length);
        const selection = sessionStorage.getItem("homebuddy:onboarding-selection");
        if (selection) {
          try {
            const parsed = JSON.parse(selection);
            if (Array.isArray(parsed)) {
              setSelectedSystems(new Set(parsed.filter(
                value => typeof value === "string" &&
                  SYSTEM_CHOICES.some(choice => choice.category === value)
              )));
            }
          } catch { /* Invalid stale selection: use persisted systems. */ }
        } else if (saved.length) {
          setSelectedSystems(new Set(saved.map(system => system.category)));
        }
        setStep("systems-quickpick");
      } catch (err) {
        if (active) setSystemError(err instanceof Error ? err.message : "Could not resume setup.");
      } finally {
        if (active) setResuming(false);
      }
    })();
    return () => { active = false; };
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
      const failed: string[] = [];
      for (const category of categories) {
        if (createdCategories.current.has(category)) continue;
        const choice = SYSTEM_CHOICES.find((c) => c.category === category);
        if (!choice) continue;
        try {
          await createSystem(homeId, {
            name: choice.name,
            category: choice.category,
            source: "onboarding-quickpick",
          });
          createdCategories.current.add(category);
        } catch (err: any) {
          console.error(`[onboarding] createSystem(${category}) failed:`, err);
          failed.push(choice.name);
        }
      }
      return { failed, saved: createdCategories.current.size };
    },
    onSuccess: (_result, { homeId }) => {
      queryClient.invalidateQueries({ queryKey: ["systems", homeId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", homeId] });
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
    // Task creation is atomic with system creation, so polling is unnecessary.
    staleTime: 0,
    retry: 1,
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
      sessionStorage.setItem("homebuddy:onboarding-selection", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleSystemsNext = useCallback(async () => {
    if (submissionInFlight.current || resuming) return;
    submissionInFlight.current = true;
    try {
    trackEvent("onboarding_step", "onboarding", "systems_selected", selectedSystems.size);

    // We create the home lazily here rather than on house-basics → systems
    // so that if the user backs out, nothing is persisted. The tradeoff is
    // one slightly longer wait when they hit "Show me my plan."
    let home = createdHome;
    if (!home) {
      try {
        home = await createHomeMutation.mutateAsync({
          onboarding: true,
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

    // Wait for the server to commit systems AND their starter tasks before
    // displaying the results. Failed requests must never look successful.
    setSystemError(null);
    try {
      const result = await createSystemsMutation.mutateAsync({
        homeId: home.id,
        categories: Array.from(selectedSystems),
      });
      setCreatedSystemsCount(result.saved);
      if (result.failed.length) {
        setSystemError(`Couldn't save: ${result.failed.join(", ")}. Try again to finish setup.`);
        return;
      }
      // Verify persisted systems AND their starter tasks before advertising
      // success. Repair only missing templates, never overwrite user tasks.
      await repairStarterTasks(home.id);
      const [persistedSystems, persistedTasks] = await Promise.all([
        getSystems(home.id), getTasks(home.id),
      ]);
      const found = persistedSystems.filter(system =>
        system.source === "onboarding-quickpick" && selectedSystems.has(system.category)
      );
      const missing = Array.from(selectedSystems).filter(category =>
        !found.some(system => system.category === category &&
          persistedTasks.some(task => task.relatedSystemId === system.id &&
            task.createdFrom === "best-practice"))
      );
      if (missing.length || !persistedTasks.length) {
        setSystemError("Some maintenance tasks are missing. Please retry setup.");
        return;
      }
      createdCategories.current = new Set(found.map(system => system.category));
      setCreatedSystemsCount(found.length);
      queryClient.setQueryData(["systems", home.id], persistedSystems);
      queryClient.setQueryData(["tasks", home.id], persistedTasks);
      await queryClient.invalidateQueries({ queryKey: ["tasks", home.id] });
      setStep("first-tasks");
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : "Unable to create your systems. Please try again.");
    }
    } finally {
      submissionInFlight.current = false;
    }
  }, [createdHome, basics, selectedSystems, createHomeMutation, createSystemsMutation, toast, resuming, queryClient]);

  const handleUploadInspectionFork = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "inspection_fork_chosen");
    setStep("inspection-alt");
  }, []);

  const handleGoToDashboard = useCallback(() => {
    if (!tasksQuery.data?.length || tasksQuery.isError) {
      setSystemError("Your maintenance plan is not ready. Return to systems and retry.");
      setStep("systems-quickpick");
      return;
    }
    sessionStorage.removeItem("homebuddy:onboarding-selection");
    trackEvent("onboarding_step", "onboarding", "done_to_dashboard");
    toast({
      title: "Home setup complete",
      description: "Your systems and available maintenance tasks are saved.",
    });
    setLocation("/dashboard");
  }, [setLocation, toast, tasksQuery.data, tasksQuery.isError]);

  const handleGoToInspectionsUpload = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "inspection_upload_redirect");
    setLocation("/document-analysis");
  }, [setLocation]);

  // Progress dots — one per step in the happy path. The inspection-alt
  // fork is intentionally not counted — it's a branch, not a gate.
  const progressIndex =
    step === "house-basics" ? 0 : step === "systems-quickpick" ? 1 : 2;

  if (resuming) return <div className="min-h-screen flex items-center justify-center text-muted-foreground" role="status">Restoring your home setup…</div>;

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
                isSubmitting={createHomeMutation.isPending || createSystemsMutation.isPending}
              />
              {systemError && <p role="alert" data-testid="onboarding-systems-error" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{systemError}</p>}
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
              hasError={tasksQuery.isError}
              systemsCount={createdSystemsCount}
              isLoading={
                createSystemsMutation.isPending || tasksQuery.isLoading
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
