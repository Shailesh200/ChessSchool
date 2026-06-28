"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * Route transition (Phase 2). A subtle cross-fade on every client navigation —
 * opacity-only so it never disturbs sticky chrome, and it skips the very first
 * paint (so LCP is not delayed). `template.tsx` re-mounts on each navigation.
 */
let firstPaintDone = false;

export default function Template({ children }: { children: React.ReactNode }) {
  // Lazy initializer runs once per mount; first-ever mount skips the animation.
  const [skip] = useState(() => {
    const prior = firstPaintDone;
    firstPaintDone = true;
    return !prior;
  });

  return (
    <motion.div
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
