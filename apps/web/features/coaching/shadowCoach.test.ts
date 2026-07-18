import { describe, expect, it } from "vitest";
import { shadowGreeting, shadowMoveLine, shadowOffBookLine } from "./shadowCoach";

describe("shadowCoach", () => {
  it("greets with opponent name", () => {
    const line = shadowGreeting("genz", "Pip", "w", false);
    expect(line.toLowerCase()).toContain("pip");
  });

  it("flipped greeting mentions defend or other side", () => {
    const line = shadowGreeting("genz", "Pip", "b", true);
    expect(line.length).toBeGreaterThan(8);
    expect(line.toLowerCase()).toMatch(/defend|other|chair|attack|side/);
  });

  it("formats shadow move", () => {
    const line = shadowMoveLine("egoistic", "Nf3", "Coach");
    expect(line).toContain("Nf3");
  });

  it("off-book line is non-empty", () => {
    expect(shadowOffBookLine("sassy").length).toBeGreaterThan(2);
  });
});
