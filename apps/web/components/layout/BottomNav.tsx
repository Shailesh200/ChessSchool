"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/core/haptics/haptics";
import { startNav } from "@/core/store/nav.store";
import { useProgression } from "@/core/store/progression.store";
import { useSettings } from "@/core/store/settings.store";
import { reviewDueCount } from "@/features/chopper/catalog";
import { isNavTabActive, NAV_TABS } from "./nav-tabs";

export function BottomNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const uiKit = useSettings((s) => s.uiKit);
  const lessons = useProgression((s) => s.lessons);
  const due = uiKit === "legacy" ? 0 : reviewDueCount(lessons);
  const loadingHref = pending && !pathname.startsWith(pending) ? pending : null;

  return (
    <nav
      className="premium-tabbar pb-safe sticky bottom-0 z-30 backdrop-blur-xl max-[1023px]:flex min-[1024px]:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-around px-2">
        {NAV_TABS.map((tab) => {
          const active = isNavTabActive(pathname, tab.href);
          const loading = loadingHref === tab.href;
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
                  "premium-tab relative transition-colors",
                  active ? "text-brand" : loading ? "text-brand" : "text-ink-500",
                  loading && "pointer-events-none",
                )}
                aria-current={active ? "page" : undefined}
                aria-busy={loading}
                aria-label={
                  tab.href === "/review" && due > 0 ? `Review, ${due} due` : undefined
                }
              >
                <motion.span
                  className="relative"
                  animate={active ? { y: -1, scale: 1.04 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                >
                  {loading ? (
                    <span className="border-brand/30 border-t-brand block h-6 w-6 animate-spin rounded-full border-2" />
                  ) : (
                    <Icon name={tab.icon} size={24} duotone={active} />
                  )}
                </motion.span>
                <span className="relative">{tab.label}</span>
                {tab.href === "/review" && due > 0 && (
                  <em className="nav-due" aria-hidden="true">
                    {due > 9 ? "9+" : due}
                  </em>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
