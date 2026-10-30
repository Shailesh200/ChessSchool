import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Live chess clock — ticks by wall time only while the app is foregrounded (DP-M-011). */
export function useChessClock(opts: {
  enabled: boolean;
  whiteMs: number;
  blackMs: number;
  turn: "w" | "b";
  onFlag: (loser: "w" | "b") => void;
}) {
  const { enabled, whiteMs, blackMs, turn, onFlag } = opts;
  const ref = useRef({ w: whiteMs, b: blackMs });
  const [display, setDisplay] = useState({ w: whiteMs, b: blackMs });
  const onFlagRef = useRef(onFlag);
  onFlagRef.current = onFlag;
  const lastTick = useRef(Date.now());

  useEffect(() => {
    ref.current = { w: whiteMs, b: blackMs };
    setDisplay({ w: whiteMs, b: blackMs });
    lastTick.current = Date.now();
  }, [whiteMs, blackMs]);

  useEffect(() => {
    if (!enabled) return;
    lastTick.current = Date.now();
    const iv = setInterval(() => {
      if (AppState.currentState !== "active") {
        lastTick.current = Date.now();
        return;
      }
      const now = Date.now();
      const elapsed = now - lastTick.current;
      lastTick.current = now;
      const side = turn;
      const next = { ...ref.current };
      next[side] = Math.max(0, next[side] - elapsed);
      ref.current = next;
      setDisplay(next);
      if (next[side] === 0) onFlagRef.current(side);
    }, 250);
    return () => clearInterval(iv);
  }, [enabled, turn]);

  return { whiteMs: display.w, blackMs: display.b, ref };
}

export function parseTimeControl(time: string | undefined): number {
  const n = Number(time);
  return Number.isFinite(n) && n > 0 ? n * 60_000 : 0;
}
