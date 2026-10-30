import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCREENS = [
  "../app/lesson/[id].tsx",
  "../app/play/think.tsx",
  "../app/play/game.tsx",
  "../app/play/pass.tsx",
  "../app/play/online/[id].tsx",
] as const;

describe("useConfirmLeave wiring (DP-M-015)", () => {
  it("hooks lesson, puzzle, and match play screens to ConfirmDialog leave flow", () => {
    for (const rel of SCREENS) {
      const src = fs.readFileSync(path.join(import.meta.dirname, rel), "utf8");
      expect(src, rel).toContain("useConfirmLeave");
      expect(src, rel).toContain("leaveOpen");
      expect(src, rel).toContain("ConfirmDialog");
    }
  });

  it("disables iOS swipe-back via gestureEnabled while leave guard is active", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "useConfirmLeave.ts"), "utf8");
    expect(src).toContain("gestureEnabled");
  });
});
