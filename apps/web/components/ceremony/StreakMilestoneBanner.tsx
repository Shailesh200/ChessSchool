"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { LazyLottie } from "@/components/motion/LazyLottie";
import { softSpring } from "@/core/motion/variants";
import { useMounted } from "@/core/hooks/useMounted";
import { useState } from "react";

const MILESTONES = [7, 30] as const;

function storageKey(days: number) {
  return `cs-streak-banner-${days}`;
}

/** Non-blocking Campus banner for 7- and 30-day streak milestones (MOTION.md #5). */
export function StreakMilestoneBanner({ streak }: { streak: number }) {
  const milestone = MILESTONES.find((d) => streak === d) ?? null;
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);

  const storedDismissed =
    mounted && milestone
      ? sessionStorage.getItem(storageKey(milestone)) === "1"
      : false;
  const visible = milestone !== null && !dismissed && !storedDismissed;

  if (!visible) return null;

  const label =
    milestone === 7
      ? "Week Warrior — 7 days in a row!"
      : "Unstoppable — 30-day streak!";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={softSpring}
      >
        <div className="rounded-card border-gold/50 bg-gold/10 flex items-center gap-3 border px-4 py-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <LazyLottie asset="streak-milestone" className="h-12 w-12">
              <Icon name="flame" size={28} className="text-gold" />
            </LazyLottie>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-extrabold">{label}</p>
            <p className="text-ink-500 text-xs font-semibold">
              Keep showing up — consistency beats talent.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss streak celebration"
            onClick={() => {
              sessionStorage.setItem(storageKey(milestone), "1");
              setDismissed(true);
            }}
            className="btn-tactile text-ink-500 shrink-0 rounded-full p-1"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
