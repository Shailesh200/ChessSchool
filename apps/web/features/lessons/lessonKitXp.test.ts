import { describe, expect, it } from "vitest";
import { kitXpPopLottieId, formatLessonDurationMs } from "./lessonKitXp";

describe("lessonKitXp", () => {
  it("picks xp-pop-50 for large lesson XP totals", () => {
    expect(kitXpPopLottieId(50)).toBe("xp-pop-50");
    expect(kitXpPopLottieId(49)).toBe("xp-pop-20");
    expect(kitXpPopLottieId(19)).toBe("xp-pop");
  });

  it("formats duration as m:ss", () => {
    expect(formatLessonDurationMs(222_000)).toBe("3:42");
  });
});
