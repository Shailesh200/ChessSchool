"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useProgression, levelForXp, xpProgress } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export function TopBar() {
  const xp = useProgression((s) => s.xp);
  const streak = useProgression((s) => s.streak);
  const graduated = useProgression((s) => s.graduatedClasses.length);
  const authed = useSession((s) => s.authed);
  const level = levelForXp(xp);
  const { into, need } = xpProgress(xp);

  // Guests don't have a tracked streak/level — invite them to enroll instead.
  if (authed !== true) {
    return (
      <header className="pt-safe sticky top-0 z-30 border-b border-hairline bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-2.5">
          <Link href="/login" className="text-sm font-extrabold text-brand">
            Enroll to the academy to track your progress →
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-hairline bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-1.5" title="Day streak">
          <Icon name="flame" size={20} className="text-accent" />
          <AnimatedNumber value={streak} className="text-sm font-extrabold text-ink" />
        </div>

        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-pill bg-brand px-2 py-0.5 text-xs font-extrabold tabular-nums text-white">
            L{level}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <motion.div
              className="h-full rounded-pill bg-gradient-to-r from-brand-300 to-brand"
              initial={{ width: 0 }}
              animate={{ width: `${(into / need) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-pill bg-gold/15 px-2 py-0.5" title="Classes graduated">
          <Icon name="cap" size={16} className="text-gold" />
          <AnimatedNumber value={graduated} className="text-sm font-extrabold text-ink" />
        </div>
      </div>
    </header>
  );
}
