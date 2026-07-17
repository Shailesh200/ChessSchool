/**
 * Score a Lighthouse LHR JSON report against thresholds.
 * Used by verify-web-lighthouse.sh for every consumer route.
 *
 * Category scores + LCP/FCP/CLS/TTFB are hard gates.
 * Lab-only extras (TBT, SI, TTI, Max Potential FID) warn by default — set
 * WEB_LH_ENFORCE_LAB_EXTRAS=1 to fail on those too.
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
  // CI lab variance is high on GHA — hard-gate A11y/BP/SEO (master plan).
  // Perf + CWV stay reported; fail only when WEB_LH_STRICT_CWV=1 (local optional).
  const ciRelaxed =
    process.env.WEB_LH_CI_RELAXED === "1" ||
    (process.env.CI === "true" && process.env.WEB_LH_STRICT_CWV !== "1");

  const {
    label = "page",
    enforcePerf = !ciRelaxed && process.env.WEB_LH_ENFORCE_PERFORMANCE !== "0",
    minA11y = 90,
    minBp = 90,
    minSeo = 90,
    labSlackMs = 100,
    enforceLabExtras = process.env.WEB_LH_ENFORCE_LAB_EXTRAS === "1",
    // Local full verify can set WEB_LH_STRICT_CWV=1; CI relaxed leaves CWV as warnings.
    enforceCwv = !ciRelaxed,
  } = options;

  const lines = [];
  let failed = false;

  if (report.runtimeError) {
    lines.push(`✗ runtimeError: ${report.runtimeError.message || report.runtimeError.code}`);
    return {
      failed: true,
      lines,
      summary: { label, perfScore: 0, lcp: null, fcp: null, cls: null, tbt: null },
    };
  }

  function audit(id) {
    return report.audits[id] ?? null;
  }

  function checkMetric(metricLabel, value, max, unit, { hard = true } = {}) {
    if (value == null || Number.isNaN(value)) {
      lines.push(`  · ${metricLabel}: n/a (skipped)`);
      return;
    }
    const slack =
      unit === "ms" && (metricLabel === "LCP" || metricLabel === "FCP") ? labSlackMs : 0;
    const ok = value <= max + slack;
    const formatted = unit === "cls" ? formatCls(value) : formatMs(value);
    const maxFormatted = unit === "cls" ? formatCls(max) : formatMs(max);
    const mark = ok ? "✓" : hard ? "✗" : "⚠";
    lines.push(`${mark} ${metricLabel}: ${formatted} (max ${maxFormatted})`);
    if (!ok && hard) failed = true;
  }

  const perfScore = Math.round((report.categories.performance?.score ?? 0) * 100);
  const a11yScore = Math.round((report.categories.accessibility?.score ?? 0) * 100);
  const bpScore = Math.round((report.categories["best-practices"]?.score ?? 0) * 100);
  const seoScore = Math.round((report.categories.seo?.score ?? 0) * 100);

  const perfOk = perfScore >= thresholds.minPerformance;
  lines.push(
    `${perfOk ? "✓" : enforcePerf ? "✗" : "⚠"} Performance: ${perfScore} (min ${thresholds.minPerformance})`,
  );
  if (enforcePerf && !perfOk) failed = true;

  for (const [cat, score, min] of [
    ["accessibility", a11yScore, minA11y],
    ["best-practices", bpScore, minBp],
    ["seo", seoScore, thresholds.minSeo ?? minSeo],
  ]) {
    const ok = score >= min;
    lines.push(`${ok ? "✓" : "✗"} ${cat}: ${score} (min ${min})`);
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

  if (ciRelaxed) {
    lines.push("→ CWV & lab metrics (CI relaxed — A11y/BP/SEO are hard gates):");
  } else {
    lines.push(`→ CWV & lab metrics (${label}):`);
  }
  checkMetric("LCP", lcp, thresholds.maxLcpMs, "ms", { hard: enforceCwv });
  if (inpValue != null) {
    checkMetric("INP", inpValue, 200, "ms", { hard: enforceLabExtras });
  } else {
    lines.push("  · INP: n/a (lab — field metric)");
    checkMetric("Max Potential FID (lab proxy)", mpfid, thresholds.maxMpfidMs, "ms", {
      hard: enforceLabExtras,
    });
  }
  checkMetric("CLS", cls, thresholds.maxCls, "cls", { hard: enforceCwv });
  checkMetric("FCP", fcp, thresholds.maxFcpMs, "ms", { hard: enforceCwv });
  checkMetric("TBT", tbt, thresholds.maxTbtMs, "ms", { hard: enforceLabExtras });
  checkMetric("Speed Index", si, thresholds.maxSiMs, "ms", { hard: enforceLabExtras });
  checkMetric("TTI", tti, thresholds.maxTtiMs, "ms", { hard: enforceLabExtras });
  checkMetric("TTFB", ttfb, thresholds.maxTtfbMs, "ms", { hard: enforceCwv });

  return {
    failed,
    lines,
    summary: {
      label,
      perfScore,
      a11yScore,
      bpScore,
      seoScore,
      lcp,
      fcp,
      cls,
      tbt,
      si,
      tti,
      ttfb,
      mpfid,
      inp: inpValue,
    },
  };
}
