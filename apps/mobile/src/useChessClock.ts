import { useEffect, useRef, useState } from "react";

/** Live chess clock — ticks every 250ms for the side to move. */
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

  useEffect(() => {
    ref.current = { w: whiteMs, b: blackMs };
    setDisplay({ w: whiteMs, b: blackMs });
  }, [whiteMs, blackMs]);

  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => {
      const side = turn;
      const next = { ...ref.current };
      next[side] = Math.max(0, next[side] - 250);
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
