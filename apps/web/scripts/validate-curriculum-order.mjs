#!/usr/bin/env node
/**
 * Validate curated curriculum order: preschool-curriculum.mjs ↔ school.mjs,
 * lesson existence, and prerequisite order on the spine.
 *
 *   pnpm curriculum:order
 */
import { SEMESTERS } from "../content/data/school.mjs";
import { LESSONS } from "../content/data/lessons.mjs";
import {
  PRESCHOOL_CLASS_IDS,
  PRESCHOOL_CLASS_LESSONS,
  PRESCHOOL_LESSON_ORDER,
} from "../content/data/preschool-curriculum.mjs";

/** @typedef {{ code: string, detail: string }} OrderIssue */

/**
 * @returns {OrderIssue[]}
 */
export function validateCurriculumOrder() {
  /** @type {OrderIssue[]} */
  const errors = [];
  const byId = new Map(LESSONS.map((l) => [l.id, l]));

  const preschoolSem = SEMESTERS.find((s) => s.id === "sem-preschool");
  if (!preschoolSem) {
    errors.push({ code: "missing_sem_preschool", detail: "sem-preschool not in school.mjs" });
    return errors;
  }

  const schoolClassIds = preschoolSem.classes.map((c) => c.id);
  if (JSON.stringify(schoolClassIds) !== JSON.stringify(PRESCHOOL_CLASS_IDS)) {
    errors.push({
      code: "preschool_class_ids",
      detail: "school.mjs preschool class ids ≠ preschool-curriculum.mjs",
    });
  }

  const schoolOrder = preschoolSem.classes.flatMap((c) => c.lessonIds ?? []);
  if (JSON.stringify(schoolOrder) !== JSON.stringify(PRESCHOOL_LESSON_ORDER)) {
    errors.push({
      code: "preschool_lesson_order",
      detail: "school.mjs preschool lesson order ≠ preschool-curriculum.mjs",
    });
  }

  for (const classId of PRESCHOOL_CLASS_IDS) {
    const cls = preschoolSem.classes.find((c) => c.id === classId);
    const expected = PRESCHOOL_CLASS_LESSONS[classId];
    if (!cls) {
      errors.push({ code: "missing_class", detail: classId });
      continue;
    }
    if (JSON.stringify(cls.lessonIds) !== JSON.stringify(expected)) {
      errors.push({
        code: "class_lesson_mismatch",
        detail: `${classId} lessonIds differ between school.mjs and preschool-curriculum.mjs`,
      });
    }
  }

  const seenInSchool = new Set();
  for (const sem of SEMESTERS) {
    for (const cls of sem.classes ?? []) {
      const path = [];
      for (const lid of cls.lessonIds ?? []) {
        if (seenInSchool.has(lid)) {
          errors.push({ code: "duplicate_lesson_in_path", detail: `${lid} listed twice in curriculum` });
        }
        seenInSchool.add(lid);
        path.push(lid);

        if (!byId.has(lid)) {
          errors.push({ code: "missing_lesson", detail: `${lid} in ${cls.id} but not in lessons.mjs` });
          continue;
        }

        const lesson = byId.get(lid);
        const idx = path.indexOf(lid);
        for (const pre of lesson.prerequisites ?? []) {
          const preIdx = path.indexOf(pre);
          if (preIdx >= 0 && preIdx >= idx) {
            errors.push({
              code: "prereq_order_in_class",
              detail: `${lid} requires ${pre} but ${pre} is not earlier in ${cls.id}`,
            });
          }
        }
      }
      if (cls.examId && !byId.has(cls.examId)) {
        errors.push({ code: "missing_exam", detail: `${cls.examId} for ${cls.id}` });
      }
    }
  }

  const flatOrder = SEMESTERS.flatMap((s) =>
    (s.classes ?? []).flatMap((c) => c.lessonIds ?? []),
  );
  const position = new Map(flatOrder.map((id, i) => [id, i]));
  for (const lid of flatOrder) {
    const lesson = byId.get(lid);
    if (!lesson) continue;
    const myPos = position.get(lid) ?? -1;
    for (const pre of lesson.prerequisites ?? []) {
      const prePos = position.get(pre);
      if (prePos === undefined) {
        if (!pre.startsWith("pre-") || !lid.startsWith("pre-")) {
          errors.push({ code: "orphan_prerequisite", detail: `${lid} → ${pre} not on curated spine` });
        }
        continue;
      }
      if (prePos >= myPos) {
        errors.push({
          code: "prereq_after_lesson",
          detail: `${lid} requires ${pre} but ${pre} is not earlier on the spine`,
        });
      }
    }
  }

  return errors;
}

function main() {
  const errors = validateCurriculumOrder();
  if (errors.length) {
    console.error(`✗ Curriculum order: ${errors.length} issue(s)`);
    for (const e of errors) console.error(`  [${e.code}] ${e.detail}`);
    process.exit(1);
  }
  console.log("✓ Curriculum order OK (preschool-curriculum.mjs ↔ school.mjs ↔ prerequisites)");
  process.exit(0);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
