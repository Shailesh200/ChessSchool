import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("fix mistakes layout", () => {
  it("keeps the lesson grid inside the viewport at large text", () => {
    const css = readFileSync(
      path.resolve(__dirname, "../../app/premium/illustrated-screens.css"),
      "utf8",
    );
    expect(css).toContain("grid-template-columns: minmax(0, 3fr) minmax(0, 2fr)");
    const screens = readFileSync(
      path.resolve(__dirname, "../../styles/premium/screens.css"),
      "utf8",
    );
    expect(screens).toContain("grid-template-columns:minmax(0,min(40rem,58%)) minmax(0,1fr)");
    expect(screens).not.toContain("grid-template-columns:minmax(0,40rem)");
    expect(css).toContain(".illustrated-lesson .cs-bubble {\n  overflow-wrap: anywhere;");
    expect(css).toMatch(/\.illustrated-lesson \{[^}]*max-width: 100%/);
    expect(css).toMatch(
      /:is\(\.illustrated-sheet, \.illustrated-lesson\) \.btn \{[^}]*white-space: normal;/,
    );
    expect(css).toMatch(/:is\(\.illustrated-lesson\) \.pill,[\s\S]*?white-space: normal;/);
  });
});
