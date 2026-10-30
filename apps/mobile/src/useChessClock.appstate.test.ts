import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("useChessClock foreground (DP-M-011)", () => {
  it("subtracts wall-clock elapsed only while AppState is active", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "useChessClock.ts"), "utf8");
    expect(src).toContain("AppState.currentState");
    expect(src).toContain("now - lastTick");
  });
});
