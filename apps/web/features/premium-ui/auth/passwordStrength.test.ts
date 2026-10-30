import { describe, expect, it } from "vitest";
import { analyzePasswordStrength, passwordsMatch } from "./passwordStrength";

describe("analyzePasswordStrength", () => {
  it("marks design strong password at level 4", () => {
    const s = analyzePasswordStrength("Knight-fork-42", "sam@example.com");
    expect(s.level).toBe(4);
    expect(s.label).toContain("Strong");
    expect(s.rules.minLength).toBe(true);
    expect(s.rules.symbol).toBe(true);
  });

  it("flags short passwords like the error screen mock", () => {
    const s = analyzePasswordStrength("knight1");
    expect(s.level).toBe(1);
    expect(s.rules.minLength).toBe(false);
  });
});

describe("passwordsMatch", () => {
  it("detects confirm mismatch", () => {
    expect(passwordsMatch("knight1", "knight2")).toBe(false);
    expect(passwordsMatch("knight-fork-42", "knight-fork-42")).toBe(true);
  });
});
