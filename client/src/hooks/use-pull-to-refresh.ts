/**
 * usePullToRefresh — mobile pull-down-to-refresh gesture.
 *
 * Attaches touch listeners to `document` and checks whether the scrollable
 * <main> element (Layout's scroll root) is at the top before activating.
 * Returns pull state so the caller can render a visual indicator and
 * trigger the refresh callback when the threshold is crossed.
 *
 * Usage:
 *   const { isPulling, isTriggered, isRefreshing, pullProgress } =
 *     usePullToRefresh(async () => { await refetchMyData(); });
 */

import { useState, useEffect, useRef } from "react";

/** Pixels of pull required to trigger a refresh. */
const THRESHOLD = 72;

/** Apply rubber-band easing so the pull feels natural. */
function rubberBand(dy: number, limit: number): number {
  // Logarithmic resistance — fast at start, slows as it nears limit
  return limit * (1 - Math.exp((-dy * 0.8) / limit));
}

interface PullToRefreshState {
  /** True while the user's finger is actively pulling down. */
  isPulling: boolean;
  /** True once pull distance has crossed the threshold (refresh will fire on release). */
  isTriggered: boolean;
  /** True while the async refresh callback is running. */
  isRefreshing: boolean;
  /** 0–1 progress toward the threshold (for animating the indicator). */
  pullProgress: number;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>
): PullToRefreshState {
  const [isPulling, setIsPulling] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  // Use refs for values read inside event handlers to avoid stale closures.
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const distRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  // Keep the callback ref fresh without re-registering listeners.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const getScrollTop = (): number => {
      const main = document.querySelector("main");
      return main ? main.scrollTop : window.scrollY;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() === 0) {
        startYRef.current = e.touches[0].clientY;
        activeRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;

      // Cancel if the user scrolls up or the container has scrolled
      if (dy <= 0 || getScrollTop() > 0) {
        activeRef.current = false;
        distRef.current = 0;
        setIsPulling(false);
        setIsTriggered(false);
        setPullProgress(0);
        return;
      }

      const eased = rubberBand(dy, THRESHOLD * 1.5);
      distRef.current = eased;
      const progress = Math.min(eased / THRESHOLD, 1);
      const triggered = eased >= THRESHOLD;

      // Haptic bump when the threshold is first crossed
      if (triggered && !isTriggered && navigator.vibrate) {
        navigator.vibrate(30);
      }

      setIsPulling(true);
      setIsTriggered(triggered);
      setPullProgress(progress);
    };

    const onTouchEnd = () => {
      if (!activeRef.current) return;
      const dist = distRef.current;
      activeRef.current = false;
      distRef.current = 0;
      startYRef.current = 0;
      setIsPulling(false);
      setIsTriggered(false);
      setPullProgress(0);

      if (dist >= THRESHOLD) {
        setIsRefreshing(true);
        onRefreshRef.current().finally(() => setIsRefreshing(false));
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isTriggered]);

  return { isPulling, isTriggered, isRefreshing, pullProgress };
}
