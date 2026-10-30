import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings migrate v12 uiKit", () => {
  it("defaults uiKit to premium and maps legacy uiShell", () => {
    const src = readFileSync(join(__dirname, "settings.store.ts"), "utf8");
    expect(src).toContain("if (version < 12)");
    expect(src).toContain("s.uiKit");
    expect(src).toContain('s.uiShell === "classic"');
  });
});
