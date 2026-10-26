/**
 * Short coaching tips keyed by a lesson or step tag.
 * Shared by the web and mobile lesson players.
 */
export const LESSON_TIPS: Record<string, string> = {
  capture: "Scan for enemy pieces that aren't defended — you can win them for free.",
  check: "A check forces a reply. Look for the most forcing move first.",
  checkmate: "Checkmate = the king is attacked with no legal escape square.",
  mate: "Checkmate = the king is attacked with no legal escape square.",
  fork: "A knight fork hits two pieces at once — aim at the king and a big piece.",
  promotion: "Reach the last rank to promote — usually a queen, but a knight can fork!",
  opening: "In the opening: develop your pieces, control the centre, and castle early.",
};

/** Shown when neither the step nor the lesson tag has a coaching tip. */
export const GENERIC_LESSON_TIP = "Take your time and calculate before you move.";

export type LessonHintInput = {
  /**
   * Author-written tip on the step. Mobile lessons may set this.
   * Web lesson steps have no hint field, so the web player omits it.
   */
  stepHint?: string | null;
  /** Step weakness tag. Preferred over the lesson tag. */
  stepTag?: string | null;
  /** Lesson theme tag. Used when the step has no tip of its own. */
  lessonTag?: string | null;
};

/** Blank and whitespace-only text is not a hint or a tag. */
function nonBlank(value: string | null | undefined): string | undefined {
  if (value == null || value.trim() === "") return undefined;
  return value;
}

/** Own keys only — `constructor` and `toString` are not lesson tips. */
function tipForTag(tag: string | null | undefined): string | undefined {
  const key = nonBlank(tag);
  if (key == null || !Object.hasOwn(LESSON_TIPS, key)) return undefined;
  return LESSON_TIPS[key];
}

/**
 * Tip shown under the lesson board.
 *
 * Order matches the web lesson player: a step-specific hint, then the step
 * tag, then the lesson tag, then the generic line. Web omits `stepHint`.
 */
export function pickLessonHint({
  stepHint,
  stepTag,
  lessonTag,
}: LessonHintInput): string {
  return (
    nonBlank(stepHint) ??
    tipForTag(stepTag) ??
    tipForTag(lessonTag) ??
    GENERIC_LESSON_TIP
  );
}
