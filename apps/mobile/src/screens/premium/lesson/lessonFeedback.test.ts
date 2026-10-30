import { describe, expect, it } from "vitest";
import {
  isTapSquaresStep,
  isWhyQuizStep,
  mapCoachAvatarState,
  premiumCoachMood,
} from "./lessonStepUi";

describe("premium lesson feedback states", () => {
  it("detects tap-square steps from square-only solutions", () => {
    expect(isTapSquaresStep({ solution: ["b3", "c6", "e6"] })).toBe(true);
    expect(isTapSquaresStep({ solution: ["d5:c7"] })).toBe(false);
  });

  it("detects why-quiz steps with a board fen", () => {
    expect(isWhyQuizStep({ kind: "quiz", fen: "8/8/8/8/8/8/8/8 w - - 0 1", options: [{ label: "a" }] })).toBe(true);
    expect(isWhyQuizStep({ kind: "quiz", options: [{ label: "a" }] })).toBe(false);
  });

  it("maps coach moods for correct, wrong, and hint", () => {
    expect(premiumCoachMood("correct", "move", 0)).toBe("happy");
    expect(premiumCoachMood("wrong", "move", 0)).toBe("encouraging");
    expect(premiumCoachMood("playing", "move", 2)).toBe("encouraging");
    expect(mapCoachAvatarState("happy")).toBe("success");
    expect(mapCoachAvatarState("encouraging")).toBe("miss");
  });
});
