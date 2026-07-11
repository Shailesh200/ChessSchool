#!/usr/bin/env node
/**
 * Import puzzle bank into local.db (currently: curated Lichess CSV → pz-* semesters).
 * Future: Puzzle School JSONL bank via the same entry point.
 *
 *   pnpm db:import-puzzle-school
 *   LIMIT=5200 pnpm db:import-puzzle-school
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const defaultCsv = join(repoRoot, "data/chess-school-puzzles.csv.gz");
const input = process.argv[2] ?? defaultCsv;

if (!existsSync(input)) {
  console.error(`✗ Puzzle source not found: ${input}`);
  console.error("  Place data/chess-school-puzzles.csv.gz at repo root, or pass a path.");
  process.exit(2);
}

const res = spawnSync("node", [join(here, "import-lichess.mjs"), input], {
  cwd: join(here, ".."),
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
