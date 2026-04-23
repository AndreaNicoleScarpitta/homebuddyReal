/**
 * PwaInstallPrompt — tasteful "Add to Home Screen" banner for mobile users.
 *
 * Two paths:
 *  - Android / Chrome / Edge: listens for `beforeinstallprompt`, defers it,
 *    then shows a banner with an "Install" button that triggers the native
 *    prompt.
 *  - iOS (Safari): no `beforeinstallprompt` API, so we detect iOS and show
 *    manual Share → Add to Home Screen instructions instead.
 *
 * Timing: waits 20 seconds before appearing so it doesn't interrupt the first
 * look at the app. Respects a 30-day dismissal stored in localStorage.
 *
 * Placement: sits above the mobile bottom nav (bottom-[76px]) and is hidden
 * on md+ screens where the bottom nav doesn't exist.
 */

import { useState, useEffect, useRef } from "react";
import { X, Share, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

const STORAGE_KEY = "pwa_prompt_dismissed_at";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHOW_DELAY_MS = 20_000; // 20 seconds

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < COOLDOWN_MS;
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    // Never show if already installed or dismissed recently
    if (isStandalone() || wasDismissedRecently()) return;

    const ios = isIOS();
    setIsIOSDevice(ios);

    if (ios) {
      // iOS: just show manual instructions after delay
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Android / Chrome: wait for the browser's install event
    let showTimer: ReturnType<typeof setTimeout>;

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      clearTimeout(showTimer);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    trackEvent("click", "pwa", "install");
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      trackEvent("click", "pwa", "install_accepted");
    }
    deferredPromptRef.current = null;
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    trackEvent("click", "pwa", "dismiss");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    // bottom-[76px] sits just above the 56px bottom nav + safe area margin
    <div className="fixed bottom-[76px] left-3 right-3 md:hidden z-40 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="bg-card border border-border/80 rounded-xl shadow-xl p-4 flex items-center gap-3">
        {/* Icon */}
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          {isIOSDevice
            ? <Share className="h-5 w-5 text-white" />
            : <Download className="h-5 w-5 text-white" />
          }
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Add to Home Screen
          </p>
          {isIOSDevice ? (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Tap <span className="font-medium">Share ↑</span> then
              {" "}<span className="font-medium">Add to Home Screen</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              One tap to open — no app store needed.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isIOSDevice && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleInstall}
              data-testid="btn-pwa-install"
            >
              Install
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss"
            data-testid="btn-pwa-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
