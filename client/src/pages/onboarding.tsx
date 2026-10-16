import React from "react";
/** Required home setup: ZIP, optional system selection, then the real Plan.
 * Database recovery and failed-category retries preserve completed writes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Home } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createHome, createSystem, getHome, getSystems, getTasks } from "@/lib/api";
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
import { useAuth } from "@/hooks/use-auth";
import { saveGuidance } from "@/lib/guidance";


type Step = "house-basics" | "systems-quickpick";

export default function Onboarding() {
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const selectionKey = `homebuddy:onboarding-selection:${user?.id}`;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("house-basics");
  const [basics, setBasics] = useState<HouseBasics>({ zipCode: "", builtYear: "", sqFt: "" });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [createdHome, setCreatedHome] = useState<V2Home | null>(null);
  const createdCategories = useRef(new Set<string>());
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resuming, setResuming] = useState(true);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.onboarding);
    trackEvent("setup_started", "onboarding", "v1");
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
        if (!sessionStorage.getItem(selectionKey)) { setLocation("/maintenance-log"); return; }
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

        const selection = sessionStorage.getItem(selectionKey);
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
  }, [selectionKey]);

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
      trackEvent("minimum_home_saved", "onboarding", "confirmed");
    },
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error("[onboarding] createHome failed:", error);
      toast({
        title: "We could not save your home. Try again.",
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

  const handleHouseBasicsNext = useCallback(() => {
    trackEvent("onboarding_step", "onboarding", "zip_completed");
    sessionStorage.setItem(selectionKey, "[]");
    setStep("systems-quickpick");
  }, [selectionKey]);

  const handleSystemsToggle = useCallback((category: string) => {
    setSelectedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      sessionStorage.setItem(selectionKey, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [selectionKey]);

  const handleSystemsNext = useCallback(async (skipSystems = false) => {
    if (submissionInFlight.current || resuming) return;
    submissionInFlight.current = true;
    setIsSaving(true);
    try {
    trackEvent("onboarding_step", "onboarding", "systems_selected", selectedSystems.size);

    // Save the minimum home once; subsequent retries only add missing systems.
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
        categories: skipSystems ? [] : Array.from(selectedSystems),
      });

      if (result.failed.length) {
        setSystemError(`Your home is saved. Some systems could not be added: ${result.failed.join(", ")}. Retry failed systems or continue to Plan.`);
        return;
      }
      // Confirm system writes. Empty task results are valid; Plan owns task recovery.
      const [persistedSystems, persistedTasks] = await Promise.all([
        getSystems(home.id).catch(error => { if (skipSystems || !selectedSystems.size) return null; throw error; }), getTasks(home.id).catch(() => null),
      ]);
      const found = (persistedSystems ?? []).filter(system =>
        system.source === "onboarding-quickpick" && selectedSystems.has(system.category)
      );
      const missing = Array.from(selectedSystems).filter(category => !found.some(system => system.category === category));
      if (!skipSystems && missing.length) {
        setSystemError("Your home is saved. Some systems could not be confirmed. Retry failed systems or continue to Plan.");
        return;
      }
      createdCategories.current = new Set(found.map(system => system.category));

      if (persistedSystems) queryClient.setQueryData(["systems", home.id], persistedSystems);
      if (persistedTasks) queryClient.setQueryData(["tasks", home.id], persistedTasks);
      await queryClient.invalidateQueries({ queryKey: ["tasks", home.id] });
      sessionStorage.removeItem(selectionKey);
      sessionStorage.setItem(`homebuddy:plan-first-entry:${user?.id}`, "1");
      await saveGuidance({ version: 1, status: "active", moment: 1 }, user?.id);
      trackEvent("setup_finished", "onboarding", "confirmed", persistedTasks?.length);
      setLocation("/maintenance-log?guide=new");
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : "Unable to create your systems. Please try again.");
    }
    } finally {
      submissionInFlight.current = false;
      setIsSaving(false);
    }
  }, [createdHome, basics, selectedSystems, createHomeMutation, createSystemsMutation, toast, resuming, queryClient, user?.id, selectionKey]);

  // Setup progress is separate from optional education.
  const progressIndex =
    step === "house-basics" ? 0 : 1;

  if (!resuming && systemError && !createdHome && !basics.zipCode) return <div role="alert" className="p-8">We could not load your home. <button onClick={() => window.location.reload()}>Try again</button></div>;

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
            {[0, 1].map((i) => (
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
          initial={reducedMotion ? false : { opacity: 0, x: 20 }}
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
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  progressIndex >= i ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>

          <p className="text-sm font-medium uppercase tracking-wide">Home setup · {progressIndex + 1} of 2</p>
          {isSaving && <p role="status">{createHomeMutation.isPending ? "Saving your home…" : "Creating your plan…"}</p>}
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
                onNext={() => handleSystemsNext()}
                onSkip={() => handleSystemsNext(true)}
                onBack={() => setStep("house-basics")}
                isSubmitting={isSaving}
              />
              {systemError && createdHome && <button className="min-h-11 underline" disabled={isSaving} onClick={() => handleSystemsNext(true)}>Continue to Plan</button>}
              {systemError && <p role="alert" data-testid="onboarding-systems-error" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{systemError}</p>}
              {createHomeMutation.isError && (
                <div
                  className="mt-4 flex gap-3 items-start p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm"
                  data-testid="onboarding-error"
                  role="alert"
                >
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-destructive">
                      We could not save your home. Try again.
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


        </motion.div>
      </div>
    </div>
  );
}
