import { describe, expect, it } from "vitest";
import { shouldShowTutorialSaveRetry } from "./lessonTutorialSave";

describe("shouldShowTutorialSaveRetry (DP-M-009)", () => {
  it("requires save-retry phase and a non-empty error", () => {
    expect(shouldShowTutorialSaveRetry("save-retry", "offline")).toBe(true);
    expect(shouldShowTutorialSaveRetry("playing", "offline")).toBe(false);
    expect(shouldShowTutorialSaveRetry("save-retry", null)).toBe(false);
  });
});
