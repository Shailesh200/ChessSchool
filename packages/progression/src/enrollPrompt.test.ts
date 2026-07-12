import { describe, expect, it } from "vitest";
import {
  ENROLL_PROMPT_DISMISS_MS,
  lessonsAttemptedCount,
  shouldAutoOpenEnrollPrompt,
  shouldShowEnrollPrompt,
} from "./enrollPrompt";

describe("enrollPrompt", () => {
  it("counts lessons with at least one attempt", () => {
    expect(
      lessonsAttemptedCount({
        a: { attempts: 1, mastery: 1, lastSeen: 0, dueAt: 0 },
        b: { attempts: 0, mastery: 0, lastSeen: 0, dueAt: 0 },
      }),
    ).toBe(1);
  });

  it("shows for guests after first lesson unless dismissed", () => {
    const base = { authed: false as const, lessonsAttempted: 1, now: 1_000_000 };
    expect(shouldShowEnrollPrompt(base)).toBe(true);
    expect(
      shouldShowEnrollPrompt({
        ...base,
        dismissedAt: base.now - ENROLL_PROMPT_DISMISS_MS + 1,
      }),
    ).toBe(false);
    expect(shouldAutoOpenEnrollPrompt(base)).toBe(true);
    expect(shouldAutoOpenEnrollPrompt({ ...base, lessonsAttempted: 2 })).toBe(false);
  });

  it("hides for signed-in users", () => {
    expect(
      shouldShowEnrollPrompt({ authed: true, lessonsAttempted: 3, dismissedAt: null }),
    ).toBe(false);
  });
});
