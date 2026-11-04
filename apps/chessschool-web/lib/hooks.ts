"use client";

import { assessMove, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";

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

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

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
  const [apiUp, setApiUp] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    api
      .health()
      .then(() => alive && setApiUp(true))
      .catch(() => alive && setApiUp(false));
    return () => {
      alive = false;
    };
  }, [online, nonce]);

  return { status: !online ? "offline" : apiUp ? "online" : "api-down", retry: () => setNonce((n) => n + 1) };
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
