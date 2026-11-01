"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Web Analytics + Speed Insights. Only ever loaded through ConsentedTelemetry, after the
 * user has opted in. Importing this file is what pulls their scripts in, so nothing else may.
 */
export default function VercelTelemetry() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
