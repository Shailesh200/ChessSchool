import { describe, expect, it } from "vitest";
import { shuffleQuizOptions } from "./shuffleQuizOptions";

describe("shuffleQuizOptions", () => {
  it("maps correct index after shuffle", () => {
    const raw = [
      { label: "right", emoji: "✓" },
      { label: "wrong-a", emoji: "✗" },
      { label: "wrong-b", emoji: "✗" },
      { label: "wrong-c", emoji: "✗" },
    ];
    for (let n = 0; n < 40; n++) {
      const { options, correctIdx } = shuffleQuizOptions(raw, 0);
      expect(options[correctIdx]?.label).toBe("right");
      expect(options).toHaveLength(4);
    }
  });

  it("eventually places correct answer off index 0", () => {
    const raw = [
      { label: "right", emoji: "✓" },
      { label: "wrong", emoji: "✗" },
      { label: "wrong2", emoji: "✗" },
      { label: "wrong3", emoji: "✗" },
    ];
    const seen = new Set<number>();
    for (let n = 0; n < 30; n++) {
      seen.add(shuffleQuizOptions(raw, 0).correctIdx);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
