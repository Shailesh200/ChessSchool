"use client";

import { assessMove, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiWatch } from "./api";
import { useApp } from "./state";

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** The OS "reduce motion" setting, or the in-app Reduce motion pref. */
export function useReducedMotion() {
  const os = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { state } = useApp();
  return os || state.prefs.reduceMotion;
}

export type Connectivity = "online" | "offline" | "api-down";

/** Browser offline state plus a health probe so a dead API is also reported. */
export function useConnectivity(): { status: Connectivity; retry: () => void } {
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const apiUp = useSyncExternalStore(apiWatch.subscribe, apiWatch.up, () => true);

  // One probe per page load and on coming back online or to the tab; every banner shares the result.
  useEffect(() => {
    if (online) void apiWatch.check();
  }, [online]);

  return { status: !online ? "offline" : apiUp ? "online" : "api-down", retry: () => void apiWatch.check() };
}

/**
 * Analyses a game a move at a time so the screen stays responsive.
 * Returns notes keyed by ply; `done` once every move has one.
 */
export function useGameAnalysis(plies: ReviewPly[]) {
  const [state, setState] = useState<{ plies: ReviewPly[]; notes: Record<number, MoveNote> }>({ plies, notes: {} });
  useEffect(() => {
    let i = 0;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled || i >= plies.length) return;
      const p = plies[i++];
      const n = assessMove(p);
      setState((s) => ({ plies, notes: { ...(s.plies === plies ? s.notes : {}), [p.ply]: n } }));
      t = setTimeout(step, 0);
    };
    t = setTimeout(step, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [plies]);
  const notes = state.plies === plies ? state.notes : {};
  return { notes, done: Object.keys(notes).length >= plies.length };
}
