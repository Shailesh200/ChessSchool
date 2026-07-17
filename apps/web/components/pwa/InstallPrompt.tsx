"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePwa } from "@/core/pwa/usePwa";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/core/haptics/haptics";

function useMobileWeb(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function useStandalonePwa(): boolean {
  const installed = usePwa((s) => s.installed);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setStandalone(
        installed ||
          mq.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [installed]);
  return standalone;
}

/**
 * One-time, dismissable install banner. Mobile web only — hidden on desktop and
 * when the app is already installed (standalone PWA).
 */
export function InstallPrompt() {
  const canInstall = usePwa((s) => s.canInstall);
  const dismissed = usePwa((s) => s.dismissed);
  const promptInstall = usePwa((s) => s.promptInstall);
  const dismiss = usePwa((s) => s.dismiss);
  const mobileWeb = useMobileWeb();
  const standalone = useStandalonePwa();

  const show = mobileWeb && !standalone && canInstall && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          className="rounded-card border-brand-100 bg-brand-50 mb-4 flex items-center gap-2 border p-3 lg:hidden"
        >
          <Logo withText={false} />
          <div className="flex-1">
            <p className="text-ink text-sm font-extrabold">Install ChessSchool</p>
            <p className="text-ink-500 text-xs font-semibold">
              Add to your home screen — works fully offline.
            </p>
          </div>
          <Button size="sm" onClick={() => void promptInstall()}>
            Install
          </Button>
          <button
            aria-label="Dismiss install prompt"
            onClick={() => {
              haptics.fire("select");
              dismiss();
            }}
            className="text-ink-500 hover:bg-surface-sunken hover:text-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
