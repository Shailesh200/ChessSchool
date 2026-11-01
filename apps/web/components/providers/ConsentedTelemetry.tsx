"use client";

import { lazy, Suspense } from "react";
import { useSettings } from "@/core/store/settings.store";

// A lazy chunk: the Vercel scripts stay out of the first-load bundle until someone opts in.
const VercelTelemetry = lazy(() => import("./VercelTelemetry"));

/**
 * Mounts Vercel Analytics and Speed Insights only after the user has turned on the single
 * privacy switch (shareAnalytics). Off, or not rehydrated yet (the store starts off), mounts
 * nothing and loads no script.
 */
export function ConsentedTelemetry() {
  const optedIn = useSettings((s) => s.shareAnalytics);
  if (!optedIn) return null;
  return (
    <Suspense fallback={null}>
      <VercelTelemetry />
    </Suspense>
  );
}
