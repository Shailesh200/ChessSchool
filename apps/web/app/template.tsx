"use client";

import { useState } from "react";

/**
 * Route transition (Phase 2). A subtle cross-fade on every client navigation —
 * opacity-only so it never disturbs sticky chrome, and it skips the very first
 * paint (so LCP is not delayed). CSS-only to keep framer-motion off the home budget.
 */
let firstPaintDone = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const [skip] = useState(() => {
    const prior = firstPaintDone;
    firstPaintDone = true;
    return !prior;
  });

  return <div className={skip ? undefined : "animate-route-in"}>{children}</div>;
}
