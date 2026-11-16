import { describe, expect, it } from "vitest";
import { codyAliases, codyAnimations, codyClip, codyPoster, streakAtRisk } from "./mascot";

describe("mascot", () => {
  it("maps old pose names onto the Chaukor clips", () => {
    expect(codyClip("happy")).toBe("correct");
    expect(codyClip("oops")).toBe("wrong");
    expect(codyClip("sad-soft")).toBe("streak-danger");
    expect(codyClip("wave")).toBe("wave");
    for (const clip of Object.values(codyAliases)) expect(codyAnimations).toContain(clip);
    for (const clip of codyAnimations) expect(codyPoster[clip]).toBeGreaterThanOrEqual(0);
  });

  it("puts the streak at risk only in the evening before today is done", () => {
    const at = (h: number) => new Date(2026, 10, 16, h);
    expect(streakAtRisk(false, 3, at(18))).toBe(true);
    expect(streakAtRisk(false, 3, at(17))).toBe(false);
    expect(streakAtRisk(true, 3, at(20))).toBe(false);
    expect(streakAtRisk(false, 0, at(20))).toBe(false);
  });
});
