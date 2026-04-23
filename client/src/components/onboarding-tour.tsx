import { useState, useEffect, useCallback } from "react";
import { trackModalOpen } from "@/lib/analytics";
import { MODAL_SLUGS } from "@/lib/slug-registry";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const desktopTourSteps: TourStep[] = [
  {
    target: "[data-tour='home-status']",
    title: "Your Home Status",
    content: "This shows your home's overall condition at a glance. As you add systems and track maintenance, we'll update this to help you stay on top of things.",
    placement: "right",
  },
  {
    target: "[data-tour='quick-stats']",
    title: "Key Information",
    content: "Track your home's age, upcoming maintenance, and active tasks. These cards give you a quick snapshot of what's happening.",
    placement: "bottom",
  },
  {
    target: "[data-tour='maintenance-plan']",
    title: "Your Maintenance Plan",
    content: "Tasks are organized by urgency: Fix Now, Plan Soon, and Address Later. This helps you prioritize without feeling overwhelmed.",
    placement: "top",
  },
  {
    target: "[data-tour='nav-file-upload']",
    title: "Document Analysis",
    content: "Upload inspection reports, warranties, or other home documents. Our AI reads them and creates maintenance tasks automatically.",
    placement: "right",
  },
  {
    target: "[data-tour='systems-section']",
    title: "Ready to Start?",
    content: "Add your first home system to begin building your maintenance plan. We'll help you track its condition and schedule upkeep.",
    placement: "top",
  },
];

const mobileTourSteps: TourStep[] = [
  {
    target: "[data-tour='home-status']",
    title: "Your Home Status",
    content: "This shows your home's overall condition at a glance. As you add systems and track maintenance, we'll update this to help you stay on top of things.",
    placement: "bottom",
  },
  {
    target: "[data-tour='quick-stats']",
    title: "Key Information",
    content: "Track your home's age, upcoming maintenance, and active tasks. These cards give you a quick snapshot of what's happening.",
    placement: "bottom",
  },
  {
    target: "[data-tour='maintenance-plan']",
    title: "Your Maintenance Plan",
    content: "Tasks are organized by urgency: Fix Now, Plan Soon, and Address Later. This helps you prioritize without feeling overwhelmed.",
    placement: "top",
  },
  {
    target: "[data-tour='systems-section']",
    title: "Ready to Start?",
    content: "Add your first home system to begin building your maintenance plan. We'll help you track its condition and schedule upkeep.",
    placement: "top",
  },
];

interface OnboardingTourProps {
  /** Called when the user finishes the tour normally (last step CTA). */
  onComplete: () => void;
  /**
   * Called when the user explicitly dismisses the tour early (X button,
   * backdrop click). Defaults to `onComplete` if not provided so the
   * component stays backwards-compatible, but callers should pass a
   * separate handler when skip and finish have different side-effects.
   */
  onSkip?: () => void;
  isOpen: boolean;
}

export function OnboardingTour({ onComplete, onSkip, isOpen }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { if (isOpen) trackModalOpen(MODAL_SLUGS.onboardingTour); }, [isOpen]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const tourSteps = isMobile ? mobileTourSteps : desktopTourSteps;

  useEffect(() => {
    if (currentStep >= tourSteps.length) {
      setCurrentStep(Math.max(0, tourSteps.length - 1));
    }
  }, [tourSteps.length, currentStep]);

  const updatePosition = useCallback(() => {
    if (currentStep >= tourSteps.length) return;
    
    const step = tourSteps[currentStep];
    const targetElement = document.querySelector(step.target);
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
      
      const padding = 16;
      const tooltipWidth = 320;
      const tooltipHeight = 180;
      
      let top = 0;
      let left = 0;
      
      switch (step.placement) {
        case "right":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          break;
        case "bottom":
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "top":
        default:
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
      }
      
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      
      setTooltipPosition({ top, left });
    } else {
      setTargetRect(null);
      setTooltipPosition({ top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 160 });
    }
  }, [currentStep, tourSteps]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && currentStep < tourSteps.length) {
      const step = tourSteps[currentStep];
      const targetElement = document.querySelector(step.target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(updatePosition, 300);
      } else {
        updatePosition();
      }
    }
  }, [currentStep, isOpen, updatePosition, tourSteps]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Use the dedicated skip handler if provided; otherwise fall back to
    // onComplete so the tour still closes if the caller didn't differentiate.
    (onSkip ?? onComplete)();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]" data-testid="onboarding-tour">
        <div 
          className="absolute inset-0 bg-black/60 transition-opacity duration-300"
          onClick={handleSkip}
        />
        
        {targetRect && (
          <div
            className="absolute transition-all duration-300 ease-out pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
              borderRadius: "12px",
              border: "2px solid rgb(249, 115, 22)",
            }}
          />
        )}

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute bg-background border border-border rounded-xl shadow-2xl w-80 p-5"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            zIndex: 101,
          }}
          data-testid="tour-tooltip"
        >
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-skip-tour"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">
                Step {currentStep + 1} of {tourSteps.length}
              </span>
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground">
              {step.title}
            </h3>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {step.content}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {tourSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === currentStep 
                      ? "w-4 bg-primary" 
                      : idx < currentStep 
                        ? "w-1.5 bg-primary/50" 
                        : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  data-testid="button-prev-step"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                data-testid="button-next-step"
              >
                {isLastStep ? "Add First System" : "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function useTourState() {
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("homebuddy_tour_completed");
    setHasSeenTour(seen === "true");
  }, []);

  const startTour = useCallback(() => {
    setTourKey(k => k + 1);
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem("homebuddy_tour_completed", "true");
    setHasSeenTour(true);
    setShowTour(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem("homebuddy_tour_completed");
    setHasSeenTour(false);
  }, []);

  return {
    hasSeenTour,
    showTour,
    tourKey,
    startTour,
    completeTour,
    resetTour,
  };
}
