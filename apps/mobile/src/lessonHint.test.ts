import { describe, expect, it } from "vitest";
import { GENERIC_LESSON_TIP, LESSON_TIPS, pickLessonHint } from "@chess-school/core";

/** The web lesson player's previous inline expression. */
function webLessonTip(stepTag: string | undefined, lessonTag: string): string {
  const tips = LESSON_TIPS as Record<string, string | undefined>;
  return tips[stepTag ?? ""] ?? tips[lessonTag] ?? GENERIC_LESSON_TIP;
}

describe("pickLessonHint", () => {
  it("shows the fork hint for a fork lesson whose step has no specific hint", () => {
    // Curated "The Fork" info/observe steps have no step tag or hint.
    const hint = pickLessonHint({ lessonTag: "fork" });
    expect(hint).toBe(LESSON_TIPS.fork);
    expect(hint).toBe(
      "A knight fork hits two pieces at once — aim at the king and a big piece.",
    );
    expect(hint).not.toBe(GENERIC_LESSON_TIP);
  });

  it("falls back to the lesson tag when the step tag has no tip", () => {
    expect(pickLessonHint({ stepTag: "pin", lessonTag: "fork" })).toBe(
      LESSON_TIPS.fork,
    );
    expect(pickLessonHint({ stepHint: null, stepTag: "", lessonTag: "fork" })).toBe(
      LESSON_TIPS.fork,
    );
  });

  it("prefers a step hint, then a step tag, over the lesson tag", () => {
    expect(pickLessonHint({ stepTag: "opening", lessonTag: "fork" })).toBe(
      LESSON_TIPS.opening,
    );
    expect(
      pickLessonHint({
        stepHint: "Nc7 forks the king and the rook.",
        stepTag: "capture",
        lessonTag: "fork",
      }),
    ).toBe("Nc7 forks the king and the rook.");
  });

  it("shows the generic tip only when the web player would", () => {
    const tags = [
      undefined,
      "",
      "fork",
      "pin",
      "capture",
      "check",
      "checkmate",
      "mate",
      "promotion",
      "opening",
      "drill",
    ];
    for (const stepTag of tags) {
      for (const lessonTag of ["fork", "pin", "drill", "capture", "opening", ""]) {
        expect(pickLessonHint({ stepTag, lessonTag })).toBe(
          webLessonTip(stepTag, lessonTag),
        );
      }
    }
    expect(pickLessonHint({ stepTag: "pin", lessonTag: "skewer" })).toBe(
      GENERIC_LESSON_TIP,
    );
    expect(pickLessonHint({})).toBe(GENERIC_LESSON_TIP);
  });
});
