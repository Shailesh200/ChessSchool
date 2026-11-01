import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHROME_MAX_FONT_SIZE_MULTIPLIER, chromeTextProps } from "./fontScale";

const root = path.resolve(__dirname, "..");

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.ts$/.test(e)) out.push(p);
  }
  return out;
}
const src = [...files(path.join(root, "src")), ...files(path.join(root, "app"))];
const rel = (p: string) => path.relative(root, p);
const read = (r: string) => readFileSync(path.join(root, r), "utf8");

/**
 * Arc's ruling (UI-M-020): no global font cap; body text scales to 200% and
 * reflows. Only fixed chrome is capped, at 1.5.
 */
describe("font-scale policy", () => {
  it("chrome cap is 1.5", () => {
    expect(CHROME_MAX_FONT_SIZE_MULTIPLIER).toBe(1.5);
    expect(chromeTextProps).toEqual({ maxFontSizeMultiplier: 1.5 });
  });

  it("no global default and no ad-hoc caps outside fixed chrome", () => {
    const allowed = new Set([
      "src/fontScale.ts",
      "src/BottomNav.tsx",
      "src/ChessBoard.tsx",
    ]);
    const isTestSupport = (r: string) =>
      r.startsWith("src/testing/") || r.endsWith(".test.ts");
    const offenders = src
      .filter((f) =>
        /maxFontSizeMultiplier|\.defaultProps|allowFontScaling/.test(
          readFileSync(f, "utf8"),
        ),
      )
      .map(rel)
      .filter((r) => !allowed.has(r) && !isTestSupport(r));
    expect(offenders).toEqual([]);
  });

  it("tab bar labels and board coordinates use the chrome cap", () => {
    expect(read("src/BottomNav.tsx")).toMatch(/chromeTextProps/);
    const board = read("src/ChessBoard.tsx");
    expect(
      board.match(/<Text \{\.\.\.chromeTextProps\} style=\{\[styles\.coord/g),
    ).toHaveLength(2);
  });

  it("login scrolls so the guest hint and Privacy link stay reachable at 200% (UI-M-001)", () => {
    const login = read("app/login.tsx");
    expect(login).toMatch(/<ScrollView[^>]*contentContainerStyle=\{styles\.center\}/);
    expect(login).toMatch(/center: \{\s*flexGrow: 1/);
    expect(login.indexOf("<ScrollView")).toBeLessThan(login.indexOf("Privacy policy"));
  });
});
