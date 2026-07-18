import { describe, expect, it } from "vitest";
import {
  calculationPrompt,
  confirmMovePrompt,
  thinkingMatchGreeting,
} from "./thinkingPrompt";

describe("thinkingPrompt", () => {
  it("gives in-check prompts when king is attacked", () => {
    const inCheck = calculationPrompt("genz", 900, 12, true);
    const normal = calculationPrompt("genz", 900, 12, false);
    expect(inCheck).not.toBe(normal);
    expect(inCheck.toLowerCase()).toMatch(/escape|legal|king|check|reply/);
  });

  it("varies prompts across move numbers", () => {
    const a = calculationPrompt("genz", 600, 4, false);
    const b = calculationPrompt("genz", 600, 22, false);
    expect(a).not.toBe(b);
  });

  it("does not always append king-safety nudge", () => {
    const line = calculationPrompt("genz", 300, 6, false);
    expect(line.toLowerCase()).not.toMatch(/king safe/);
  });

  it("confirms staged moves with SAN", () => {
    const line = confirmMovePrompt("Nf3", "anxious_nerd");
    expect(line).toMatch(/Nf3/);
  });

  it("thinking greeting names the bot", () => {
    const line = thinkingMatchGreeting(1200, "Remi", "egoistic");
    expect(line).toMatch(/Remi/i);
    expect(line.length).toBeGreaterThan(12);
  });
});
