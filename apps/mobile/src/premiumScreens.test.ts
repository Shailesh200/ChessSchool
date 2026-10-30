import { describe, expect, it } from "vitest";
import { buildPremiumTheme } from "./theme/premium";

describe("premium dex screens", () => {
  it("exposes distinct light and dark surface-paper tokens for profile theming", () => {
    const light = buildPremiumTheme("light");
    const dark = buildPremiumTheme("dark");
    expect(light.colors.surfacePaper).not.toBe(dark.colors.surfacePaper);
  });
});
