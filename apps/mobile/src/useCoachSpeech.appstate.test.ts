import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("coach speech on background (DP-M-011)", () => {
  it("stops coach speech when AppState leaves active", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "useCoachSpeech.ts"), "utf8");
    expect(src).toMatch(/AppState\.addEventListener[\s\S]*stopCoachSpeech/);
  });
});
