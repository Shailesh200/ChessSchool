"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useToasts } from "@/core/store/toast.store";
import { Icon } from "./Icon";

const TONE: Record<string, string> = {
  default: "text-brand",
  success: "text-success",
  danger: "text-danger",
};

/** Spring-in toasts, top-center, swipe/tap to dismiss. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 py-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
            onClick={() => { if (!t.action) dismiss(t.id); }}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-pill border border-hairline bg-surface-card px-4 py-2.5 [box-shadow:var(--shadow-pop)]"
          >
            {t.icon && <Icon name={t.icon} size={18} className={TONE[t.tone]} />}
            <span className="text-sm font-bold text-ink">{t.message}</span>
            {t.action && (
              <button
                onClick={(e) => { e.stopPropagation(); t.action!.onClick(); }}
                className="btn-tactile ml-1 shrink-0 rounded-pill bg-brand px-3 py-1 text-xs font-extrabold text-white"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
