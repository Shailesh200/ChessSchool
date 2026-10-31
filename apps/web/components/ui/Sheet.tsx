"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { keyboardOverlap } from "./keyboardInset";
import { useModalFocus } from "./useModalFocus";

/** Pixels the on-screen keyboard covers. Zero when the layout viewport already resized. */
function useKeyboardOverlap(active: boolean): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setOverlap(keyboardOverlap(window.innerHeight, vv.height, vv.offsetTop));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? overlap : 0;
}

/** Accessible bottom sheet with backdrop + spring entrance. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlap = useKeyboardOverlap(open);
  useModalFocus(open, containerRef, onClose);

  useEffect(() => {
    if (!open) return;
    const root = containerRef.current;
    if (!root) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) target.scrollIntoView({ block: "nearest" });
    };
    root.addEventListener("focusin", onFocus);
    return () => root.removeEventListener("focusin", onFocus);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            className="bg-ink/40 absolute inset-0 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="premium-card pb-safe border-hairline bg-surface-card relative w-full max-w-xl overflow-y-auto rounded-t-[var(--cs-radius-sheet,1.75rem)] border p-5 [box-shadow:var(--cs-shadow-sheet,var(--shadow-pop))]"
            style={{
              marginBottom: overlap,
              maxHeight: `calc(100dvh - ${overlap}px)`,
            }}
          >
            <div className="rounded-pill bg-surface-sunken mx-auto mb-3 h-1.5 w-12" />
            <h2 className="text-ink mb-3 text-lg font-extrabold">{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
