/**
 * OfflineBanner — slim status strip that appears when the device loses
 * network connectivity and dismisses itself once connection is restored.
 *
 * Uses the browser's `online`/`offline` events and `navigator.onLine` for
 * initial state. Positioned at the very top of the viewport so it doesn't
 * collide with the bottom nav or toasts, and above the sticky mobile header
 * via z-[200].
 *
 * "Back online" confirmation shows for 2 seconds then fades so users know
 * their reconnection was detected.
 */

import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

type NetworkState = "online" | "offline" | "back-online";

export function OfflineBanner() {
  const [state, setState] = useState<NetworkState>(
    navigator.onLine ? "online" : "offline"
  );

  useEffect(() => {
    const handleOffline = () => setState("offline");

    const handleOnline = () => {
      setState("back-online");
      // Return to idle after 2.5 seconds
      const t = setTimeout(() => setState("online"), 2500);
      return () => clearTimeout(t);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (state === "online") return null;

  const isOffline = state === "offline";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all duration-300 ${
        isOffline
          ? "bg-amber-500 text-white"
          : "bg-green-500 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {isOffline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          No internet — showing saved data
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5 shrink-0" />
          Back online
        </>
      )}
    </div>
  );
}
