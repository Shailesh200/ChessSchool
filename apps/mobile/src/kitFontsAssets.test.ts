import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kitFontsPath = path.join(mobileRoot, "src/theme/premium/kitFonts.ts");

function kitFontRequirePaths(): string[] {
  const src = fs.readFileSync(kitFontsPath, "utf8");
  expect(src).not.toMatch(/\.woff2/i);
  return [...src.matchAll(/require\("(\.\.\/[^"]+\.(?:ttf|otf))"\)/g)].map((m) => m[1]!);
}

describe("kit font assets (Android / Metro)", () => {
  it("registers only existing .ttf/.otf files (no woff2)", () => {
    const relPaths = kitFontRequirePaths();
    expect(relPaths.length).toBeGreaterThanOrEqual(4);
    for (const rel of relPaths) {
      expect(rel).toMatch(/\.(ttf|otf)$/);
      const abs = path.normalize(path.join(mobileRoot, "src/theme/premium", rel.replace(/^\.\.\//, "../")));
      // rel is ../../../assets/... from src/theme/premium
      const abs2 = path.normalize(path.join(path.dirname(kitFontsPath), rel));
      expect(fs.existsSync(abs2), abs2).toBe(true);
    }
  });

  it("does not ship woff2 under assets/kit/fonts", () => {
    const fontsDir = path.join(mobileRoot, "assets/kit/fonts");
    const woff2 = fs.readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));
    expect(woff2).toEqual([]);
  });
});
