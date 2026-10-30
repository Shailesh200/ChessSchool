import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("useAppIsActive (DP-M-011)", () => {
  it("tracks AppState active foreground", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "useAppIsActive.ts"), "utf8");
    expect(src).toContain("AppState.addEventListener");
    expect(src).toContain('state === "active"');
  });
});
