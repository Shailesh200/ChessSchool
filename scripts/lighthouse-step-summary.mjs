/**
 * Append a compact Lighthouse scorecard to GitHub Actions job summary.
 */
import fs from "node:fs";

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

/**
 * @param {object} payload — from writeLighthouseReport().payload
 */
export function writeLighthouseStepSummary(payload) {
  const out = process.env.GITHUB_STEP_SUMMARY;
  if (!out) return;

  const { totals, routes, passed, formFactor, generatedAt } = payload;
  const lines = [
    `## Lighthouse (${totals.passed}/${totals.routes} ${passed ? "passed" : "failed"})`,
    "",
    `- Form factor: \`${formFactor}\``,
    `- Generated: \`${generatedAt}\``,
    `- Avg Perf / A11y / SEO: **${totals.avgPerf ?? "—"}** / **${totals.avgA11y ?? "—"}** / **${totals.avgSeo ?? "—"}**`,
    "",
    "| Screen | Tier | Perf | A11y | SEO | LCP | Status |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const r of routes) {
    lines.push(
      `| ${r.label} (\`${r.path}\`) | ${r.tier} | ${r.perf} | ${r.a11y} | ${r.seo} | ${formatMs(r.lcp)} | ${r.passed ? "✅" : "❌"} |`,
    );
  }

  lines.push("");
  lines.push("Full HTML report: workflow artifact `lighthouse-report` → `index.html`.");
  lines.push("");

  fs.appendFileSync(out, lines.join("\n"));
}
