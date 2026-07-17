import { describe, expect, it } from "vitest";
import { scopePieceSvg } from "./pieceSvgScope";

describe("scopePieceSvg", () => {
  it("prefixes ids and gradient references", () => {
    const xml =
      '<svg><defs><linearGradient id="fillGradient"/><linearGradient xlink:href="#fillGradient" id="g1"/></defs><path fill="url(#fillGradient)" class="base"/></svg>';
    const scoped = scopePieceSvg(xml, "p-e4");
    expect(scoped).toContain('id="p-e4__fillGradient"');
    expect(scoped).toContain('url(#p-e4__fillGradient)');
    expect(scoped).toContain('xlink:href="#p-e4__fillGradient"');
  });

  it("does not corrupt longer ids when prefixing short ids", () => {
    const xml = '<svg><defs><linearGradient id="ab"/><linearGradient id="a"/></defs><path fill="url(#ab)"/></svg>';
    const scoped = scopePieceSvg(xml, "p1");
    expect(scoped).toContain('id="p1__ab"');
    expect(scoped).toContain('id="p1__a"');
    expect(scoped).toContain('url(#p1__ab)');
  });
});
