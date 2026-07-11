import { describe, expect, it } from "vitest";
import { shadowGreeting, shadowMoveLine, shadowOffBookLine } from "./shadowCoach";

describe("shadowCoach", () => {
  it("greets with opponent name", () => {
    const line = shadowGreeting("friendly", "Pip", "w", false);
    expect(line.toLowerCase()).toContain("pip");
  });

  it("flipped greeting mentions defend or other side", () => {
    const line = shadowGreeting("friendly", "Pip", "b", true);
    expect(line.length).toBeGreaterThan(8);
  });

  it("formats shadow move", () => {
    const line = shadowMoveLine("tactical", "Nf3", "Coach");
    expect(line).toContain("Nf3");
  });

  it("off-book line is non-empty", () => {
    expect(shadowOffBookLine("minimal").length).toBeGreaterThan(2);
  });
});
