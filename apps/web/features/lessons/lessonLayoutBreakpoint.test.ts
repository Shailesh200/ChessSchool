import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("lesson stage layout breakpoint", () => {
  it("uses kit 900px min-width for side-by-side board layout", () => {
    const css = readFileSync(
      resolve(__dirname, "../../app/globals.css"),
      "utf8",
    );
    expect(css).toContain("kit lgrid @900px");
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*?grid-template-areas: "board coach"/);
    expect(css).not.toMatch(/@media \(min-width: 1024px\)[\s\S]*?grid-template-areas: "board coach"/);
  });
});
