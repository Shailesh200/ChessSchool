import NetInfo from "@react-native-community/netinfo";
import { assessMove, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { api, API_URL } from "./api";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export type Connectivity = "online" | "offline" | "api-down";

/** Device offline, or API unreachable (including no API configured). */
export function useConnectivity(): { status: Connectivity; retry: () => void } {
  const [online, setOnline] = useState(true);
  const [apiUp, setApiUp] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNonce((n) => n + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!online) return;
    if (!API_URL) {
      setApiUp(false);
      return;
    }
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
