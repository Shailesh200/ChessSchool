import { describe, expect, it } from "vitest";
import {
  calculationPrompt,
  confirmMovePrompt,
  thinkingMatchGreeting,
} from "./thinkingPrompt";

describe("thinkingPrompt", () => {
  it("gives in-check prompts when king is attacked", () => {
    const line = calculationPrompt("friendly", 900, 12, true);
    expect(line.toLowerCase()).toMatch(/check/);
  });

  it("varies prompts across move numbers", () => {
    const a = calculationPrompt("friendly", 600, 4, false);
    const b = calculationPrompt("friendly", 600, 22, false);
    expect(a).not.toBe(b);
  });

  it("does not always append king-safety nudge", () => {
    const line = calculationPrompt("friendly", 300, 6, false);
    expect(line.toLowerCase()).not.toMatch(/king safe/);
  });

  it("confirms staged moves with SAN", () => {
    const line = confirmMovePrompt("Nf3", "mentor");
    expect(line).toMatch(/Nf3/);
  });

  it("thinking greeting names the bot", () => {
    const line = thinkingMatchGreeting(1200, "Remi", "tactical");
    expect(line).toMatch(/Remi/i);
    expect(line.length).toBeGreaterThan(12);
  });
});
