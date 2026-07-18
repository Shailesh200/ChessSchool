import { describe, expect, it } from "vitest";
import { voicePreviewKind, voicePreviewText } from "./voicePreview";

describe("voicePreview", () => {
  it("auto follows coach personality", () => {
    const genz = voicePreviewText("auto", "genz");
    const sarcastic = voicePreviewText("auto", "sarcastic");
    expect(genz).not.toBe(sarcastic);
    expect(genz).toMatch(/lock in|cook/i);
    expect(sarcastic).toMatch(/bold|begin/i);
  });

  it("coach voices get coaching-style lines", () => {
    const emma = voicePreviewText("emma", "genz");
    const aria = voicePreviewText("aria", "genz");
    expect(emma).not.toBe(aria);
    expect(voicePreviewKind("emma")).toBe("coach");
    expect(emma).toMatch(/puzzle|fork|idea/i);
  });

  it("narrator voices get storytelling lines", () => {
    const brian = voicePreviewText("brian", "genz");
    const guy = voicePreviewText("guy", "genz");
    expect(brian).not.toBe(guy);
    expect(voicePreviewKind("brian")).toBe("narrator");
    expect(brian).toMatch(/king|position/i);
  });
});
