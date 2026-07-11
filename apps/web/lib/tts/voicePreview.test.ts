import { describe, expect, it } from "vitest";
import { voicePreviewKind, voicePreviewText } from "./voicePreview";

describe("voicePreview", () => {
  it("auto follows coach personality", () => {
    const friendly = voicePreviewText("auto", "friendly");
    const strict = voicePreviewText("auto", "strict");
    expect(friendly).not.toBe(strict);
    expect(friendly).toMatch(/coach/i);
  });

  it("coach voices get coaching-style lines", () => {
    const emma = voicePreviewText("emma", "friendly");
    const aria = voicePreviewText("aria", "friendly");
    expect(emma).not.toBe(aria);
    expect(voicePreviewKind("emma")).toBe("coach");
    expect(emma).toMatch(/puzzle|fork|idea/i);
  });

  it("narrator voices get storytelling lines", () => {
    const brian = voicePreviewText("brian", "friendly");
    const guy = voicePreviewText("guy", "friendly");
    expect(brian).not.toBe(guy);
    expect(voicePreviewKind("brian")).toBe("narrator");
    expect(brian).toMatch(/king|position/i);
  });
});
