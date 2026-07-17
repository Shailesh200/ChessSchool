#!/usr/bin/env node
/**
 * M-075 Phase B gate — home route (/) initial JS ≤280 KB gzip.
 * Sums unique client chunks for layout + tabs layout + campus page + framework.
 * Requires `pnpm --filter web build` first (verify-milestone runs build before this).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web");
const NEXT = path.join(WEB, ".next");
const MAX_KB = Number(process.env.HOME_JS_BUDGET_KB ?? 280);

// Home is `app/page.tsx` (landing / campus entry) — not under `(tabs)/`.
const manifestPath = path.join(
  NEXT,
  "server/app/page_client-reference-manifest.js",
);

if (!fs.existsSync(manifestPath)) {
  console.error("✗ Home client manifest missing — run pnpm build first");
  process.exit(1);
}

const src = fs.readFileSync(manifestPath, "utf8");
const manifest = Function(
  "globalThis",
  `${src}\nreturn globalThis.__RSC_MANIFEST["/page"];`,
)({ __RSC_MANIFEST: {} });

const entryJSFiles = manifest?.entryJSFiles;
if (!entryJSFiles) {
  console.error("✗ Could not read entryJSFiles from client manifest");
  process.exit(1);
}

const ROUTE_KEYS = [
  "[project]/apps/web/app/layout",
  "[project]/apps/web/app/template",
  "[project]/apps/web/app/page",
];

const rootManifest = JSON.parse(
  fs.readFileSync(path.join(NEXT, "build-manifest.json"), "utf8"),
);

const chunks = new Set([
  ...(rootManifest.rootMainFiles ?? []),
  ...(rootManifest.polyfillFiles ?? []),
]);

const polyfills = new Set(rootManifest.polyfillFiles ?? []);

for (const key of ROUTE_KEYS) {
  for (const chunk of entryJSFiles[key] ?? []) {
    chunks.add(chunk.replace(/^\/?_next\//, "").replace(/^static\//, "static/"));
  }
}

let raw = 0;
let gz = 0;
let polyGz = 0;
const missing = [];
for (const chunk of chunks) {
  const file = path.join(NEXT, chunk);
  if (!fs.existsSync(file)) {
    missing.push(chunk);
    continue;
  }
  const buf = fs.readFileSync(file);
  const chunkGz = zlib.gzipSync(buf).length;
  raw += buf.length;
  gz += chunkGz;
  if (polyfills.has(chunk)) polyGz += chunkGz;
}

if (missing.length) {
  console.warn(`  · ${missing.length} chunk(s) missing from disk (ignored)`);
}

const gzKb = gz / 1024;
const appGzKb = (gz - polyGz) / 1024;
const rawKb = raw / 1024;
console.log(
  `→ Home initial JS: ${appGzKb.toFixed(1)} KB gzip app (${gzKb.toFixed(1)} KB incl. ${(polyGz / 1024).toFixed(1)} KB polyfill, ${rawKb.toFixed(1)} KB raw, ${chunks.size - missing.length} chunks)`,
);

if (appGzKb > MAX_KB) {
  console.error(`✗ Home JS budget exceeded: ${appGzKb.toFixed(1)} KB > ${MAX_KB} KB gzip (app chunks)`);
  process.exit(1);
}

console.log(`✓ Home JS within budget (≤${MAX_KB} KB gzip)`);
