import { describe, expect, it } from "vitest";
import { buildPremiumTheme, premiumTokensJson } from "./theme/premium";
import { DEFAULT_UI_KIT } from "./uiKit";

describe("premium kit tokens", () => {
  it("maps light brand-500 to semantic brand", () => {
    const light = buildPremiumTheme("light");
    expect(light.colors.brand).toBe(premiumTokensJson.light["brand-500"]);
    expect(light.colors.surfaceCard).toBe(premiumTokensJson.light["surface-card"]);
  });

  it("maps dark ink and tab colors separately from light", () => {
    const dark = buildPremiumTheme("dark");
    const light = buildPremiumTheme("light");
    expect(dark.colors.ink).not.toBe(light.colors.ink);
    expect(dark.colors.tabBarBg).toBe(premiumTokensJson.dark["tab-bar-bg"]);
  });

  it("defaults uiKit to premium", () => {
    expect(DEFAULT_UI_KIT).toBe("premium");
  });
});
