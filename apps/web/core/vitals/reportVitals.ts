"use client";

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { useSettings } from "@/core/store/settings.store";

const reported = new Set<string>();

function connectionLabel(): string | undefined {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  return nav.connection?.effectiveType;
}

function sendMetric(metric: Metric) {
  if (reported.has(metric.name)) return;
  reported.add(metric.name);
  if (navigator.doNotTrack === "1") return;
  if (!useSettings.getState().sharePerformance) return;

  const body = JSON.stringify({
    metrics: [
      {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        pathname: window.location.pathname,
        connection: connectionLabel(),
        navigationType: metric.navigationType,
      },
    ],
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => void 0);
  }
}

/** Register Core Web Vitals reporters (Phase 2 RUM). */
export function initVitalsReporting(): void {
  if (typeof window === "undefined") return;
  onLCP(sendMetric);
  onINP(sendMetric);
  onCLS(sendMetric);
  onFCP(sendMetric);
  onTTFB(sendMetric);
}
