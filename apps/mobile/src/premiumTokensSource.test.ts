import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("premium kit tokens.json", () => {
  const mobileRoot = path.resolve(__dirname, "..");

  it("has a single tokens.json under apps/mobile", () => {
    const canonical = path.join(mobileRoot, "src/theme/premium/tokens.json");
    const duplicate = path.join(mobileRoot, "assets/kit/tokens.json");
    expect(existsSync(canonical)).toBe(true);
    expect(existsSync(duplicate)).toBe(false);
  });

  it("mapTokens imports the canonical file", () => {
    const mapSrc = readFileSync(path.resolve(__dirname, "theme/premium/mapTokens.ts"), "utf8");
    expect(mapSrc).toMatch(/from "\.\/tokens\.json"/);
  });
});
