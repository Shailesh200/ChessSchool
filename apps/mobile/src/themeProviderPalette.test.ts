import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPalette } from "./themePalette";

const MIDNIGHT_BRAND_50 = "#2a2f57";

describe("ThemeProvider palette wiring", () => {
  const src = readFileSync(path.resolve(__dirname, "ThemeProvider.tsx"), "utf8");

  it("imports buildPalette from themePalette (no duplicated builder)", () => {
    expect(src).toMatch(/import \{[^}]*buildPalette[^}]*\} from "\.\/themePalette"/);
    expect(src).not.toMatch(/function buildPalette\s*\(/);
  });

  it("memoizes premium theme for stable useMemo deps", () => {
    expect(src).toMatch(/const premiumTheme = useMemo\(/);
    expect(src).toMatch(/\[uiKit, premiumMode\]/);
    expect(src).toMatch(/premiumTheme\)/);
    expect(src).not.toMatch(/\[appThemeId, schoolThemeId, s\.highContrast, s\.colorblind, premium\]/);
  });

  it("midnight tints from buildPalette match what ThemeProvider merges first", () => {
    const c = buildPalette("midnight", "university", false);
    expect(c.brand50).toBe(MIDNIGHT_BRAND_50);
    expect(c.brandInk).toBeDefined();
    expect(c.successTint).toBeDefined();
    expect(c.successInk).toBeDefined();
    expect(c.brand50).not.toBe("#eef0ff");
  });
});
