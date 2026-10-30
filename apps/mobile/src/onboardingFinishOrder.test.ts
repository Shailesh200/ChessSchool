import { describe, expect, it } from "vitest";
import { onboardingSettingsPatch } from "./onboardingFinishOrder";

describe("onboardingFinishOrder (DP-M-010)", () => {
  it("builds the settings patch applied only after server save", () => {
    expect(
      onboardingSettingsPatch("beat-friends", "900", "standard", "genz", "blue", "ava-knight"),
    ).toEqual({
      goal: "beat-friends",
      targetElo: 900,
      planTier: "standard",
      coachCharacter: "genz",
      appTheme: "blue",
      avatar: "ava-knight",
    });
  });
});
