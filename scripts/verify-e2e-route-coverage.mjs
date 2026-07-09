#!/usr/bin/env node
/**
 * Ensures ≥ minCoveragePercent of routes in web-e2e-routes.json have e2e coverage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(__dirname, "web-e2e-routes.json");
const E2E_DIR = path.join(ROOT, "apps/web/e2e");

const { minCoveragePercent, routes } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

function collectE2ePaths() {
  const covered = new Set();
  const files = fs.readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts"));
  for (const file of files) {
    const text = fs.readFileSync(path.join(E2E_DIR, file), "utf8");
    const re = /(?:page\.goto|goto)\(\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      let p = m[1];
      if (p.startsWith("http")) {
        try {
          p = new URL(p).pathname;
        } catch {
          continue;
        }
      }
      if (!p.startsWith("/")) p = `/${p}`;
      covered.add(p.replace(/\/$/, "") || "/");
    }
  }
  return covered;
}

const covered = collectE2ePaths();
const missing = [];

for (const route of routes) {
  const p = route.path.replace(/\/$/, "") || "/";
  if (!covered.has(p)) {
    missing.push(route);
  }
}

const total = routes.length;
const hit = total - missing.length;
const pct = total === 0 ? 100 : Math.round((hit / total) * 100);

console.log(`→ E2E route coverage: ${hit}/${total} (${pct}%, min ${minCoveragePercent}%)`);
for (const route of routes) {
  const p = route.path.replace(/\/$/, "") || "/";
  const ok = covered.has(p);
  console.log(`${ok ? "✓" : "✗"} ${route.label}: ${route.path}`);
}

if (pct < minCoveragePercent) {
  console.error(
    `\n✗ E2E route coverage ${pct}% is below ${minCoveragePercent}%. Add Playwright tests in apps/web/e2e/ for:`,
  );
  for (const r of missing) {
    console.error(`  - ${r.path} (${r.label})`);
  }
  process.exit(1);
}

console.log("✓ E2E route coverage passed");
