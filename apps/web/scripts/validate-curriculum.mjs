#!/usr/bin/env node
/**
 * Scan local.db (or Turso with DATABASE_URL) and validate all curriculum lessons.
 * Writes apps/web/curriculum-import-report.json
 *
 *   pnpm curriculum:validate
 *   pnpm curriculum:validate -- --fail-on-warn
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm curriculum:validate -- --remote
 */
import { writeFileSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import { validateCurriculum, printReportSummary } from "@chess-school/puzzle-school";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const failOnWarn = args.includes("--fail-on-warn");
const reportPath = "curriculum-import-report.json";

async function loadFromTurso() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("libsql:")) {
    console.error("Set DATABASE_URL=libsql://… and DATABASE_AUTH_TOKEN for --remote");
    process.exit(2);
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const [lessons, classes, semesters] = await Promise.all([
    client.execute(
      "SELECT id, class_id AS classId, tag, prerequisites, steps FROM lessons",
    ),
    client.execute("SELECT id, semester_id AS semesterId FROM classes"),
    client.execute("SELECT id FROM semesters"),
  ]);
  return {
    lessons: lessons.rows.map((r) => ({
      id: r.id,
      classId: r.classId,
      tag: r.tag,
      prerequisites: r.prerequisites,
      steps: r.steps,
    })),
    classes: classes.rows.map((r) => ({ id: r.id, semesterId: r.semesterId })),
    semesters: semesters.rows.map((r) => ({ id: r.id })),
  };
}

function loadFromSqlite() {
  if (!existsSync("local.db")) {
    console.error("✗ local.db not found. Run pnpm db:fresh first.");
    process.exit(2);
  }
  const db = new Database("local.db", { readonly: true });
  const lessons = db
    .prepare("SELECT id, class_id AS classId, tag, prerequisites, steps FROM lessons")
    .all();
  const classes = db.prepare("SELECT id, semester_id AS semesterId FROM classes").all();
  const semesters = db.prepare("SELECT id FROM semesters").all();
  return { lessons, classes, semesters };
}

const source = remote ? process.env.DATABASE_URL : "local.db";
const data = remote ? await loadFromTurso() : loadFromSqlite();

const report = validateCurriculum(data, {
  command: "validate",
  source,
  failOnWarn,
});

printReportSummary(report);
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`  Report:     ${reportPath}\n`);

process.exit(report.exitCode);
