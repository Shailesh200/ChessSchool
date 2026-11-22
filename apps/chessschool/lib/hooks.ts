import NetInfo from "@react-native-community/netinfo";
import { assessMove, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { apiWatch } from "./api";
import { useApp } from "./state";

/** The OS "reduce motion" setting, or the in-app Reduce motion pref. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  const { state } = useApp();
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced || state.prefs.reduceMotion;
}

/** Whether the device has a connection right now (for code outside React). */
let deviceOnline = true;
NetInfo.addEventListener((s) => {
  const was = deviceOnline;
  deviceOnline = s.isConnected !== false;
  // Back on a network: look at the API again (quietly).
  if (deviceOnline && !was) void apiWatch.check();
});
export const isDeviceOnline = () => deviceOnline;
// One probe at launch and one each time the app comes back, shared by every screen's banner.
void apiWatch.check();
AppState.addEventListener("change", (s) => s === "active" && void apiWatch.check());

export type Connectivity = "online" | "offline" | "api-down";

/** Device offline, or API unreachable (including no API configured). One watcher serves every screen. */
export function useConnectivity(): { status: Connectivity; retry: () => void } {
  const [online, setOnline] = useState(true);
  const apiUp = useSyncExternalStore(apiWatch.subscribe, apiWatch.up);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);
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
