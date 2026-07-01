"use client";

import { motion } from "framer-motion";
import { useSettings } from "@/core/store/settings.store";

const COLORS = ["#5b5bd6", "#ff7a59", "#34d399", "#f6c343", "#fb7185", "#7b6ff0"];

/** Pure-motion confetti burst — no external library, respects reduced motion. */
export function Confetti({ count = 28, active = true }: { count?: number; active?: boolean }) {
  const reduced = useSettings((s) => s.reducedMotion);
  if (!active || reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 120 + (i % 5) * 26;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - 40;
        const color = COLORS[i % COLORS.length];
        const size = 7 + (i % 3) * 3;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-[2px]"
            style={{ width: size, height: size * 1.6, backgroundColor: color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x,
              y,
              opacity: 0,
              rotate: (i % 2 ? 1 : -1) * 320,
              scale: 0.4,
            }}
            transition={{ duration: 1.1 + (i % 4) * 0.12, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
