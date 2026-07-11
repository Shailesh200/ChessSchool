import { Chess } from "chess.js";

/** @typedef {{ id: string, kind: string, fen?: string, solution?: string[], moves?: string[], coach?: string, question?: string, options?: unknown[], correct?: number }} LessonStep */

/**
 * @param {string} lessonId
 * @param {LessonStep[]} steps
 * @returns {{ errors: { stepId: string, reason: string, detail: string }[], warnings: { stepId: string, code: string, detail: string }[] }}
 */
export function validateLessonSteps(lessonId, steps) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push({ stepId: "-", reason: "empty_lesson", detail: `${lessonId} has no steps` });
    return { errors, warnings };
  }

  for (const step of steps) {
    const sid = step.id ?? "?";
    if (step.kind === "move") {
      if (!step.fen) {
        errors.push({ stepId: sid, reason: "missing_fen", detail: "move step needs fen" });
        continue;
      }
      let g;
      try {
        g = new Chess(step.fen);
      } catch {
        errors.push({ stepId: sid, reason: "invalid_fen", detail: step.fen });
        continue;
      }
      for (const sol of step.solution ?? []) {
        const [from, to] = sol.split(":");
        if (!from || !to) {
          errors.push({ stepId: sid, reason: "bad_solution", detail: sol });
          continue;
        }
        try {
          const m = g.move({ from, to, promotion: "q" });
          if (!m) errors.push({ stepId: sid, reason: "illegal_move", detail: `${lessonId}/${sid} ${sol}` });
        } catch {
          errors.push({ stepId: sid, reason: "illegal_move", detail: `${lessonId}/${sid} ${sol}` });
        }
      }
      if ((step.coach ?? "").trim().length < 8) {
        warnings.push({ stepId: sid, code: "coach_short", detail: "move step coach is very short" });
      }
      if (/Your move\. Find the .* idea\./i.test(step.coach ?? "")) {
        warnings.push({ stepId: sid, code: "generic_coach", detail: "Lichess-style generic coach" });
      }
    } else if (step.kind === "observe") {
      if (!step.fen) {
        errors.push({ stepId: sid, reason: "missing_fen", detail: "observe step needs fen" });
        continue;
      }
      let g;
      try {
        g = new Chess(step.fen);
      } catch {
        errors.push({ stepId: sid, reason: "invalid_fen", detail: step.fen });
        continue;
      }
      for (const mv of step.moves ?? []) {
        const [from, to] = mv.split(":");
        try {
          const m = g.move({ from: from ?? "", to: to ?? "", promotion: "q" });
          if (!m) errors.push({ stepId: sid, reason: "illegal_observe", detail: `${lessonId}/${sid} ${mv}` });
        } catch {
          errors.push({ stepId: sid, reason: "illegal_observe", detail: `${lessonId}/${sid} ${mv}` });
        }
      }
    } else if (step.kind === "quiz") {
      if (!step.question?.trim()) {
        errors.push({ stepId: sid, reason: "quiz_no_question", detail: lessonId });
      }
      const opts = step.options ?? [];
      if (opts.length < 2) {
        errors.push({ stepId: sid, reason: "quiz_options", detail: "need ≥2 options" });
      }
      const c = step.correct ?? -1;
      if (c < 0 || c >= opts.length) {
        errors.push({ stepId: sid, reason: "quiz_correct", detail: `correct=${c} options=${opts.length}` });
      }
    } else if (step.kind === "info") {
      if (!(step.coach ?? "").trim()) {
        warnings.push({ stepId: sid, code: "empty_coach", detail: "info step has no coach text" });
      }
    }
  }
  return { errors, warnings };
}

/**
 * @param {Map<string, { id: string, tag: string, prerequisites: string[] }>} lessonIndex
 * @param {{ id: string, tag: string, prerequisites: string[] }} lesson
 * @param {(id: string, tag: string) => string|null|undefined} topicFor
 * @param {(topic: string) => number} topicIndex
 */
export function validatePreschoolSpine(lessonIndex, lesson, topicFor, topicIndex) {
  const errors = [];
  const warnings = [];
  const topic = topicFor(lesson.id, lesson.tag);
  if (topic === undefined) return { errors, warnings };
  if (topic === null) {
    warnings.push({
      stepId: "-",
      code: "unknown_preschool_topic",
      detail: `map ${lesson.id} in preschool-spine`,
    });
    return { errors, warnings };
  }
  const myIdx = topicIndex(topic);
  for (const pre of lesson.prerequisites ?? []) {
    const preLesson = lessonIndex.get(pre);
    if (!preLesson) {
      errors.push({ stepId: "-", reason: "missing_prerequisite", detail: `${lesson.id} → ${pre}` });
      continue;
    }
    const preTopic = topicFor(preLesson.id, preLesson.tag);
    if (preTopic === undefined || preTopic === null) continue;
    const preIdx = topicIndex(preTopic);
    if (preIdx > myIdx) {
      errors.push({
        stepId: "-",
        reason: "spine_violation",
        detail: `${lesson.id} (${topic}) requires ${pre} (${preTopic}) — topic regresses`,
      });
    }
  }
  if (/checkmate|stalemate|castling/i.test(lesson.id) && myIdx < topicIndex("move-king")) {
    warnings.push({
      stepId: "-",
      code: "spine_order_class",
      detail: `${lesson.id} may appear before piece moves are complete`,
    });
  }
  return { errors, warnings };
}
