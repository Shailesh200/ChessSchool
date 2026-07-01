"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/core/store/settings.store";

interface PerfMemory {
  usedJSHeapSize: number;
}

/** Tiny local performance HUD (#54) — FPS, JS heap, current route. Opt-in. */
export function Diagnostics() {
  const enabled = useSettings((s) => s.diagnostics);
  const pathname = usePathname();
  const [fps, setFps] = useState(0);
  const [mem, setMem] = useState(0);
  const frame = useRef(0);
  const last = useRef(0);
  const count = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = (t: number) => {
      count.current += 1;
      if (last.current === 0) last.current = t;
      if (t - last.current >= 1000) {
        setFps(count.current);
        count.current = 0;
        last.current = t;
        const perf = performance as Performance & { memory?: PerfMemory };
        if (perf.memory) setMem(Math.round(perf.memory.usedJSHeapSize / 1048576));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    frame.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-2 z-[60] rounded-lg bg-ink/85 px-2 py-1 font-mono text-[10px] font-bold text-white">
      {fps} fps{mem ? ` · ${mem} MB` : ""} · {pathname}
    </div>
  );
}
