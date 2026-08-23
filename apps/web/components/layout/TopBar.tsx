"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useProgression, levelForXp, xpProgress } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { trackEvent } from "@/core/analytics/track";

export function TopBar() {
  const xp = useProgression((s) => s.xp);
  const streak = useProgression((s) => s.streak);
  const graduated = useProgression((s) => s.graduatedClasses.length);
  const authed = useSession((s) => s.authed);
  const rehydrateReady = useRehydrateReady();
  const level = levelForXp(xp);
  const { into, need } = xpProgress(xp);

  if (!rehydrateReady) {
    return (
      <header className="pt-safe border-hairline bg-surface/80 sticky top-0 z-30 border-b backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <div className="bg-surface-sunken h-5 w-8 rounded" aria-hidden />
          <div className="rounded-pill bg-surface-sunken h-2.5 flex-1" aria-hidden />
          <div className="bg-surface-sunken h-5 w-10 rounded" aria-hidden />
        </div>
      </header>
    );
  }

  if (authed === false) {
    return (
      <header className="pt-safe border-hairline bg-surface/80 sticky top-0 z-30 border-b backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-2.5">
          <Link
            href="/login"
            className="text-brand text-sm font-extrabold"
            onClick={() => trackEvent("enroll_cta_click", { source: "nav" })}
          >
            Enroll to the academy to track your progress →
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="pt-safe border-hairline bg-surface/80 sticky top-0 z-30 border-b backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-1.5" title="Day streak">
          <Icon name="flame" size={20} className="text-accent" />
          <AnimatedNumber value={streak} className="text-ink text-sm font-extrabold" />
        </div>

        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-pill bg-brand px-2 py-0.5 text-xs font-extrabold text-white tabular-nums">
            L{level}
          </span>
          <div className="rounded-pill bg-surface-sunken h-2.5 flex-1 overflow-hidden">
            <motion.div
              className="rounded-pill from-brand-300 to-brand h-full bg-gradient-to-r"
              initial={false}
              animate={{ width: `${(into / need) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
          </div>
        </div>

        <div
          className="rounded-pill bg-gold/15 flex items-center gap-1 px-2 py-0.5"
          title="Classes graduated"
        >
          <Icon name="cap" size={16} className="text-gold" />
          <AnimatedNumber
            value={graduated}
            className="text-ink text-sm font-extrabold"
          />
        </div>
      </div>
    </header>
  );
}
