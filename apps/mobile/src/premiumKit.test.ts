import { describe, expect, it } from "vitest";
import { buildPremiumTheme, premiumTokensJson } from "./theme/premium";
import { DEFAULT_UI_KIT } from "./uiKit";

describe("premium kit tokens", () => {
  it("maps light brand from semantic tokens", () => {
    const light = buildPremiumTheme("light");
    expect(light.colors.brand).toBe(premiumTokensJson.semantic.light.brand);
    expect(light.colors.surfaceCard).toBe(premiumTokensJson.semantic.light.surface);
  });

  it("maps dark ink and tab colors separately from light", () => {
    const dark = buildPremiumTheme("dark");
    const light = buildPremiumTheme("light");
    expect(dark.colors.ink).not.toBe(light.colors.ink);
    expect(dark.colors.tabBarBg).toBe(premiumTokensJson.semantic.dark.surface);
  });

  it("defaults uiKit to premium", () => {
    expect(DEFAULT_UI_KIT).toBe("premium");
  });
});
