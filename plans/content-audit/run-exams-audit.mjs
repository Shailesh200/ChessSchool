#!/usr/bin/env node
/**
 * Audit hand-authored quizzes + class exam pools. Writes plans/content-audit/exams-audit.csv
 * Run from repo root: node plans/content-audit/run-exams-audit.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LESSONS } from "../../apps/web/content/data/lessons.mjs";
import { validateQuizStep } from "../../packages/puzzle-school/src/quiz-validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "plans/content-audit");
mkdirSync(outDir, { recursive: true });

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rows = [];
const header = [
  "scope",
  "lesson_id",
  "step_id",
  "kind",
  "problem",
  "action",
  "reason",
  "status",
];
rows.push(header.map(csvEscape).join(","));

let quizTotal = 0;
let quizErrors = 0;

for (const lesson of LESSONS) {
  for (const step of lesson.steps) {
    if (step.kind !== "quiz") continue;
    quizTotal++;
    const errs = validateQuizStep(step.id, step);
    if (errs.length) {
      quizErrors++;
      for (const e of errs) {
        rows.push(
          [
            "quiz",
            lesson.id,
            step.id,
            "quiz",
            e.reason,
            "fix",
            e.detail,
            "open",
          ].map(csvEscape).join(","),
        );
      }
    } else {
      rows.push(
        ["quiz", lesson.id, step.id, "quiz", "", "verified", "manual+validator", "ok"]
          .map(csvEscape)
          .join(","),
      );
    }
  }
}

if (existsSync(join(root, "apps/web/local.db"))) {
  const { createRequire } = await import("node:module");
  const require = createRequire(join(root, "apps/web/package.json"));
  const Database = require("better-sqlite3");
  const db = new Database(join(root, "apps/web/local.db"), { readonly: true });
  const classes = db
    .prepare(
      `SELECT c.id, COUNT(l.id) AS n FROM classes c
       LEFT JOIN lessons l ON l.class_id = c.id AND l.is_exam = 0
       GROUP BY c.id`,
    )
    .all();
  for (const c of classes) {
    const teaching = db
      .prepare(
        "SELECT steps FROM lessons WHERE class_id = ? AND is_exam = 0 ORDER BY sort_order",
      )
      .all(c.id);
    let moves = 0;
    let quizzes = 0;
    for (const row of teaching) {
      try {
        for (const s of JSON.parse(row.steps)) {
          if (s.kind === "move" && s.solution?.length === 1) moves++;
          if (s.kind === "quiz") quizzes++;
        }
      } catch {
        /* skip */
      }
    }
    const pool = moves || quizzes;
    const ok = pool >= 2;
    rows.push(
      [
        "class_exam_db",
        c.id,
        "exam-pool",
        moves ? "move" : "quiz",
        ok ? "" : "insufficient_exam_pool",
        ok ? "verified" : "review",
        `single_moves=${moves};quizzes=${quizzes}`,
        ok ? "ok" : "warn",
      ].map(csvEscape).join(","),
    );
  }
}

writeFileSync(join(outDir, "exams-audit.csv"), rows.join("\n") + "\n");
console.log(
  `Wrote ${rows.length - 1} audit rows (${quizTotal} quizzes, ${quizErrors} validator errors)`,
);
