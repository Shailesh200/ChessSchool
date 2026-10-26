/**
 * Prove the curriculum seed differs from a base ref only in:
 *   1. `homework_lessons` INSERT rows
 *   2. `steps` FEN strings of `pre-bishop-diagonal-info` and `pre-queen-on-diagonal`
 *
 * The snapshot is `apps/web/db/seed.sql.gz`. Both sides are decompressed before
 * the line check, so a deterministic re-gzip of the same SQL is not a diff.
 * A base ref that still has plain `apps/web/db/seed.sql` is read as text.
 *
 * The new FENs must match `apps/web/content/data/preschool-lessons-extra.mjs`.
 * Any other seed line — other lessons, promotion pieces, schema, formatting — fails.
 *
 *   node apps/web/db/oneoff/check-seed-diff.mjs [base-ref]
 *
 * Default base ref is `staging`. Compares that ref to the working tree.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSeedSql, readSeedSql } from "../seed-file.mjs";
import { PRESCHOOL_EXTRA } from "../../content/data/preschool-lessons-extra.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const seedGzRel = "apps/web/db/seed.sql.gz";
const seedSqlRel = "apps/web/db/seed.sql";
const base = process.argv[2] ?? "staging";
const FEN_LESSONS = ["pre-bishop-diagonal-info", "pre-queen-on-diagonal"];
const EXPECTED_HOMEWORK = 84;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function git(args, encoding = "utf8") {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0)
    fail((result.stderr || `git ${args.join(" ")} failed`).toString().trim());
  return result.stdout;
}

function refExists(spec) {
  const result = spawnSync("git", ["cat-file", "-e", spec], { cwd: repoRoot });
  return result.status === 0;
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

function countLines(sql) {
  const counts = new Map();
  for (const line of sql.split("\n")) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

/** Multiset difference of SQL lines. Order does not matter; duplicate lines do. */
function lineChanges(before, after) {
  const beforeCounts = countLines(before);
  const afterCounts = countLines(after);
  const removed = [];
  const added = [];
  for (const [line, count] of beforeCounts) {
    const kept = afterCounts.get(line) ?? 0;
    for (let i = kept; i < count; i++) removed.push(line);
  }
  for (const [line, count] of afterCounts) {
    const kept = beforeCounts.get(line) ?? 0;
    for (let i = kept; i < count; i++) added.push(line);
  }
  return { removed, added };
}

function readBaseSql(ref) {
  const gzSpec = `${ref}:${seedGzRel}`;
  if (refExists(gzSpec)) return gunzipSeedSql(git(["show", gzSpec], "buffer"));
  const sqlSpec = `${ref}:${seedSqlRel}`;
  if (refExists(sqlSpec)) return git(["show", sqlSpec], "buffer").toString("utf8");
  fail(`neither ${seedGzRel} nor ${seedSqlRel} exists at ${ref}`);
}

function readWorkingSql() {
  const gzPath = join(repoRoot, seedGzRel);
  if (existsSync(gzPath)) return readSeedSql(gzPath);
  const sqlPath = join(repoRoot, seedSqlRel);
  if (existsSync(sqlPath)) return readFileSync(sqlPath, "utf8");
  fail(`missing ${seedGzRel}`);
}

function artifactSize(ref) {
  for (const rel of [seedGzRel, seedSqlRel]) {
    const spec = `${ref}:${rel}`;
    if (!refExists(spec)) continue;
    return { rel, bytes: Number(git(["cat-file", "-s", spec]).trim()) };
  }
  fail(`no seed artifact at ${ref}`);
}

const baseSql = readBaseSql(base);
const newSql = readWorkingSql();
const { removed, added } = lineChanges(baseSql, newSql);
const changedLines = removed.length + added.length;
if (changedLines === 0) fail(`no seed SQL changes against ${base}`);

const removedLessons = new Map();
const addedLessons = new Map();

function record(body, sign) {
  const kind = classify(body);
  if (!kind) {
    const id = body.match(/VALUES \('([^']+)'/)?.[1] ?? body.slice(0, 80);
    fail(`disallowed seed change (${id})`);
  }
  if (kind.kind === "homework") return;
  const bucket = sign === "-" ? removedLessons : addedLessons;
  if (bucket.has(kind.id)) fail(`multiple ${sign} lines for ${kind.id}`);
  bucket.set(kind.id, body);
}

for (const body of removed) record(body, "-");
for (const body of added) record(body, "+");

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
const addedIds = newIds.filter((id) => !oldIdSet.has(id));

const sourceByLesson = new Map(PRESCHOOL_EXTRA.map((lesson) => [lesson.id, lesson]));
console.log(`seed.sql.gz check against ${base}`);
console.log(`homework rows: ${oldIds.length} -> ${newIds.length}`);
console.log(`id overlap: ${overlap.length}`);
console.log(`old ids missing from the new set: ${missing.length}`);
if (missing.length) console.log(`  ${missing.join(", ")}`);
console.log(`new ids not in the old set: ${addedIds.length}`);
if (addedIds.length) console.log(`  ${addedIds.join(", ")}`);

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

const before = artifactSize(base);
const gzPath = join(repoRoot, seedGzRel);
const afterBytes = existsSync(gzPath)
  ? statSync(gzPath).size
  : statSync(join(repoRoot, seedSqlRel)).size;
console.log(`seed size: ${before.bytes} (${before.rel}) -> ${afterBytes} bytes`);
console.log(`changed seed lines: ${changedLines}`);
console.log(
  "✓ every changed seed line is a homework row or one of the two FEN lessons",
);
