#!/usr/bin/env node
/**
 * Validate hand-authored lesson content in content/data/lessons.mjs (incl. preschool extra).
 * Skips exam rows — those are owned by a separate reviewer.
 *
 *   pnpm lessons:validate
 */
import { LESSONS } from "../content/data/lessons.mjs";
import { SEMESTERS } from "../content/data/school.mjs";
import { validateLessonSteps } from "@chess-school/puzzle-school";
import { Chess } from "chess.js";
import { fileURLToPath } from "node:url";

/** @typedef {{ lessonId: string, stepId: string, code: string, detail: string }} ContentIssue */

/** a1 is a dark square in standard orientation. */
export function squareColor(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number.parseInt(sq[1], 10) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

/**
 * Coach lines like "bishop on c1 stays on light squares" must match the square colour.
 * @param {string} lessonId
 * @param {string} stepId
 * @param {string} coach
 * @returns {ContentIssue[]}
 */
export function checkBishopSquareColourCoach(lessonId, stepId, coach) {
  const issues = [];
  const re =
    /bishop on ([a-h][1-8]) stays on (light|dark) squares/gi;
  for (const match of coach.matchAll(re)) {
    const sq = match[1].toLowerCase();
    const claimed = match[2].toLowerCase();
    const actual = squareColor(sq);
    if (actual && claimed !== actual) {
      issues.push({
        lessonId,
        stepId,
        code: "bishop_square_colour",
        detail: `${sq} is ${actual}-squared; coach claims ${claimed}`,
      });
    }
  }
  return issues;
}

function isExamLesson(lesson) {
  return Boolean(lesson.exam) || lesson.id.startsWith("exam-") || lesson.tag === "exam";
}

/**
 * @returns {{ scanned: number, errors: ContentIssue[], warnings: ContentIssue[] }}
 */
export function validateAuthoredLessons() {
  /** @type {ContentIssue[]} */
  const errors = [];
  /** @type {ContentIssue[]} */
  const warnings = [];

  const byId = new Map(LESSONS.map((l) => [l.id, l]));
  const inSchool = new Set();
  for (const sem of SEMESTERS) {
    for (const cls of sem.classes ?? []) {
      for (const lid of cls.lessonIds ?? []) inSchool.add(lid);
      if (cls.examId) inSchool.add(cls.examId);
    }
  }

  for (const lid of inSchool) {
    if (!byId.has(lid)) {
      errors.push({
        lessonId: lid,
        stepId: "-",
        code: "school_missing_lesson",
        detail: "lesson id listed in school.mjs but not in lessons.mjs",
      });
    }
  }

  let scanned = 0;
  for (const lesson of LESSONS) {
    if (isExamLesson(lesson)) continue;
    scanned++;

    for (const pre of lesson.prerequisites ?? []) {
      if (!byId.has(pre)) {
        errors.push({
          lessonId: lesson.id,
          stepId: "-",
          code: "missing_prerequisite",
          detail: pre,
        });
      }
    }

    if (!inSchool.has(lesson.id)) {
      warnings.push({
        lessonId: lesson.id,
        stepId: "-",
        code: "orphan_lesson",
        detail: "not referenced in school.mjs class lessonIds",
      });
    }

    const steps = lesson.steps ?? [];
    const { errors: stepErrors, warnings: stepWarn } = validateLessonSteps(lesson.id, steps);
    for (const e of stepErrors) {
      errors.push({
        lessonId: lesson.id,
        stepId: e.stepId,
        code: e.reason,
        detail: e.detail,
      });
    }
    for (const w of stepWarn) {
      warnings.push({
        lessonId: lesson.id,
        stepId: w.stepId,
        code: w.code,
        detail: w.detail,
      });
    }

    for (const step of steps) {
      if (typeof step.coach === "string" && step.coach.trim()) {
        errors.push(...checkBishopSquareColourCoach(lesson.id, step.id ?? "?", step.coach));
      }
      if (step.fen && step.kind === "move") {
        try {
          const g = new Chess(step.fen);
          if (g.isCheckmate() || g.isStalemate()) {
            errors.push({
              lessonId: lesson.id,
              stepId: step.id ?? "?",
              code: "terminal_fen",
              detail: "move step starts from checkmate or stalemate",
            });
          }
        } catch {
          /* invalid fen caught by validateLessonSteps */
        }
      }
    }
  }

  return { scanned, errors, warnings };
}

function main() {
  const { scanned, errors, warnings } = validateAuthoredLessons();
  console.log(`Authored lessons scanned (exams skipped): ${scanned}`);
  console.log(`Errors: ${errors.length}  Warnings: ${warnings.length}`);
  for (const e of errors) {
    console.log(`  ✗ ${e.lessonId}/${e.stepId} [${e.code}] ${e.detail}`);
  }
  if (warnings.length && process.argv.includes("--verbose")) {
    for (const w of warnings) {
      console.log(`  ⚠ ${w.lessonId}/${w.stepId} [${w.code}] ${w.detail}`);
    }
  }
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
