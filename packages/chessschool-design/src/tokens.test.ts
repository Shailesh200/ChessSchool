import { describe, expect, it } from "vitest";
import { palettes, themePalettes, THEMES, resolveTheme, type Palette } from "./tokens";

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** [foreground, background, minimum ratio] pairs the apps actually render. */
const pairs: [keyof Palette, keyof Palette, number][] = [
  ["text", "bg", 4.5],
  ["text", "card", 4.5],
  ["text", "sunken", 4.5],
  ["textMuted", "bg", 4.5],
  ["textMuted", "card", 4.5],
  ["textMuted", "sunken", 4.5],
  ["brandText", "bg", 4.5],
  ["brandText", "card", 4.5],
  ["brandText", "brandSoft", 4.5],
  ["onBrand", "brand", 4.5],
  ["onAccent", "accent", 4.5],
  ["onGold", "gold", 4.5],
  ["onDanger", "danger", 4.5],
  ["successText", "card", 4.5],
  ["successText", "successSoft", 4.5],
  ["dangerText", "card", 4.5],
  ["dangerText", "dangerSoft", 4.5],
  ["goldText", "goldSoft", 4.5],
  ["goldText", "card", 4.5],
  ["text", "heroFrom", 4.5],
  ["text", "heroTo", 4.5],
  ["textMuted", "heroFrom", 4.5],
  ["textMuted", "heroTo", 4.5],
  ["text", "goldSoft", 4.5],
  ["textMuted", "goldSoft", 4.5],
  ["text", "brandSoft", 4.5],
  ["textMuted", "brandSoft", 4.5],
  ["focus", "bg", 3],
  ["brand", "card", 3],
];

describe.each(["light", "dark"] as const)("%s palette", (scheme) => {
  const p = palettes[scheme];
  it.each(pairs)("%s on %s meets %s:1", (fg, bg, min) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(min);
  });
});

describe.each(Object.keys(themePalettes) as (keyof typeof themePalettes)[])("%s theme", (id) => {
  const p = themePalettes[id];
  it.each(pairs)("%s on %s meets %s:1", (fg, bg, min) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(min);
  });
  it("has every palette key", () => {
    expect(Object.keys(p).sort()).toEqual(Object.keys(palettes.light).sort());
  });
});

describe("resolveTheme", () => {
  it("lets Classroom follow Appearance and keeps other themes fixed", () => {
    expect(resolveTheme("classroom", "system", true).scheme).toBe("dark");
    expect(resolveTheme("classroom", "light", true).palette).toBe(palettes.light);
    expect(resolveTheme("ocean", "light", false)).toEqual({ scheme: "dark", palette: themePalettes.ocean });
    expect(THEMES).toHaveLength(7);
  });
});
