"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useNav } from "@/core/store/nav.store";

/**
 * Global top loading bar (#13). Shows on any internal navigation — link clicks
 * are caught here automatically; programmatic router.push calls trigger it via
 * startNav(). It completes when the pathname changes.
 */
export function NavProgress() {
  const pathname = usePathname();
  const loading = useNav((s) => s.loading);

  // Navigation finished when the route actually changed.
  useEffect(() => {
    useNav.getState().done();
  }, [pathname]);

  // Start the bar on internal link clicks.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/")) return;
      if (href.split("?")[0] === window.location.pathname) return;
      useNav.getState().begin();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="navbar"
          className="fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-brand [box-shadow:0_0_8px_var(--brand-400)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 0.9 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}
