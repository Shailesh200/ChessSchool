import { Chess } from "chess.js";

const PROMOTION_PIECES = new Set(["q", "r", "b", "n"]);

/** @typedef {{ id: string, kind: string, fen?: string, solution?: string[], moves?: string[], promotion?: string, promotions?: Record<string, string>, coach?: string, question?: string, options?: unknown[], correct?: number }} LessonStep */

/**
 * Piece required for a `from:to` key. The per-key map wins over the scalar.
 * @param {LessonStep} step
 * @param {string} key
 */
function declaredPromotion(step, key) {
  const mapped = step.promotions?.[key];
  if (mapped) return mapped;
  return step.promotion;
}

/**
 * @param {LessonStep} step
 * @param {string} sid
 */
function promotionFieldErrors(step, sid) {
  const errors = [];
  if (step.promotion && !PROMOTION_PIECES.has(step.promotion)) {
    errors.push({
      stepId: sid,
      reason: "bad_promotion",
      detail: `promotion ${step.promotion} must be q, r, b, or n`,
    });
  }
  if (step.promotions && (typeof step.promotions !== "object" || Array.isArray(step.promotions))) {
    errors.push({
      stepId: sid,
      reason: "bad_promotion",
      detail: "promotions must be an object keyed by from:to",
    });
    return errors;
  }
  for (const [key, piece] of Object.entries(step.promotions ?? {})) {
    if (!PROMOTION_PIECES.has(piece)) {
      errors.push({
        stepId: sid,
        reason: "bad_promotion",
        detail: `${key} promotion ${piece} must be q, r, b, or n`,
      });
    } else if (step.promotion && piece !== step.promotion) {
      errors.push({
        stepId: sid,
        reason: "mixed_promotion",
        detail: `${key} is ${piece} but promotion is ${step.promotion}; omit promotion and use promotions when pieces differ`,
      });
    }
  }
  return errors;
}

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
      errors.push(...promotionFieldErrors(step, sid));
      for (const sol of step.solution ?? []) {
        const [from, to] = sol.split(":");
        if (!from || !to) {
          errors.push({ stepId: sid, reason: "bad_solution", detail: sol });
          continue;
        }
        const trial = new Chess(g.fen());
        const matched = trial.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
        if (matched.length === 0) {
          errors.push({ stepId: sid, reason: "illegal_move", detail: `${lessonId}/${sid} ${sol}` });
          continue;
        }
        const promotes = matched.some((m) => m.promotion);
        const piece = declaredPromotion(step, sol);
        if (promotes) {
          if (!piece) {
            errors.push({
              stepId: sid,
              reason: "missing_promotion",
              detail: `${lessonId}/${sid} ${sol} promotes but has no piece`,
            });
            continue;
          }
          if (!PROMOTION_PIECES.has(piece)) continue;
          try {
            const m = trial.move({ from, to, promotion: piece });
            if (!m) {
              errors.push({
                stepId: sid,
                reason: "illegal_move",
                detail: `${lessonId}/${sid} ${sol}=${piece}`,
              });
            }
          } catch {
            errors.push({
              stepId: sid,
              reason: "illegal_move",
              detail: `${lessonId}/${sid} ${sol}=${piece}`,
            });
          }
        } else {
          if (piece) {
            errors.push({
              stepId: sid,
              reason: "unexpected_promotion",
              detail: `${lessonId}/${sid} ${sol} does not promote`,
            });
          }
          try {
            const m = trial.move({ from, to });
            if (!m) errors.push({ stepId: sid, reason: "illegal_move", detail: `${lessonId}/${sid} ${sol}` });
          } catch {
            errors.push({ stepId: sid, reason: "illegal_move", detail: `${lessonId}/${sid} ${sol}` });
          }
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
      errors.push(...promotionFieldErrors(step, sid));
      for (const mv of step.moves ?? []) {
        const [from, to] = mv.split(":");
        const key = `${from ?? ""}:${to ?? ""}`;
        const matched = g.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
        const promotes = matched.some((m) => m.promotion);
        const piece = declaredPromotion(step, key);
        let playPiece;
        if (promotes && !piece) {
          errors.push({
            stepId: sid,
            reason: "missing_promotion",
            detail: `${lessonId}/${sid} ${mv} promotes but has no piece`,
          });
          playPiece = "q";
        } else if (promotes && !PROMOTION_PIECES.has(piece)) {
          errors.push({ stepId: sid, reason: "bad_promotion", detail: `${lessonId}/${sid} ${mv}` });
          playPiece = "q";
        } else if (!promotes && piece) {
          errors.push({
            stepId: sid,
            reason: "unexpected_promotion",
            detail: `${lessonId}/${sid} ${mv} does not promote`,
          });
        } else if (promotes) {
          playPiece = piece;
        }
        try {
          const m = g.move(
            playPiece
              ? { from: from ?? "", to: to ?? "", promotion: playPiece }
              : { from: from ?? "", to: to ?? "" },
          );
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
 * Promotion check for a bank puzzle after `compilePuzzleSteps`.
 *
 * The compiler already replays the UCI line and rejects an illegal move or an
 * illegal promotion piece. Comparing the student ply to `step.promotion` keeps
 * that check without building another Chess position per step.
 *
 * @param {{ line?: string[] }} puzzle
 * @param {LessonStep[]} steps
 * @returns {{ stepId: string, reason: string, detail: string }[]}
 */
export function compiledPromotionErrors(puzzle, steps) {
  const errors = [];
  const moves = (puzzle.line ?? []).map((m) => String(m).replace(/:/g, ""));
  let si = 0;
  for (let i = 1; i < moves.length; i += 2) {
    const uci = moves[i] ?? "";
    const step = steps[si++];
    const sid = step?.id ?? "?";
    if (!step) {
      errors.push({
        stepId: sid,
        reason: "missing_promotion",
        detail: `no compiled step for ${uci}`,
      });
      continue;
    }
    const piece = uci.length > 4 ? uci[4] : "";
    if (piece) {
      if (!PROMOTION_PIECES.has(piece) || step.promotion !== piece) {
        errors.push({
          stepId: sid,
          reason: "missing_promotion",
          detail: `${uci} promotes to ${piece} but step.promotion is ${step.promotion ?? "missing"}`,
        });
      }
    } else if (step.promotion || (step.promotions && Object.keys(step.promotions).length > 0)) {
      errors.push({
        stepId: sid,
        reason: "unexpected_promotion",
        detail: `${uci} does not promote`,
      });
    }
  }
  return errors;
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
