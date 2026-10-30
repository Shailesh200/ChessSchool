import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..");

const ICON_CONTROL_FILES = [
  "app/lesson/[id].tsx",
  "app/play/game.tsx",
  "app/play/pass.tsx",
  "app/play/online/[id].tsx",
  "app/replay/[index].tsx",
] as const;

describe("icon-only controls a11y (DP-M-012)", () => {
  it("labels lesson back and flip circle buttons", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/lesson/[id].tsx"), "utf8");
    expect(src).toContain('iconCircleA11y("Go back")');
    expect(src).toContain('iconCircleA11y("Flip board")');
  });

  it("uses 44dp circles with hitSlop 12 on listed play/replay screens", () => {
    for (const rel of ICON_CONTROL_FILES) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/hitSlop=\{12\}|ICON_CIRCLE_HIT_SLOP|iconCircleA11y/);
      expect(src, rel).toMatch(/width:\s*44|height:\s*44|ICON_CIRCLE_SIZE|CIRCLE\s*=\s*44/);
    }
  });
});
