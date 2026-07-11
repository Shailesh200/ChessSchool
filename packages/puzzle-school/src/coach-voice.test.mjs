import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setupCoach, capstoneIntro } from "./coach-voice.mjs";

describe("setupCoach", () => {
  it("never uses the legacy generic Lichess template", () => {
    for (const concept of ["mate", "fork", "pin", "discovered", "sacrifice", "trapped", "endgame", "advantage"]) {
      const text = setupCoach(concept, "middle");
      assert.ok(!/Your move\. Find the .* idea\./i.test(text));
      assert.ok(text.length >= 20);
    }
  });
});

describe("capstoneIntro", () => {
  it("includes stage and concept framing", () => {
    const text = capstoneIntro("fork", "high", "Fork");
    assert.match(text, /High School/);
    assert.match(text, /Capstone/);
  });
});
