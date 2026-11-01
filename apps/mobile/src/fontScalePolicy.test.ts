import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

/** Every non-test source file the app can ship or test-support code can leak: src/** (incl. src/testing/**) and app/**. */
function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(root, p).split(path.sep).join("/");
const sources = [...files(path.join(root, "src")), ...files(path.join(root, "app"))].map(rel).sort();
const raw = (r: string) => readFileSync(path.join(root, r), "utf8");
/** Comments are documentation, not behaviour: strip them so prose that names the cap cannot trip (or hide) a scan. */
const code = (r: string) =>
  raw(r)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

/** Per-file occurrence counts of `needle` in code (comments stripped), non-zero files only. */
function counts(needle: RegExp): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of sources) {
    const n = code(r).match(needle)?.length ?? 0;
    if (n > 0) out[r] = n;
  }
  return out;
}

const CAP_REF = /\b(?:chromeTextProps|CHROME_MAX_FONT_SIZE_MULTIPLIER)\b/g;

/**
 * Arc's ruling (UI-M-020): no global font cap; body text scales to 200% and
 * reflows. Only fixed chrome is capped, at 1.5. These tests pin WHERE the cap
 * may be referenced and HOW MANY times, so a wrapper component that spreads
 * chromeTextProps (a global cap by reuse), a literal cap in an allowed file, a
 * helper under src/testing, or a defaultProps default all fail with a diff.
 */
describe("font-scale policy", () => {
  it("fontScale.ts is the single, self-contained definition of the 1.5 chrome cap", () => {
    const c = code("src/fontScale.ts");
    expect(c.match(/export const CHROME_MAX_FONT_SIZE_MULTIPLIER = 1\.5;/g)).toHaveLength(1);
    expect(c.match(/export const chromeTextProps = \{\s*maxFontSizeMultiplier: CHROME_MAX_FONT_SIZE_MULTIPLIER,?\s*\} as const;/g)).toHaveLength(1);
    expect(c.match(/maxFontSizeMultiplier/g)).toHaveLength(1);
    expect(c.match(/defaultProps|allowFontScaling/g)).toBeNull();
    expect(c.match(/\bimport\b|\brequire\(/g)).toBeNull();
  });

  it("defaultProps and allowFontScaling appear nowhere in app, src or src/testing", () => {
    expect({
      defaultProps: counts(/defaultProps/g),
      allowFontScaling: counts(/allowFontScaling/g),
    }).toEqual({ defaultProps: {}, allowFontScaling: {} });
  });

  it("maxFontSizeMultiplier is defined once (fontScale.ts) and not used as a literal anywhere else", () => {
    expect(counts(/maxFontSizeMultiplier/g)).toEqual({ "src/fontScale.ts": 1 });
  });

  it("the chrome cap is referenced only by the allowlisted fixed-chrome files, an exact number of times", () => {
    // fontScale.ts: constant decl + its use in chromeTextProps + the chromeTextProps export (3)
    // BottomNav.tsx: import + one classic label spread (2)
    // kit/TabBar.tsx: import + one premium label spread (2) — the default tab labels
    // ChessBoard.tsx: import + two coordinate spreads (3)
    expect(counts(CAP_REF)).toEqual({
      "src/fontScale.ts": 3,
      "src/BottomNav.tsx": 2,
      "src/components/kit/TabBar.tsx": 2,
      "src/ChessBoard.tsx": 3,
    });
  });

  it("exactly one tab label per bar and two board coordinates take the cap", () => {
    expect(code("src/BottomNav.tsx").match(/<Text \{\.\.\.chromeTextProps\}/g)).toHaveLength(1);
    expect(code("src/components/kit/TabBar.tsx").match(/\{\.\.\.chromeTextProps\}/g)).toHaveLength(1);
    const board = code("src/ChessBoard.tsx");
    expect(board.match(/<Text \{\.\.\.chromeTextProps\} style=\{\[styles\.coord/g)).toHaveLength(2);
    expect(board.match(/\{\.\.\.chromeTextProps\}/g)).toHaveLength(2);
  });

  it("login scrolls so the guest hint and Privacy link stay reachable at 200% (UI-M-001)", () => {
    const login = raw("app/login.tsx");
    expect(login).toMatch(/<ScrollView[^>]*contentContainerStyle=\{styles\.center\}/);
    expect(login).toMatch(/center: \{\s*flexGrow: 1/);
    expect(login.indexOf("<ScrollView")).toBeLessThan(login.indexOf("Privacy policy"));
  });
});
