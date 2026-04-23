import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
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
import { initGA, trackSlugPageView } from "@/lib/analytics";
import { validateUniqueSlugs, PAGE_SLUGS } from "@/lib/slug-registry";
import { initSentry } from "@/lib/sentry";

// Init Sentry before any render so it can capture errors from the first paint.
initSentry();
// Donation modal temporarily disabled — was firing too eagerly on first session.
// Re-enable by restoring this import + the <DonationModal /> render below.
// import { DonationModal } from "@/components/donation-modal";

// Eagerly loaded — core app pages
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import DocumentAnalysis from "@/pages/document-analysis";
import Onboarding from "@/pages/onboarding";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import MaintenanceLog from "@/pages/maintenance-log";
import Profile from "@/pages/profile";
import Documents from "@/pages/documents";
import Systems from "@/pages/systems";
import SystemDetail from "@/pages/system-detail";
import Disclaimer from "@/pages/disclaimer";
import Timeline from "@/pages/timeline";
import Intelligence from "@/pages/intelligence";
import CalendarPage from "@/pages/calendar";

// Lazy-loaded — hidden admin-only pages (not in nav)
const AdminApprovals = lazy(() => import("@/pages/admin/approvals"));
const AdminAgents = lazy(() => import("@/pages/agents"));

// Lazy-loaded — marketing/billing pages
const Pricing = lazy(() => import("@/pages/pricing"));

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
  
  if (showSplash && !splashComplete) {
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
            <Route path="/pricing" component={Pricing} />
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
      {/* <DonationModal /> — disabled, see import above */}
      <ErrorBoundary scope="authed-routes" inline>
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/onboarding" component={Onboarding} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/document-analysis" component={DocumentAnalysis} />
            <Route path="/disclaimer" component={Disclaimer} />

            <Route path="/maintenance-log" component={MaintenanceLog} />
            <Route path="/systems/:id" component={SystemDetail} />
            <Route path="/systems" component={Systems} />
            <Route path="/documents" component={Documents} />
            <Route path="/profile" component={Profile} />
            <Route path="/contact" component={Contact} />
            <Route path="/terms" component={Terms} />
            <Route path="/timeline" component={Timeline} />
            <Route path="/intelligence" component={Intelligence} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/pricing" component={Pricing} />

            {/* Hidden admin-only routes — not linked in nav, gated by ADMIN_EMAILS env */}
            <Route path="/admin/approvals" component={AdminApprovals} />
            <Route path="/admin/agents" component={AdminAgents} />

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
