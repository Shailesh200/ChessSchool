#!/usr/bin/env node
/**
 * Home route (`/`) first-load JS budget.
 * Measures the same script set Playwright loads for `/` (see scripts/lib/home-initial-js.cjs).
 * Requires `pnpm --filter web build` first.
 */
import { HOME_JS_BUDGET_KB, measureBuiltHome } from "./lib/home-initial-js.cjs";

const maxKb = Number(process.env.HOME_JS_BUDGET_KB ?? HOME_JS_BUDGET_KB);

let measured;
try {
  measured = measureBuiltHome();
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const kb = measured.kb;
console.log(
  `→ Home initial JS: ${kb.toFixed(1)} KB gzip (${measured.chunks.length} first-load scripts, ${(measured.rawBytes / 1024).toFixed(1)} KB raw)`,
);

if (kb > maxKb) {
  console.error(`✗ Home JS budget exceeded: ${kb.toFixed(1)} KB > ${maxKb} KB gzip`);
  process.exit(1);
}

console.log(`✓ Home JS within budget (≤${maxKb} KB gzip)`);
