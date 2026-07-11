#!/usr/bin/env node
/**
 * Import Puzzle School JSONL bank into local.db.
 *
 *   pnpm db:import-puzzle-school
 *   LIMIT=8000 pnpm db:import-puzzle-school
 *
 * Bank: packages/puzzle-school/data/puzzles/ (run `pnpm puzzle-school adapt-csv` once).
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  loadBank,
  bucketPuzzles,
  validateBank,
  buildCurriculumFromBuckets,
  emptyReport,
  printReportSummary,
  finalizeReport,
} from "@chess-school/puzzle-school";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const bankDir = join(repoRoot, "packages/puzzle-school/data/puzzles");
const REPORT_PATH = "curriculum-import-report.json";
const importStarted = Date.now();
const TARGET_TOTAL = Number(process.env.LIMIT ?? 16000);

if (!existsSync(bankDir)) {
  console.error(`✗ Puzzle School bank not found: ${bankDir}`);
  console.error("  Run: pnpm puzzle-school adapt-csv");
  process.exit(2);
}

const puzzles = loadBank(bankDir);
if (!puzzles.length) {
  console.error(`✗ Bank is empty. Run: pnpm puzzle-school adapt-csv`);
  process.exit(2);
}

const validation = validateBank(puzzles, {
  command: "import-puzzle-school",
  source: bankDir,
  failOnWarn: false,
});
if (validation.summary.rejected > 0) {
  printReportSummary(validation);
  console.error("✗ Bank validation failed — fix puzzles before import.");
  process.exit(1);
}

const buckets = bucketPuzzles(puzzles);
const { semesters, classes, lessons, puzzleCount } = buildCurriculumFromBuckets(buckets, {
  targetTotal: TARGET_TOTAL,
});

console.log(
  `Built ${lessons.length} lessons (${puzzleCount} puzzles + tutorials) · ${classes.length} classes · ${semesters.length} semesters`,
);

if (!existsSync("local.db")) {
  console.error("✗ local.db not found. Run `pnpm db:fresh` first.");
  process.exit(1);
}
const db = new Database("local.db");
const hasTables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lessons'")
  .get();
if (!hasTables) {
  console.error("✗ local.db has no schema. Run `pnpm db:fresh` first.");
  process.exit(1);
}

db.exec(
  "DELETE FROM lessons WHERE class_id LIKE 'pz-%'; DELETE FROM classes WHERE id LIKE 'pz-%'; DELETE FROM semesters WHERE id LIKE 'pz-%';",
);
const insSem = db.prepare(
  "INSERT INTO semesters (id,title,blurb,color,stage,sort_order) VALUES (@id,@title,@blurb,@color,@stage,@sortOrder)",
);
const insCls = db.prepare(
  "INSERT INTO classes (id,semester_id,title,emoji,blurb,difficulty,sort_order) VALUES (@id,@semesterId,@title,@emoji,@blurb,@difficulty,@sortOrder)",
);
const insLes = db.prepare(
  "INSERT INTO lessons (id,class_id,title,subtitle,emoji,tag,xp,is_exam,prerequisites,steps,sort_order) VALUES (@id,@classId,@title,@subtitle,@emoji,@tag,@xp,@isExam,@prerequisites,@steps,@sortOrder)",
);
const tx = db.transaction(() => {
  for (const s of semesters) insSem.run(s);
  for (const c of classes) insCls.run(c);
  for (const l of lessons) insLes.run(l);
});
tx();

const importReport = emptyReport("import-puzzle-school", bankDir);
importReport.summary.scanned = puzzles.length;
importReport.summary.inserted = lessons.filter((l) => l.classId.startsWith("pz-")).length;
importReport.summary.rejected = validation.summary.rejected;
importReport.summary.warnings = validation.summary.warnings;
importReport.byOutcome = validation.byOutcome;
importReport.durationMs = Date.now() - importStarted;
finalizeReport(importReport, { failOnReject: false });
printReportSummary(importReport);
writeFileSync(REPORT_PATH, JSON.stringify(importReport, null, 2));
console.log(`  Report:     ${REPORT_PATH}`);
console.log(`✅ Imported into local.db. Next: pnpm curriculum:validate && pnpm db:dump`);
