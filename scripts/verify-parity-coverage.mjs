#!/usr/bin/env node
/**
 * Ensures parity-routes.json screens have Maestro capture flows and a manifest-driven Playwright spec.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "parity-routes.json"), "utf8"));
const MAESTRO_DIR = path.join(ROOT, "parity", "maestro", "flows", "capture");
const SPEC = path.join(ROOT, "apps/web/e2e/parity-matrix.spec.ts");

const specText = fs.readFileSync(SPEC, "utf8");
const missingMaestro = MANIFEST.screens
  .map((s) => s.id)
  .filter((id) => !fs.existsSync(path.join(MAESTRO_DIR, `${id}.yaml`)));

const manifestDriven =
  specText.includes("parity-routes.json") && specText.includes("manifest.screens") && specText.includes("for (const screen");

let ok = true;
if (missingMaestro.length) {
  ok = false;
  console.error("✗ Missing Maestro flows (run pnpm parity:generate):", missingMaestro.join(", "));
}
if (!manifestDriven) {
  ok = false;
  console.error("✗ apps/web/e2e/parity-matrix.spec.ts must loop over parity-routes.json");
}

if (ok) {
  console.log(`✓ Parity coverage OK (${MANIFEST.screens.length} screens, manifest-driven Playwright spec)`);
} else {
  process.exit(1);
}
