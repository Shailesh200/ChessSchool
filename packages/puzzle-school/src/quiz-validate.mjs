/** @typedef {{ label?: string, emoji?: string }} QuizOption */
/** @typedef {{ id?: string, kind: string, question?: string, options?: QuizOption[], correct?: number, explain?: string, failText?: string }} QuizStep */

/**
 * Normalize option text for duplicate detection (case-insensitive, trimmed).
 * @param {string} label
 */
export function normalizeQuizLabel(label) {
  return (label ?? "").trim().toLowerCase();
}

/**
 * Structural + content hygiene checks for a quiz step.
 * Does not verify chess truth — curated copy is reviewed separately.
 *
 * @param {string} stepId
 * @param {QuizStep} step
 * @returns {{ reason: string, detail: string }[]}
 */
export function validateQuizStep(stepId, step) {
  const errors = [];
  if (!step.question?.trim()) {
    errors.push({ reason: "quiz_no_question", detail: stepId });
  }
  const opts = step.options ?? [];
  if (opts.length < 2) {
    errors.push({ reason: "quiz_options", detail: "need ≥2 options" });
  }
  const c = step.correct ?? -1;
  if (c < 0 || c >= opts.length) {
    errors.push({ reason: "quiz_correct", detail: `correct=${c} options=${opts.length}` });
  }
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]?.label?.trim()) {
      errors.push({ reason: "quiz_empty_option", detail: `index ${i}` });
    }
  }
  const seen = new Map();
  for (let i = 0; i < opts.length; i++) {
    const key = normalizeQuizLabel(opts[i]?.label ?? "");
    if (!key) continue;
    if (seen.has(key)) {
      errors.push({
        reason: "quiz_duplicate_option",
        detail: `"${opts[i]?.label}" matches option ${seen.get(key)}`,
      });
    } else {
      seen.set(key, i);
    }
  }
  if (!(step.explain ?? "").trim()) {
    errors.push({ reason: "quiz_no_explain", detail: stepId });
  }
  if (!(step.failText ?? "").trim()) {
    errors.push({ reason: "quiz_no_fail_text", detail: stepId });
  }
  return errors;
}
