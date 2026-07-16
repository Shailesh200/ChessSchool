/**
 * Write a standalone HTML + JSON Lighthouse milestone report.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatCls(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(3);
}

function scoreTone(score) {
  if (score == null || Number.isNaN(score)) return "muted";
  if (score >= 90) return "good";
  if (score >= 75) return "ok";
  if (score >= 50) return "warn";
  return "bad";
}

function avg(nums) {
  const vals = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * @param {object} opts
 * @param {Array<{route: object, scored: object}>} opts.results
 * @param {string} [opts.outDir]
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.formFactor]
 * @param {boolean} [opts.passed]
 */
export function writeLighthouseReport({
  results,
  outDir = process.env.WEB_LH_REPORT_DIR || path.join(ROOT, "reports/lighthouse"),
  baseUrl = "http://127.0.0.1:4173",
  formFactor = "mobile",
  passed,
}) {
  fs.mkdirSync(outDir, { recursive: true });

  const rows = results.map(({ route, scored }) => {
    const s = scored.summary ?? {};
    return {
      id: route.path,
      label: route.label,
      path: route.path,
      tier: route.tier,
      passed: !scored.failed,
      perf: s.perfScore ?? 0,
      a11y: s.a11yScore ?? 0,
      bp: s.bpScore ?? 0,
      seo: s.seoScore ?? 0,
      lcp: s.lcp ?? null,
      fcp: s.fcp ?? null,
      cls: s.cls ?? null,
      tbt: s.tbt ?? null,
      ttfb: s.ttfb ?? null,
    };
  });

  const passCount = rows.filter((r) => r.passed).length;
  const allPassed = passed ?? passCount === rows.length;
  const generatedAt = new Date().toISOString();

  const payload = {
    title: "ChessSchool Lighthouse report",
    generatedAt,
    baseUrl,
    formFactor,
    passed: allPassed,
    totals: {
      routes: rows.length,
      passed: passCount,
      failed: rows.length - passCount,
      avgPerf: avg(rows.map((r) => r.perf)),
      avgA11y: avg(rows.map((r) => r.a11y)),
      avgBp: avg(rows.map((r) => r.bp)),
      avgSeo: avg(rows.map((r) => r.seo)),
    },
    routes: rows,
  };

  const jsonPath = path.join(outDir, "results.json");
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const html = renderHtml(payload);
  const htmlPath = path.join(outDir, "index.html");
  fs.writeFileSync(htmlPath, html);

  return { htmlPath, jsonPath, payload };
}

