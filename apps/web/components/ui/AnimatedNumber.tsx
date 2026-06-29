"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { useSettings } from "@/core/store/settings.store";

/** Smoothly counts to `value` on change (eased), with tabular figures. */
export function AnimatedNumber({
  value,
  duration = 650,
  className,
  prefix = "",
}: {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
}) {
  const reduced = useSettings((s) => s.reducedMotion);
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    if (reduced) {
      fromRef.current = to; // ref mutation only — render reads `value` directly
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  const shown = reduced ? value : display;

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {shown.toLocaleString()}
    </span>
  );
}
