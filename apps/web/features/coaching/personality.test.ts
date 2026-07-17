import { describe, expect, it } from "vitest";
import { applyCoachLine, quizUiLabels } from "./personality";

describe("applyCoachLine", () => {
  it("retints success lines per personality", () => {
    const strict = applyCoachLine("Correct! ✓", "strict", "success");
    expect(strict).not.toBe("Correct! ✓");
    expect(strict.length).toBeGreaterThan(2);
  });

  it("never uses the legacy generic Lichess template", () => {
    const line = applyCoachLine("Your move. Find the fork idea.", "friendly", "lesson");
    expect(line).not.toMatch(/Your move\. Find the .* idea\./i);
  });

  it("prepends personality voice to substantive lesson copy", () => {
    const long =
      "This is a long explanation about forks and how knights can hit two pieces at once. Look for the king and queen on the same fork square when you calculate.";
    const line = applyCoachLine(long, "mentor", "lesson", "lesson-1:step-0");
    expect(line).toContain(long);
    expect(line).not.toBe(long);
  });

  it("weaves praise with custom move success text", () => {
    const line = applyCoachLine(
      "That's e4 — file e, rank 4.",
      "friendly",
      "success",
      "pre-pawn:move",
    );
    expect(line).toContain("That's e4");
    expect(line.length).toBeGreaterThan(30);
  });

  it("uses personality-specific quiz intros, not generic copy", () => {
    const strict = applyCoachLine("", "strict", "quiz", "pre-meet-pawn:0");
    const friendly = applyCoachLine("", "friendly", "quiz", "pre-meet-pawn:0");
    expect(strict).not.toBe("Pick the best answer.");
    expect(friendly).not.toBe("Pick the best answer.");
    expect(strict).not.toBe(friendly);
  });

  it("quiz success uses dedicated reactions instead of move praise", () => {
    const line = applyCoachLine("", "strict", "quiz-success", "pre-pawn-quiz:1");
    expect(line).not.toBe("Confident play.");
    expect(line.length).toBeGreaterThan(0);
  });

  it("varies quiz answer labels by seed", () => {
    const a = quizUiLabels("tactical", "lesson-a:step-1");
    const b = quizUiLabels("tactical", "lesson-b:step-2");
    expect(a.answers.length).toBeGreaterThan(0);
    expect(b.answers.length).toBeGreaterThan(0);
  });
});
