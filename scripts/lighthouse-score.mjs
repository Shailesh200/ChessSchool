/**
 * Score a Lighthouse LHR JSON report against thresholds.
 * Used by verify-web-lighthouse.sh for every consumer route.
 */

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "n/a";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function formatCls(value) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(3);
}

export function scoreLighthouseReport(report, thresholds, options = {}) {
  const {
    label = "page",
    enforcePerf = true,
    minA11y = 90,
    minBp = 90,
    minSeo = 90,
    labSlackMs = 100,
  } = options;

  const lines = [];
  let failed = false;

  function audit(id) {
    return report.audits[id] ?? null;
  }

  function checkMetric(metricLabel, value, max, unit) {
    if (value == null || Number.isNaN(value)) {
      lines.push(`  · ${metricLabel}: n/a (skipped)`);
      return;
    }
    const slack =
      unit === "ms" && (metricLabel === "LCP" || metricLabel === "FCP") ? labSlackMs : 0;
    const ok = value <= max + slack;
    const formatted = unit === "cls" ? formatCls(value) : formatMs(value);
    const maxFormatted = unit === "cls" ? formatCls(max) : formatMs(max);
    lines.push(`${ok ? "✓" : "✗"} ${metricLabel}: ${formatted} (max ${maxFormatted})`);
    if (!ok) failed = true;
  }

  const perfScore = Math.round((report.categories.performance?.score ?? 0) * 100);
  const perfOk = perfScore >= thresholds.minPerformance;
  lines.push(
    `${perfOk ? "✓" : enforcePerf ? "✗" : "⚠"} Performance: ${perfScore} (min ${thresholds.minPerformance})`,
  );
  if (enforcePerf && !perfOk) failed = true;

  for (const [cat, min] of [
    ["accessibility", minA11y],
    ["best-practices", minBp],
    ["seo", minSeo],
  ]) {
    const score = Math.round((report.categories[cat]?.score ?? 0) * 100);
    const minScore = cat === "seo" && thresholds.minSeo != null ? thresholds.minSeo : min;
    const ok = score >= minScore;
    lines.push(`${ok ? "✓" : "✗"} ${cat}: ${score} (min ${minScore})`);
    if (!ok) failed = true;
  }

  const metrics = audit("metrics")?.details?.items?.[0] ?? {};
  const inpAudit =
    audit("interaction-to-next-paint") ?? audit("experimental-interaction-to-next-paint");
  const inpValue = inpAudit?.numericValue ?? metrics.interactionToNextPaint ?? null;
  const lcp = metrics.largestContentfulPaint ?? audit("largest-contentful-paint")?.numericValue;
  const cls = metrics.cumulativeLayoutShift ?? audit("cumulative-layout-shift")?.numericValue;
  const fcp = metrics.firstContentfulPaint ?? audit("first-contentful-paint")?.numericValue;
  const tbt = metrics.totalBlockingTime ?? audit("total-blocking-time")?.numericValue;
  const si = metrics.speedIndex ?? audit("speed-index")?.numericValue;
  const tti = metrics.interactive ?? audit("interactive")?.numericValue;
  const ttfb = metrics.timeToFirstByte ?? audit("server-response-time")?.numericValue;
  const mpfid = metrics.maxPotentialFID ?? audit("max-potential-fid")?.numericValue;

  lines.push(`→ CWV & lab metrics (${label}):`);
  checkMetric("LCP", lcp, thresholds.maxLcpMs, "ms");
  if (inpValue != null) {
    checkMetric("INP", inpValue, 200, "ms");
  } else {
    lines.push("  · INP: n/a (lab — field metric)");
    checkMetric("Max Potential FID (lab proxy)", mpfid, thresholds.maxMpfidMs, "ms");
  }
  checkMetric("CLS", cls, thresholds.maxCls, "cls");
  checkMetric("FCP", fcp, thresholds.maxFcpMs, "ms");
  checkMetric("TBT", tbt, thresholds.maxTbtMs, "ms");
  checkMetric("Speed Index", si, thresholds.maxSiMs, "ms");
  checkMetric("TTI", tti, thresholds.maxTtiMs, "ms");
  checkMetric("TTFB", ttfb, thresholds.maxTtfbMs, "ms");

  return {
    failed,
    lines,
    summary: {
      label,
      perfScore,
      lcp,
      fcp,
      cls,
      tbt,
    },
  };
}
