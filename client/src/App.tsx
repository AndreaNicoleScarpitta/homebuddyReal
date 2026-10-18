import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useSearch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { SplashScreen } from "@/components/splash-screen";
import { DefinitionsProvider } from "@/hooks/use-definitions";
import { DefinitionsDrawer } from "@/components/definitions-drawer";
import { useAuth } from "@/hooks/use-auth";
import { useAnalytics } from "@/hooks/use-analytics";
import { useKeyboardScroll } from "@/hooks/use-keyboard-scroll";
import { initGA, trackSlugPageView } from "@/lib/analytics";
import { validateUniqueSlugs, PAGE_SLUGS } from "@/lib/slug-registry";
import { initSentry } from "@/lib/sentry";

// Init Sentry before any render so it can capture errors from the first paint.
initSentry();

// Eagerly loaded — core app pages
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import DocumentAnalysis from "@/pages/document-analysis";
import Onboarding from "@/pages/onboarding";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import MaintenanceLog from "@/pages/maintenance-log";
import Profile from "@/pages/profile";
import MyHouse from "@/pages/house";
import Systems from "@/pages/systems";
import SystemDetail from "@/pages/system-detail";
import Disclaimer from "@/pages/disclaimer";
import CalendarPage from "@/pages/calendar";
import Chat from "@/pages/chat";
import TransferKit from "@/pages/transfer-kit";

// Lazy-loaded — marketing/billing pages
const Support = lazy(() => import("@/pages/support"));

// Lazy-loaded — guide/article pages (code splitting for SEO content)
const MonthlyChecklist = lazy(() => import("@/pages/guides/monthly-checklist"));
const AnnualSchedule = lazy(() => import("@/pages/guides/annual-schedule"));
const NewHomeowner = lazy(() => import("@/pages/guides/new-homeowner"));
const First90Days = lazy(() => import("@/pages/guides/first-90-days"));
const HomeInspection = lazy(() => import("@/pages/guides/home-inspection"));
const MaintenanceCost = lazy(() => import("@/pages/guides/maintenance-cost"));
const PrintableSchedule = lazy(() => import("@/pages/guides/printable-schedule"));

// Loading fallback for lazy routes
function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// Import TermsContent for public terms page
import { TermsContent } from "@/pages/terms";

function PublicTermsPage() {
  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.terms);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-2">
          <img src="/images/home-buddy-icon.webp" alt="Home Buddy" className="h-8 w-8 rounded-lg object-cover" loading="lazy" width="32" height="32" />
          <span className="text-xl font-heading font-bold">Home Buddy</span>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <TermsContent />
      </div>
    </div>
  );
}

