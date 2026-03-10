import { useState, useEffect } from "react";
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
import { DonationModal } from "@/components/donation-modal";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import DocumentAnalysis from "@/pages/document-analysis";
import Onboarding from "@/pages/onboarding";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";

import Contact from "@/pages/contact";
import Terms, { TermsContent } from "@/pages/terms";
import MaintenanceLog from "@/pages/maintenance-log";
import Profile from "@/pages/profile";
import Documents from "@/pages/documents";
import Systems from "@/pages/systems";
import SystemDetail from "@/pages/system-detail";
import Disclaimer from "@/pages/disclaimer";

function PublicTermsPage() {
  useEffect(() => {
    trackSlugPageView(PAGE_SLUGS.terms);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-2">
          <img src="/images/home-buddy-icon.png" alt="Home Buddy" className="h-8 w-8 rounded-lg object-cover" />
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
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/terms" component={PublicTermsPage} />
        <Route component={Landing} />
      </Switch>
    );
  }
  
  return (
    <>
      <DonationModal />
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
        <Route component={NotFound} />
      </Switch>
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
