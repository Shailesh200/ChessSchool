import {
  PRESCHOOL_TOPICS,
  preschoolTopicForLesson,
  topicIndex,
} from "../data/preschool-spine.mjs";
import { emptyReport, finalizeReport } from "./report.mjs";
import { validateLessonSteps, validatePreschoolSpine } from "./validate.mjs";

/**
 * Validate a full curriculum snapshot (lessons + class/semester refs).
 * @param {Object} input
 * @param {Array<{ id: string, classId: string, tag: string, prerequisites: string, steps: string }>} input.lessons
 * @param {Array<{ id: string, semesterId: string }>} [input.classes]
 * @param {Array<{ id: string }>} [input.semesters]
 * @param {{ command?: string, source?: string, failOnWarn?: boolean }} [opts]
 */
export function validateCurriculum(input, opts = {}) {
  const started = Date.now();
  const report = emptyReport(opts.command ?? "validate", opts.source ?? "curriculum");
  const lessons = input.lessons ?? [];
  const classIds = new Set((input.classes ?? []).map((c) => c.id));
  const semesterIds = new Set((input.semesters ?? []).map((s) => s.id));

  report.summary.scanned = lessons.length;

  const lessonIndex = new Map();
  for (const row of lessons) {
    let prerequisites = [];
    try {
      prerequisites = JSON.parse(row.prerequisites || "[]");
    } catch {
      report.byOutcome.rejected.push({
        id: row.id,
        reason: "bad_prerequisites",
        detail: "invalid JSON",
      });
      report.summary.rejected++;
      continue;
    }
    lessonIndex.set(row.id, { id: row.id, tag: row.tag, prerequisites });
  }

  for (const row of lessons) {
    const meta = lessonIndex.get(row.id);
    if (!meta) continue;

    if (row.classId && classIds.size > 0 && !classIds.has(row.classId)) {
      report.byOutcome.rejected.push({
        id: row.id,
        reason: "orphan_class",
        detail: row.classId,
      });
      report.summary.rejected++;
      continue;
    }

    let steps;
    try {
      steps = JSON.parse(row.steps || "[]");
    } catch {
      report.byOutcome.rejected.push({
        id: row.id,
        reason: "bad_steps_json",
        detail: "invalid JSON",
      });
      report.summary.rejected++;
      continue;
    }

    const { errors, warnings } = validateLessonSteps(row.id, steps);
    for (const e of errors) {
      report.byOutcome.rejected.push({
        id: row.id,
        reason: e.reason,
        detail: `${e.stepId}: ${e.detail}`,
      });
      report.summary.rejected++;
    }
    for (const w of warnings) {
      report.byOutcome.warnings.push({
        id: row.id,
        code: w.code,
        detail: `${w.stepId}: ${w.detail}`,
      });
      report.summary.warnings++;
    }

    const spine = validatePreschoolSpine(
      lessonIndex,
      meta,
      preschoolTopicForLesson,
      topicIndex,
    );
    for (const e of spine.errors) {
      report.byOutcome.rejected.push({ id: row.id, reason: e.reason, detail: e.detail });
      report.summary.rejected++;
    }
    for (const w of spine.warnings) {
      report.byOutcome.warnings.push({ id: row.id, code: w.code, detail: w.detail });
      report.summary.warnings++;
    }

    if (
      errors.length === 0 &&
      spine.errors.length === 0 &&
      !report.byOutcome.rejected.some((r) => r.id === row.id)
    ) {
      report.byOutcome.success.push(row.id);
      report.summary.inserted++;
    }
  }

  if (semesterIds.size > 0) {
    for (const c of input.classes ?? []) {
      if (!semesterIds.has(c.semesterId)) {
        report.byOutcome.rejected.push({
          id: c.id,
          reason: "orphan_semester",
          detail: c.semesterId,
        });
        report.summary.rejected++;
      }
    }
  }

  report.durationMs = Date.now() - started;
  return finalizeReport(report, { failOnReject: true, failOnWarn: opts.failOnWarn ?? false });
}

export { PRESCHOOL_TOPICS, preschoolTopicForLesson, topicIndex };
export { emptyReport, printReportSummary, finalizeReport } from "./report.mjs";
export { validateLessonSteps, validatePreschoolSpine } from "./validate.mjs";
