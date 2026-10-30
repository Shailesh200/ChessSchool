import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("useConfirmLeave (DP-M-015)", () => {
  it("registers BackHandler while active", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "useConfirmLeave.ts"), "utf8");
    expect(src).toContain("BackHandler.addEventListener");
    expect(src).toContain("return true");
    expect(src).toContain("gestureEnabled");
  });
});
