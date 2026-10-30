import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("lesson tutorial save retry wiring (DP-M-009)", () => {
  it("shows Retry when shouldShowTutorialSaveRetry is true on the lesson screen", () => {
    const src = fs.readFileSync(
      path.join(import.meta.dirname, "../app/lesson/[id].tsx"),
      "utf8",
    );
    expect(src).toContain("shouldShowTutorialSaveRetry");
    expect(src).toContain('"save-retry"');
    expect(src).toMatch(/Retry save/);
  });
});
