import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("fix mistakes layout", () => {
  it("keeps the lesson grid inside the viewport at large text", () => {
    const css = readFileSync(
      path.resolve(__dirname, "../../app/premium/illustrated-screens.css"),
      "utf8",
    );
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 24rem)");
    expect(css).toContain(".illustrated-lesson .cs-bubble {\n  overflow-wrap: anywhere;");
    expect(css).toMatch(/\.illustrated-lesson \{[^}]*max-width: 100%/);
  });
});
