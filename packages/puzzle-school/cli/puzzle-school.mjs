#!/usr/bin/env node
/**
 * Puzzle School CLI — validate | stats | adapt-csv
 *
 *   pnpm puzzle-school validate
 *   pnpm puzzle-school stats
 *   pnpm puzzle-school adapt-csv [chess-school-puzzles.csv.gz]
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank } from "../src/bank.mjs";
import { validateBank } from "../src/validate-bank.mjs";
import { bankStats, printBankStats } from "../src/stats.mjs";
import { printReportSummary } from "../src/report.mjs";
import {
  conceptForThemes,
  stageForRating,
} from "../src/concepts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const repoRoot = join(pkgRoot, "../..");
const defaultBank = join(pkgRoot, "data/puzzles");
const defaultCsv = join(repoRoot, "data/chess-school-puzzles.csv.gz");

const [cmd, arg] = process.argv.slice(2);

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`usage:
  puzzle-school validate [bankDir]
  puzzle-school stats [bankDir]
  puzzle-school adapt-csv [csv.gz] [outDir]`);
  process.exit(0);
}

if (cmd === "validate") {
  const bankDir = arg ?? defaultBank;
  const puzzles = loadBank(bankDir);
  if (!puzzles.length) {
    console.error(`✗ No puzzles in ${bankDir}. Run: pnpm puzzle-school adapt-csv`);
    process.exit(2);
  }
  const report = validateBank(puzzles, { command: "validate", source: bankDir });
  printReportSummary(report);
  process.exit(report.exitCode);
}

if (cmd === "stats") {
  const bankDir = arg ?? defaultBank;
  const puzzles = loadBank(bankDir);
  if (!puzzles.length) {
    console.error(`✗ No puzzles in ${bankDir}`);
    process.exit(2);
  }
  printBankStats(bankStats(puzzles));
  process.exit(0);
}

if (cmd === "adapt-csv") {
  const input = arg ?? defaultCsv;
  const outDir = process.argv[4] ?? defaultBank;
  if (!existsSync(input)) {
    console.error(`✗ CSV not found: ${input}`);
    process.exit(2);
  }
  await adaptCsv(input, outDir);
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
process.exit(2);

/** @param {string} input @param {string} outDir */
async function adaptCsv(input, outDir) {
  /** @type {Map<string, { lines: string[], next: number }>} */
  const writers = new Map();
  const seen = new Set();
  let scanned = 0;
  let kept = 0;
  let skipped = 0;

  const rl = createInterface({
    input: input.endsWith(".gz")
      ? createReadStream(input).pipe(createGunzip())
      : createReadStream(input),
    crlfDelay: Infinity,
  });

  let header = true;
  for await (const line of rl) {
    if (header) {
      header = false;
      continue;
    }
    scanned++;
    const c = line.split(",");
    if (c.length < 8) continue;
    const rating = Number(c[3]);
    if (!rating) continue;
    const themes = c[7].split(" ");
    const group = conceptForThemes(themes);
    if (!group) continue;
    const stage = stageForRating(rating);
    const fen = c[1];
    const moves = c[2].trim();
    const dup = `${fen}|${moves}`;
    if (seen.has(dup)) {
      skipped++;
      continue;
    }
    seen.add(dup);

    const key = `${stage.id}:${group.id}`;
    let bucket = writers.get(key);
    if (!bucket) {
      bucket = { lines: [], next: 0 };
      writers.set(key, bucket);
    }
    bucket.next += 1;
    const id = `cs-pz-${stage.id}-${group.id}-${String(bucket.next).padStart(4, "0")}`;
    const record = {
      id,
      stage: stage.id,
      concepts: [group.id],
      rating,
      source: "adapted",
      sourceRef: `lichess:${c[0]}`,
      fen,
      line: moves.split(/\s+/),
    };
    bucket.lines.push(JSON.stringify(record));
    kept++;
  }

  // Clear existing jsonl in outDir
  if (existsSync(outDir)) {
    const wipe = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) wipe(p);
        else if (ent.name.endsWith(".jsonl")) unlinkSync(p);
      }
    };
    wipe(outDir);
  }

  for (const [key, bucket] of writers) {
    const [stage, concept] = key.split(":");
    const dir = join(outDir, stage);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${concept}.jsonl`);
    writeFileSync(path, `${bucket.lines.join("\n")}\n`);
  }

  console.log(
    `Adapted ${kept.toLocaleString()} puzzles (${skipped.toLocaleString()} dupes skipped) from ${scanned.toLocaleString()} rows → ${outDir}`,
  );
  console.log(`  Buckets: ${writers.size}`);
}
