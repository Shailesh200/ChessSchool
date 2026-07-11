import { describe, expect, it } from "vitest";
import { calculationPrompt, confirmMovePrompt, thinkingMatchGreeting } from "./thinkingPrompt";

describe("thinkingPrompt", () => {
  it("gives in-check prompts when king is attacked", () => {
    const line = calculationPrompt("friendly", 900, 12, true);
    expect(line.toLowerCase()).toMatch(/check/);
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
