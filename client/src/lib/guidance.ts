import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
export interface GuidanceState { version: number; status: "not_offered" | "active" | "suspended" | "completed" | "dismissed"; moment: number }
export async function saveGuidance(state: GuidanceState, userId?: string) {
  // Preference failure must never prevent setup or dismissing education.
  try {
    if (userId) sessionStorage.setItem(`homebuddy:guidance:${userId}`, JSON.stringify(state));
  } catch {}
  try {
    const response = await fetch("/v2/guidance", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ ...state, userId }), keepalive: true });
    if (!response.ok) throw new Error("Preference save failed");
    if (userId) sessionStorage.removeItem(`homebuddy:guidance:${userId}`);
  } catch { /* The mounted guide retains the session choice. */ }
}
export function useQuickGuide(ready: boolean, hasTasks: boolean, taskId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<GuidanceState | null>(null);
  const [open, setOpen] = useState(false);
  const latest = useRef({ state, open });
  const initialized = useRef(false);
  const writes = useRef(Promise.resolve());
  const query = useQuery<GuidanceState | null>({ queryKey: ["guidance", user?.id], enabled: !!user,
    queryFn: async () => { const res = await fetch("/v2/guidance", { credentials: "include" }); if (!res.ok) throw new Error("Guide unavailable"); return res.json(); }, staleTime: 0 });
  function update(next: GuidanceState, event: string) {
    setState(next); latest.current = { state: next, open: next.status === "active" };
    writes.current = writes.current.then(() => saveGuidance(next, user?.id));
    trackEvent(event, "quick_guide", `v1_moment_${next.moment}`);
    if (event === "guide_acknowledged") trackEvent("guide_moment_viewed", "quick_guide", `v1_moment_${next.moment}`);
  }
  useEffect(() => {
    if (!ready || !user || query.isFetching || initialized.current) return;
    initialized.current = true;
    const entry = new URLSearchParams(window.location.search).get("guide");
    if (entry === "new" || entry === "replay") {
      window.history.replaceState(null, "", window.location.pathname);
      setOpen(true); update({ version: 1, status: "active", moment: 1 }, entry === "new" ? "guide_moment_viewed" : "guide_replayed");
    } else {
      // A persisted active panel is interrupted work, never an automatic popup.
      let saved = query.data;
      try { const fallback = sessionStorage.getItem(`homebuddy:guidance:${user?.id}`); if (fallback) saved = JSON.parse(fallback); } catch {}
      // Legacy completion is education history only; it never changes home setup.
      try { if (localStorage.getItem("homebuddy_tour_completed")) trackEvent("guide_legacy_seen", "quick_guide", "v1"); } catch {}
      if (!saved && query.isError) return;
      setState(saved?.version === 1 ? { ...saved, status: saved.status === "active" ? "suspended" : saved.status } : { version: 1, status: "not_offered", moment: 1 });
    }
  }, [ready, query.isFetching, query.data, user?.id]);
  latest.current = { state, open };
  useEffect(() => () => {
    const current = latest.current;
    if (current.open && current.state?.status === "active") {
      void writes.current.then(() => saveGuidance({ ...current.state!, status: "suspended" }, user?.id));
      trackEvent("guide_suspended", "quick_guide", "v1");
    }
  }, [user?.id]);
  useEffect(() => {
    if (open && state?.moment === 1 && taskId) update({ ...state, moment: 2 }, "guide_moment_viewed");
  }, [taskId]);
  const dismiss = () => { document.querySelector<HTMLElement>('[aria-controls="plan-task-list"][aria-pressed="true"]')?.focus({ preventScroll: true }); setOpen(false); update({ version: 1, status: "dismissed", moment: state?.moment ?? 1 }, "guide_dismissed"); };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, [open, state]);
  return { state, open,
    start: () => { setOpen(true); update({ version: 1, status: "active", moment: state?.status === "suspended" ? state.moment : 1 }, "guide_replayed"); },
    dismiss,
    next: () => {
      if (!state) return;
      if (state.moment === 3) { setOpen(false); update({ ...state, status: "completed" }, "guide_completed"); }
      else update({ ...state, moment: hasTasks ? state.moment + 1 : 3 }, "guide_acknowledged");
    },
    finish: () => { setOpen(false); update({ version: 1, status: "completed", moment: 3 }, "guide_completed"); },
  };
}