/** Map historical bookmarks to the new property context without losing filters. */
function LegacyHouseRedirect({ section = "files", fromRecords = false, focus }: { section?: string; fromRecords?: boolean; focus?: string }) {
  const params = new URLSearchParams(useSearch());
  const recordType = params.get("type");
  const destination = fromRecords
    ? ({ documents: "files", warranties: "coverage", insurance: "coverage", utilities: "services" } as Record<string, string>)[recordType || ""] || "files"
    : section;
  if (destination === "systems") {
    const type = params.get("type");
    return <Redirect to={type ? `/house/systems?type=${encodeURIComponent(type)}` : "/house/systems"} />;
  }
  const allowed = ["files", "coverage", "services", "history", "tools"];
  const category = focus || (fromRecords ? recordType : null);
  const extra = destination === "coverage" && (category === "insurance" || category === "warranties")
    ? `&focus=${category}` : "";
  return <Redirect to={`/house?section=${allowed.includes(destination) ? destination : "files"}${extra}`} />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  useAnalytics();
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem("splashShown");
    const params = new URLSearchParams(window.location.search);
    const fromAuth = params.get("auth") === "success";
    if (hasSeenSplash || fromAuth) {
      setShowSplash(false);
      setSplashComplete(true);
      if (!hasSeenSplash) {
        sessionStorage.setItem("splashShown", "true");
      }
      if (fromAuth) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem("splashShown", "true");
    setShowSplash(false);
    setSplashComplete(true);
  };
  
  // Public visitors should see the landing or signup page immediately, not a
  // timed branded animation. Preserve the existing splash for returning users
  // arriving at the authenticated home dashboard.
  const isDashboardEntry = window.location.pathname === "/" || window.location.pathname === "/dashboard";
  if (showSplash && !splashComplete && !isLoading && isAuthenticated && isDashboardEntry) {
    return (
      <AnimatePresence>
        <SplashScreen onComplete={handleSplashComplete} />
      </AnimatePresence>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      // Page-level boundary inside the outer ErrorBoundary in <App />:
      // a crash in a public page falls back to an inline retry instead of
      // nuking the whole app shell (toasts, tooltips, query client).
      <ErrorBoundary scope="public-routes" inline>
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/support" component={Support} />
            <Route path="/pricing"><Redirect to="/support" /></Route>
            <Route path="/terms" component={PublicTermsPage} />
            <Route path="/contact" component={Contact} />
            <Route path="/guides/home-maintenance-checklist-by-month" component={MonthlyChecklist} />
            <Route path="/guides/annual-home-maintenance-schedule" component={AnnualSchedule} />
            <Route path="/guides/what-to-maintain-in-a-new-house" component={NewHomeowner} />
            <Route path="/guides/first-90-days-after-buying-a-house" component={First90Days} />
            <Route path="/guides/what-to-fix-after-home-inspection" component={HomeInspection} />
            <Route path="/guides/how-much-does-home-maintenance-cost" component={MaintenanceCost} />
            <Route path="/guides/printable-home-maintenance-schedule" component={PrintableSchedule} />
            <Route component={Landing} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <>
      <ErrorBoundary scope="authed-routes" inline>
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/onboarding" component={Onboarding} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/document-analysis" component={DocumentAnalysis} />
            <Route path="/disclaimer" component={Disclaimer} />

            <Route path="/maintenance-log" component={MaintenanceLog} />
            <Route path="/house/systems" component={Systems} />
            <Route path="/house" component={MyHouse} />
            <Route path="/systems/:id" component={SystemDetail} />
            <Route path="/systems"><LegacyHouseRedirect section="systems" /></Route>
            <Route path="/records"><LegacyHouseRedirect fromRecords /></Route>
            <Route path="/documents"><LegacyHouseRedirect section="files" /></Route>
            <Route path="/warranties"><LegacyHouseRedirect section="coverage" focus="warranties" /></Route>
            <Route path="/insurance"><LegacyHouseRedirect section="coverage" focus="insurance" /></Route>
            <Route path="/utilities"><LegacyHouseRedirect section="services" /></Route>
            <Route path="/profile" component={Profile} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/contact" component={Contact} />
            <Route path="/terms" component={Terms} />
            <Route path="/timeline"><LegacyHouseRedirect section="history" /></Route>
            <Route path="/intelligence"><Redirect to="/dashboard" /></Route>
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/chat" component={Chat} />
            <Route path="/transfer-kit" component={TransferKit} />
            <Route path="/support" component={Support} />
            <Route path="/pricing"><Redirect to="/support" /></Route>

            {/* Public guides — accessible to authenticated users too */}
            <Route path="/guides/home-maintenance-checklist-by-month" component={MonthlyChecklist} />
            <Route path="/guides/annual-home-maintenance-schedule" component={AnnualSchedule} />
            <Route path="/guides/what-to-maintain-in-a-new-house" component={NewHomeowner} />
            <Route path="/guides/first-90-days-after-buying-a-house" component={First90Days} />
            <Route path="/guides/what-to-fix-after-home-inspection" component={HomeInspection} />
            <Route path="/guides/how-much-does-home-maintenance-cost" component={MaintenanceCost} />
            <Route path="/guides/printable-home-maintenance-schedule" component={PrintableSchedule} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

function App() {
  useKeyboardScroll();
  useEffect(() => {
    if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
      initGA();
    }
    if (import.meta.env.DEV) {
      validateUniqueSlugs();
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DefinitionsProvider>
            <Toaster />
            <DefinitionsDrawer />
            <Router />
          </DefinitionsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
