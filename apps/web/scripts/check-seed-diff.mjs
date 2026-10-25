/**
 * Prove `apps/web/db/seed.sql` differs from a base ref only in:
 *   1. `homework_lessons` INSERT rows
 *   2. `steps` FEN strings of `pre-bishop-diagonal-info` and `pre-queen-on-diagonal`
 *
 * The new FENs must match `apps/web/content/data/preschool-lessons-extra.mjs`.
 * Any other seed line — other lessons, promotion pieces, schema, formatting — fails.
 *
 *   node apps/web/scripts/check-seed-diff.mjs [base-ref]
 *
 * Default base ref is `staging`. Compares that ref to the working tree.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRESCHOOL_EXTRA } from "../content/data/preschool-lessons-extra.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const seedRel = "apps/web/db/seed.sql";
const base = process.argv[2] ?? "staging";
const FEN_LESSONS = ["pre-bishop-diagonal-info", "pre-queen-on-diagonal"];
const EXPECTED_HOMEWORK = 84;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0)
    fail((result.stderr || `git ${args.join(" ")} failed`).trim());
  return result.stdout;
}

function homeworkId(line) {
  const match = line.match(/VALUES \('([^']+)'/);
  if (!match) fail(`homework row is missing an id: ${line.slice(0, 120)}`);
  return match[1];
}

function idsFrom(sql) {
  return sql
    .split("\n")
    .filter((line) => line.startsWith("INSERT INTO homework_lessons "))
    .map(homeworkId);
}

function lessonIdOf(line) {
  if (!line.startsWith("INSERT INTO lessons ")) return null;
  for (const id of FEN_LESSONS) {
    if (line.includes(`VALUES ('${id}',`)) return id;
  }
  return null;
}

function classify(line) {
  if (line.startsWith("INSERT INTO homework_lessons (")) return { kind: "homework" };
  const id = lessonIdOf(line);
  if (id) return { kind: "lesson", id };
  return null;
}

function stepsFromSql(line) {
  // Prerequisites are a JSON array of strings (`'["id"]'`). Steps are objects (`'[{...}]'`).
  const start = line.indexOf(",'[{");
  const end = line.lastIndexOf("]',");
  if (start < 0 || end < start)
    fail(`could not find steps JSON in ${line.slice(0, 80)}`);
  // `end` is the closing `]` of the steps array (`]',<sort>`).
  const json = line.slice(start + 2, end + 1).replaceAll("''", "'");
  try {
    return JSON.parse(json);
  } catch (error) {
    fail(`steps JSON parse failed: ${error instanceof Error ? error.message : error}`);
  }
}

function maskFens(line) {
  return line.replace(/"fen":"[^"]*"/g, '"fen":"*"');
}

const diff = git(["--no-pager", "diff", "-U0", "--no-color", base, "--", seedRel]);
if (!diff.trim()) fail(`no ${seedRel} changes against ${base}`);

const removedLessons = new Map();
const addedLessons = new Map();
let changedLines = 0;

for (const line of diff.split("\n")) {
  if (
    line === "" ||
    line.startsWith("diff ") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("@@")
  ) {
    continue;
  }
  if (line.startsWith("\\")) fail(`unexpected diff marker: ${line}`);
  if (!line.startsWith("+") && !line.startsWith("-")) {
    fail(`unexpected diff line: ${line.slice(0, 160)}`);
  }
  changedLines++;
  const sign = line[0];
  const body = line.slice(1);
  const kind = classify(body);
  if (!kind) {
    const id = body.match(/VALUES \('([^']+)'/)?.[1] ?? body.slice(0, 80);
    fail(`disallowed seed change (${id})`);
  }
  if (kind.kind === "homework") continue;
  const bucket = sign === "-" ? removedLessons : addedLessons;
  if (bucket.has(kind.id)) fail(`multiple ${sign} lines for ${kind.id}`);
  bucket.set(kind.id, body);
}

const newSql = readFileSync(join(repoRoot, seedRel), "utf8");
const baseSql = git(["show", `${base}:${seedRel}`]);
const oldIds = idsFrom(baseSql);
const newIds = idsFrom(newSql);
if (new Set(newIds).size !== newIds.length)
  fail("duplicate homework ids in the new seed");
if (newIds.length !== EXPECTED_HOMEWORK) {
  fail(`expected ${EXPECTED_HOMEWORK} homework_lessons rows, found ${newIds.length}`);
}

const newIdSet = new Set(newIds);
const oldIdSet = new Set(oldIds);
const overlap = oldIds.filter((id) => newIdSet.has(id));
const missing = oldIds.filter((id) => !newIdSet.has(id));
const added = newIds.filter((id) => !oldIdSet.has(id));

const sourceByLesson = new Map(PRESCHOOL_EXTRA.map((lesson) => [lesson.id, lesson]));
console.log(`seed.sql check against ${base}`);
console.log(`homework rows: ${oldIds.length} -> ${newIds.length}`);
console.log(`id overlap: ${overlap.length}`);
console.log(`old ids missing from the new set: ${missing.length}`);
if (missing.length) console.log(`  ${missing.join(", ")}`);
console.log(`new ids not in the old set: ${added.length}`);
if (added.length) console.log(`  ${added.join(", ")}`);

for (const id of FEN_LESSONS) {
  const oldLine = removedLessons.get(id);
  const newLine = addedLessons.get(id);
  if (!oldLine || !newLine)
    fail(`${id} must be an updated lesson row, not only added or removed`);
  if (maskFens(oldLine) !== maskFens(newLine)) {
    fail(`${id} changed something other than "fen" strings`);
  }
  const source = sourceByLesson.get(id);
  if (!source) fail(`lesson source is missing ${id}`);
  const oldSteps = stepsFromSql(oldLine);
  const newSteps = stepsFromSql(newLine);
  if (oldSteps.length !== newSteps.length || newSteps.length !== source.steps.length) {
    fail(`${id} step count changed or does not match the lesson source`);
  }
  console.log(`${id}`);
  for (let i = 0; i < newSteps.length; i++) {
    const oldStep = oldSteps[i];
    const newStep = newSteps[i];
    const sourceStep = source.steps[i];
    if (oldStep.id !== newStep.id || newStep.id !== sourceStep.id) {
      fail(`${id} step id changed (${oldStep.id} / ${newStep.id} / ${sourceStep.id})`);
    }
    const { fen: oldFen, ...oldRest } = oldStep;
    const { fen: newFen, ...newRest } = newStep;
    if (JSON.stringify(oldRest) !== JSON.stringify(newRest)) {
      fail(`${id} ${newStep.id} changed a non-fen step field`);
    }
    if (newFen !== sourceStep.fen) {
      fail(`${id} ${newStep.id} fen is ${newFen}, source is ${sourceStep.fen}`);
    }
    console.log(`  ${newStep.id}`);
    console.log(`    - ${oldFen}`);
    console.log(`    + ${newFen}`);
  }
}

const beforeBytes = Number(git(["cat-file", "-s", `${base}:${seedRel}`]).trim());
const afterBytes = statSync(join(repoRoot, seedRel)).size;
console.log(`seed size: ${beforeBytes} -> ${afterBytes} bytes`);
console.log(`changed seed lines: ${changedLines}`);
console.log(
  "✓ every changed seed line is a homework row or one of the two FEN lessons",
);
