"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { haptics } from "@/core/haptics/haptics";
import { startNav } from "@/core/store/nav.store";

type Tab = { href: string; label: string; icon: IconName };

const TABS: Tab[] = [
  { href: "/", label: "Learn", icon: "learn" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  // Track the tab being navigated to so we can show a loader + lock it.
  const [pending, setPending] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname); // route arrived → clear the pending loader (render-phase reset)
    setPending(null);
  }
  return (
    <nav className="pb-safe sticky bottom-0 z-30 border-t border-hairline bg-surface-card/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const loading = pending === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                onClick={() => {
                  haptics.fire("select");
                  if (!active) {
                    setPending(tab.href);
                    startNav();
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition-colors",
                  active ? "text-brand" : loading ? "text-brand" : "text-ink-500",
                  loading && "pointer-events-none",
                )}
                aria-current={active ? "page" : undefined}
                aria-busy={loading}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-x-2 inset-y-1 rounded-2xl bg-brand-50"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <motion.span
                  className="relative"
                  animate={active ? { y: -1, scale: 1.06 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                >
                  {loading ? (
                    <span className="block h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  ) : (
                    <Icon name={tab.icon} size={24} duotone={active} />
                  )}
                </motion.span>
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
