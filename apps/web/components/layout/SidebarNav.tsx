"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { haptics } from "@/core/haptics/haptics";
import { startNav } from "@/core/store/nav.store";
import { useProgression, levelForXp, xpProgress } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { isNavTabActive, NAV_TABS } from "./nav-tabs";

/** Desktop sidebar — visible from `lg` breakpoint per BREAKPOINTS.md. */
export function SidebarNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const rehydrateReady = useRehydrateReady();
  const authed = useSession((s) => s.authed);
  const xp = useProgression((s) => s.xp);
  const streak = useProgression((s) => s.streak);
  const graduated = useProgression((s) => s.graduatedClasses.length);
  const level = levelForXp(xp);
  const { into, need } = xpProgress(xp);

  const loadingHref = pending && !pathname.startsWith(pending) ? pending : null;

  return (
    <aside className="border-hairline bg-surface-card hidden w-[220px] shrink-0 flex-col border-r lg:flex">
      <div className="border-hairline border-b px-5 py-5">
        <Link href="/" className="block" aria-label="ChessSchool home">
          <Logo withText />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Main">
        {NAV_TABS.map((tab) => {
          const active = isNavTabActive(pathname, tab.href);
          const loading = loadingHref === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => {
                haptics.fire("select");
                if (!active) {
                  setPending(tab.href);
                  startNav();
                }
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                active ? "text-brand" : loading ? "text-brand" : "text-ink-500",
                loading && "pointer-events-none",
              )}
              aria-current={active ? "page" : undefined}
              aria-busy={loading}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-pill"
                  className="bg-brand-50 absolute inset-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-3">
                {loading ? (
                  <span className="border-brand/30 border-t-brand block h-5 w-5 animate-spin rounded-full border-2" />
                ) : (
                  <Icon name={tab.icon} size={22} duotone={active} />
                )}
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-hairline border-t px-4 py-4">
        {!rehydrateReady ? (
          <div className="bg-surface-sunken h-16 rounded-xl" aria-hidden />
        ) : authed === false ? (
          <Link
            href="/login"
            className="text-brand block text-center text-sm font-extrabold"
          >
            Enroll to track progress →
          </Link>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-ink-500 flex items-center gap-1">
                <Icon name="flame" size={16} className="text-accent" />
                Streak
              </span>
              <AnimatedNumber value={streak} className="text-ink font-extrabold" />
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-pill bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white tabular-nums">
                L{level}
              </span>
              <div className="rounded-pill bg-surface-sunken h-2 flex-1 overflow-hidden">
                <motion.div
                  className="rounded-pill from-brand-300 to-brand h-full bg-gradient-to-r"
                  initial={false}
                  animate={{ width: `${(into / need) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </div>
            </div>
            <div className="text-ink-500 flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1">
                <Icon name="cap" size={16} className="text-gold" />
                Graduated
              </span>
              <AnimatedNumber value={graduated} className="text-ink font-extrabold" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