function renderHtml(data) {
  const { totals, routes, generatedAt, baseUrl, formFactor, passed } = data;
  const statusLabel = passed ? "All gates passed" : "Gates failed";
  const statusClass = passed ? "pass" : "fail";

  const cards = [
    ["Routes", `${totals.passed}/${totals.routes}`],
    ["Avg Perf", totals.avgPerf == null ? "—" : String(totals.avgPerf)],
    ["Avg A11y", totals.avgA11y == null ? "—" : String(totals.avgA11y)],
    ["Avg SEO", totals.avgSeo == null ? "—" : String(totals.avgSeo)],
  ]
    .map(
      ([k, v]) => `<div class="card"><div class="card-k">${esc(k)}</div><div class="card-v">${esc(v)}</div></div>`,
    )
    .join("");

  const bodyRows = routes
    .map((r) => {
      const rowClass = r.passed ? "row-pass" : "row-fail";
      return `<tr class="${rowClass}">
        <td>
          <div class="route-label">${esc(r.label)}</div>
          <div class="route-path">${esc(r.path)}</div>
        </td>
        <td><span class="tier">${esc(r.tier)}</span></td>
        <td><span class="badge ${scoreTone(r.perf)}">${esc(r.perf)}</span></td>
        <td><span class="badge ${scoreTone(r.a11y)}">${esc(r.a11y)}</span></td>
        <td><span class="badge ${scoreTone(r.bp)}">${esc(r.bp)}</span></td>
        <td><span class="badge ${scoreTone(r.seo)}">${esc(r.seo)}</span></td>
        <td>${esc(formatMs(r.lcp))}</td>
        <td>${esc(formatMs(r.fcp))}</td>
        <td>${esc(formatCls(r.cls))}</td>
        <td>${esc(formatMs(r.tbt))}</td>
        <td>${esc(formatMs(r.ttfb))}</td>
        <td><span class="status ${r.passed ? "pass" : "fail"}">${r.passed ? "PASS" : "FAIL"}</span></td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ChessSchool · Lighthouse ${totals.passed}/${totals.routes}</title>
  <style>
    :root {
      --bg: #f6f3ec;
      --ink: #1c1915;
      --muted: #6b645a;
      --line: #ddd4c6;
      --card: #fffdf8;
      --brand: #0f6b4c;
      --good: #1f7a4c;
      --ok: #8a6a12;
      --warn: #b45309;
      --bad: #b42318;
      --fail-bg: #fceceb;
      --pass-bg: #e8f5ee;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 500px at 10% -10%, #e7efe8 0%, transparent 55%),
        radial-gradient(900px 400px at 100% 0%, #efe6d6 0%, transparent 50%),
        var(--bg);
      min-height: 100vh;
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    header { margin-bottom: 1.75rem; }
    .eyebrow {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--brand);
      margin: 0 0 0.5rem;
    }
    h1 {
      font-size: clamp(1.8rem, 3vw, 2.4rem);
      line-height: 1.1;
      margin: 0 0 0.6rem;
      letter-spacing: -0.02em;
    }
    .sub {
      font-family: ui-sans-serif, system-ui, sans-serif;
      color: var(--muted);
      font-size: 0.95rem;
      margin: 0;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 1rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .status-pill.pass { background: var(--pass-bg); color: var(--good); }
    .status-pill.fail { background: var(--fail-bg); color: var(--bad); }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 1.5rem 0 1.75rem;
    }
    @media (max-width: 800px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1rem 1.1rem;
    }
    .card-k {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .card-v {
      margin-top: 0.35rem;
      font-size: 1.55rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.86rem;
    }
    th {
      text-align: left;
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 0.85rem 0.75rem;
      border-bottom: 1px solid var(--line);
      background: #faf7f0;
      white-space: nowrap;
    }
    td {
      padding: 0.8rem 0.75rem;
      border-bottom: 1px solid #eee6d8;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: 0; }
    tr.row-fail { background: #fff8f7; }
    .route-label { font-weight: 700; color: var(--ink); }
    .route-path { color: var(--muted); font-size: 0.75rem; margin-top: 0.15rem; }
    .tier {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      background: #efe8da;
      color: #5c5348;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge {
      display: inline-flex;
      min-width: 2.1rem;
      justify-content: center;
      padding: 0.2rem 0.4rem;
      border-radius: 999px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .badge.good { background: #e5f4eb; color: var(--good); }
    .badge.ok { background: #f7efd2; color: var(--ok); }
    .badge.warn { background: #ffedd5; color: var(--warn); }
    .badge.bad { background: #fee4e2; color: var(--bad); }
    .badge.muted { background: #eee; color: var(--muted); }
    .status {
      font-weight: 800;
      font-size: 0.72rem;
      letter-spacing: 0.06em;
    }
    .status.pass { color: var(--good); }
    .status.fail { color: var(--bad); }
    footer {
      margin-top: 1.25rem;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .scroll { overflow-x: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">ChessSchool · Web GA gate</p>
      <h1>Lighthouse milestone report</h1>
      <p class="sub">${esc(formFactor)} lab · ${esc(baseUrl)} · ${esc(generatedAt)}</p>
      <div class="status-pill ${statusClass}">${esc(statusLabel)} · ${totals.passed}/${totals.routes} routes</div>
    </header>

    <section class="grid">${cards}</section>

    <section class="panel">
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Screen</th>
              <th>Tier</th>
              <th>Perf</th>
              <th>A11y</th>
              <th>BP</th>
              <th>SEO</th>
              <th>LCP</th>
              <th>FCP</th>
              <th>CLS</th>
              <th>TBT</th>
              <th>TTFB</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </section>

    <footer>
      Generated by <code>pnpm verify:web-lighthouse</code> · JSON: <code>results.json</code>
    </footer>
  </div>
</body>
</html>`;
}
