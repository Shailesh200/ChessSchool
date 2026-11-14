import { describe, expect, it } from "vitest";
import { COACHES, voiceKey } from "./coaches";

describe("coaches", () => {
  it("has four coaches with unique ids and voices", () => {
    expect(new Set(COACHES.map((c) => c.id)).size).toBe(4);
    expect(new Set(COACHES.map((c) => c.voiceId)).size).toBe(4);
  });

  it("keys a line by its text, ignoring spacing", () => {
    expect(voiceKey("Knights jump in an L.")).toBe(voiceKey("  Knights   jump in an L. "));
    expect(voiceKey("Knights jump in an L.")).not.toBe(voiceKey("Knights jump in an L!"));
    expect(voiceKey("Nice!")).toMatch(/^[0-9a-f]{16}$/);
  });
});
