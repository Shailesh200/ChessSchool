import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPalette } from "./themePalette";
import { SCHOOL_THEMES } from "./schoolThemes";

/** WCAG 2.x relative luminance / contrast ratio of two #rrggbb colours. */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const MIDNIGHT_BRAND_50 = "#2a2f57";
const MIDNIGHT_BRAND_100 = "#343c6e";
const schools = SCHOOL_THEMES.map((t) => t.id);

describe("midnight brand tints (UI-M-007..010, UI-M-023)", () => {
  it("covers every school theme", () => {
    expect(schools.length).toBeGreaterThanOrEqual(4);
  });

  for (const school of schools) {
    it(`midnight + ${school}: brand50/brand100 are the dark tints, not the school pastels`, () => {
      const c = buildPalette("midnight", school, false);
      expect(c.brand50).toBe(MIDNIGHT_BRAND_50);
      expect(c.brand100).toBe(MIDNIGHT_BRAND_100);
    });

    it(`midnight + ${school}: text on brand50/brand100 is >= 4.5:1`, () => {
      const c = buildPalette("midnight", school, false);
      for (const tint of ["brand50", "brand100"] as const) {
        for (const ink of ["ink", "ink700", "ink500", "brandInk"] as const) {
          const ratio = contrast(c[ink]!, c[tint]!);
          expect(ratio, `${ink} on ${tint} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      // ink300 is the quietest text token; it must still read on the card + brand50.
      for (const bg of ["surfaceCard", "surface", "brand50"] as const) {
        const ratio = contrast(c.ink300!, c[bg]!);
        expect(ratio, `ink300 on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const ink of ["ink500", "ink700"] as const) {
        for (const bg of ["surfaceCard", "surface", "surfaceSunken"] as const) {
          expect(contrast(c[ink]!, c[bg]!)).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`midnight + ${school}: success banner text is >= 4.5:1 on its tint`, () => {
      const c = buildPalette("midnight", school, false);
      expect(contrast(c.successInk!, c.successTint!)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("light themes keep the school tints and the light success banner", () => {
    for (const t of SCHOOL_THEMES) {
      const c = buildPalette("default", t.id, false);
      expect(c.brand50).toBe(t.brand50);
      expect(c.brand100).toBe(t.brand100);
      expect(c.brandInk).toBe(t.brand);
      expect(c.successTint).toBe("#e7f7ef");
    }
  });

  it("switching Midnight -> Classic restores light tints (no stale dark values)", () => {
    buildPalette("midnight", "university", false);
    const c = buildPalette("default", "university", false);
    expect(c.brand50).not.toBe(MIDNIGHT_BRAND_50);
    expect(c.successTint).toBe("#e7f7ef");
  });

  it("Homework / Dashboard use theme tokens, not hard-coded light colours (UI-M-010)", () => {
    const read = (f: string) => readFileSync(path.resolve(__dirname, "../app", f), "utf8");
    const homework = read("homework.tsx");
    const dashboard = read("dashboard.tsx");
    expect(homework).not.toContain("#e7f7ef");
    expect(homework).toContain("colors.successTint");
    expect(dashboard).not.toContain("rgba(255,255,255,0.6)");
    expect(dashboard).not.toMatch(/^const HEAT = /m); // module-level array froze light colours
    expect(dashboard).toContain("colors.brandInk");
  });
});
