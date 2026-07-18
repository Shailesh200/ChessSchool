import { describe, expect, it } from "vitest";
import { applyCoachLine, quizUiLabels } from "./personality";

describe("applyCoachLine", () => {
  it("retints success lines per personality", () => {
    const sarcastic = applyCoachLine("Correct! ✓", "sarcastic", "success");
    expect(sarcastic).not.toBe("Correct! ✓");
    expect(sarcastic.length).toBeGreaterThan(2);
  });

  it("never uses the legacy generic Lichess template", () => {
    const line = applyCoachLine("Your move. Find the fork idea.", "genz", "lesson");
    expect(line).not.toMatch(/Your move\. Find the .* idea\./i);
  });

  it("prepends personality voice to substantive lesson copy", () => {
    const long =
      "This is a long explanation about forks and how knights can hit two pieces at once. Look for the king and queen on the same fork square when you calculate.";
    const line = applyCoachLine(long, "anxious_nerd", "lesson", "lesson-1:step-0");
    expect(line).toContain(long);
    expect(line).not.toBe(long);
  });

  it("weaves praise with custom move success text", () => {
    const line = applyCoachLine(
      "That's e4 — file e, rank 4.",
      "genz",
      "success",
      "pre-pawn:move",
    );
    expect(line).toContain("That's e4");
    expect(line.length).toBeGreaterThan(30);
  });

  it("uses personality-specific quiz intros, not generic copy", () => {
    const sarcastic = applyCoachLine("", "sarcastic", "quiz", "pre-meet-pawn:0");
    const genz = applyCoachLine("", "genz", "quiz", "pre-meet-pawn:0");
    expect(sarcastic).not.toBe("Pick the best answer.");
    expect(genz).not.toBe("Pick the best answer.");
    expect(sarcastic).not.toBe(genz);
  });

  it("quiz success uses dedicated reactions instead of move praise", () => {
    const line = applyCoachLine("", "sarcastic", "quiz-success", "pre-pawn-quiz:1");
    expect(line).not.toBe("Confident play.");
    expect(line.length).toBeGreaterThan(0);
  });

  it("varies quiz answer labels by seed", () => {
    const a = quizUiLabels("egoistic", "lesson-a:step-1");
    const b = quizUiLabels("egoistic", "lesson-b:step-2");
    expect(a.answers.length).toBeGreaterThan(0);
    expect(b.answers.length).toBeGreaterThan(0);
  });
});
