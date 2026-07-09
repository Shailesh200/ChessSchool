#!/usr/bin/env node
/**
 * Audit all consumer web routes on production Next.js server (next start).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import lighthouse from "lighthouse";

const require = createRequire(import.meta.url);
const chromeLauncher = require("chrome-launcher");

import { scoreLighthouseReport } from "./lighthouse-score.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.join(__dirname, "web-lighthouse-routes.json");

const PORT = Number(process.env.WEB_PREVIEW_PORT || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const FORM_FACTOR = process.env.WEB_LH_FORM_FACTOR || "mobile";
const ROUTE_TIMEOUT_MS = Number(process.env.WEB_LH_ROUTE_TIMEOUT_SEC || 120) * 1000;
const ENFORCE_PERF = process.env.WEB_LH_ENFORCE_PERFORMANCE !== "0";
const MIN_A11Y = Number(process.env.WEB_LH_MIN_ACCESSIBILITY || 90);
const MIN_BP = Number(process.env.WEB_LH_MIN_BEST_PRACTICES || 90);
const MIN_SEO = Number(process.env.WEB_LH_MIN_SEO || 90);
const LAB_SLACK_MS = Number(process.env.WEB_LH_LAB_SLACK_MS || 150);

const manifest = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf8"));
const routes = manifest.routes;
const tiers = manifest.tiers;

function log(...args) {
  console.error(...args);
}

async function auditRoute(chrome, route) {
  const url = `${BASE}${route.path}`;
  const tier = tiers[route.tier] ?? tiers.public;
  const outPath = path.join(
    process.env.TMPDIR || "/tmp",
    `chessschool-lh-${route.path.replace(/\//g, "_") || "home"}.json`,
  );

  const config = {
    extends: "lighthouse:default",
    settings: {
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: FORM_FACTOR,
      screenEmulation:
        FORM_FACTOR === "desktop"
          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 }
          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75 },
    },
  };

  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      maxWaitForFcp: ROUTE_TIMEOUT_MS,
      maxWaitForLoad: ROUTE_TIMEOUT_MS,
    },
    config,
  );

  const report = result.lhr;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  const scored = scoreLighthouseReport(report, tier, {
    label: route.label,
    enforcePerf: ENFORCE_PERF,
    minA11y: tier.minA11y ?? MIN_A11Y,
    minBp: tier.minBp ?? MIN_BP,
    minSeo: tier.minSeo ?? MIN_SEO,
    labSlackMs: LAB_SLACK_MS,
  });

  return { route, scored, outPath };
}

async function main() {
  log("→ Lighthouse route audit (ChessSchool)");
  log(`  Base URL: ${BASE} (next start production build)`);
  log(`  Form factor: ${FORM_FACTOR}`);
  log(`  Routes: ${routes.length}`);
  log("");

  const results = [];
  let anyFailed = false;

  for (const route of routes) {
    log(`→ Auditing ${route.label} (${route.path}) [${route.tier}]`);
    const started = Date.now();
    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const result = await auditRoute(chrome, route);
      results.push(result);
      for (const line of result.scored.lines) {
        console.log(line);
      }
      if (result.scored.failed) anyFailed = true;
      log(`  … finished in ${Math.round((Date.now() - started) / 1000)}s`);
      log("");
    } catch (err) {
      anyFailed = true;
      log(`✗ ${route.label} failed: ${err instanceof Error ? err.message : err}`);
      log("");
    } finally {
      await chrome.kill();
    }
  }

  console.log("→ Summary (all screens):");
  console.log(
    "  " + ["Screen", "Perf", "LCP", "FCP", "CLS", "Status"].map((h) => h.padEnd(10)).join(""),
  );
  for (const { route, scored } of results) {
    const s = scored.summary;
    const status = scored.failed ? "FAIL" : "PASS";
    const cls = s.cls != null ? s.cls.toFixed(3) : "n/a";
    console.log(
      "  " +
        [
          route.label.slice(0, 10).padEnd(10),
          String(s.perfScore).padEnd(10),
          formatShortMs(s.lcp).padEnd(10),
          formatShortMs(s.fcp).padEnd(10),
          cls.padEnd(10),
          status,
        ].join(""),
    );
  }

  if (anyFailed) {
    process.exit(1);
  }
}

function formatShortMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "n/a";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
