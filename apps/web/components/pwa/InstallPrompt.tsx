"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePwa } from "@/core/pwa/usePwa";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/core/haptics/haptics";

/**
 * One-time, dismissable install banner. Appears only after the browser fires
 * `beforeinstallprompt` (i.e. on app load when installable) and never again
 * once dismissed or installed (persisted in localStorage).
 */
export function InstallPrompt() {
  const canInstall = usePwa((s) => s.canInstall);
  const dismissed = usePwa((s) => s.dismissed);
  const promptInstall = usePwa((s) => s.promptInstall);
  const dismiss = usePwa((s) => s.dismiss);

  const show = canInstall && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          className="rounded-card border-brand-100 bg-brand-50 mb-4 flex items-center gap-2 border p-3"
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
