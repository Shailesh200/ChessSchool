import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("splash overlay (DP-M-014)", () => {
  it("mounts the app tree while the animated splash is visible", () => {
    const src = fs.readFileSync(
      path.join(import.meta.dirname, "../app/_layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/showSplash[\s\S]*AnimatedSplash/);
    expect(src).toMatch(/AuthProvider[\s\S]*showSplash|showSplash[\s\S]*AuthProvider/);
    expect(src).not.toMatch(/if \(showSplash\) \{\s*return/);
  });
});
