import { describe, expect, it } from "vitest";
import { applyCoachLine } from "./personality";

describe("applyCoachLine", () => {
  it("retints success lines per personality", () => {
    const strict = applyCoachLine("Correct! ✓", "strict", "success");
    expect(strict).not.toBe("Correct! ✓");
    expect(strict.length).toBeGreaterThan(2);
  });

  it("never uses the legacy generic Lichess template", () => {
    const line = applyCoachLine(
      "Your move. Find the fork idea.",
      "friendly",
      "lesson",
    );
    expect(line).not.toMatch(/Your move\. Find the .* idea\./i);
  });

  it("shortens long lesson copy for minimal personality", () => {
    const long =
      "This is a long explanation about forks and how knights can hit two pieces at once. Look for the king and queen on the same fork square when you calculate.";
    const line = applyCoachLine(long, "minimal", "lesson");
    expect(line.length).toBeLessThan(long.length);
  });
});
