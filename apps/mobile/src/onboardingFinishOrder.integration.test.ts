import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("onboarding finish order (DP-M-010)", () => {
  it("applies settings only after saveOnboardingToServer", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "../app/onboarding.tsx"), "utf8");
    const serverIdx = src.indexOf("await saveOnboardingToServer");
    const settingsIdx = src.indexOf("onboardingSettingsPatch(");
    expect(serverIdx).toBeGreaterThan(-1);
    expect(settingsIdx).toBeGreaterThan(serverIdx);
  });
});
