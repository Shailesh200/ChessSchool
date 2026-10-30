import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("uiKit premium vs classic chrome", () => {
  const topBar = readFileSync(path.resolve(__dirname, "TopBar.tsx"), "utf8");
  const bottomNav = readFileSync(path.resolve(__dirname, "BottomNav.tsx"), "utf8");

  it("TopBar switches KitTopBar vs LegacyTopBar by uiKit", () => {
    expect(topBar).toMatch(/function LegacyTopBar\s*\(/);
    expect(topBar).toMatch(/KitTopBar/);
    expect(topBar).toMatch(/kit === "premium"\s*\?\s*<KitTopBar\s*\/>\s*:\s*<LegacyTopBar\s*\/>/);
  });

  it("BottomNav switches KitBottomNav vs LegacyBottomNav by uiKit", () => {
    expect(bottomNav).toMatch(/function LegacyBottomNav\s*\(/);
    expect(bottomNav).toMatch(/KitBottomNav/);
    expect(bottomNav).toMatch(/if \(kit === "premium"\) return <KitBottomNav \/>;/);
    expect(bottomNav).toMatch(/return <LegacyBottomNav \/>;/);
  });
});
