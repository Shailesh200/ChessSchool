import { describe, expect, it } from "vitest";
import { plainSpeechText, styleCoachSpeechForTts } from "./speechStyle";

describe("speechStyle", () => {
  it("strips performance tags so Voice Lab voices get clean text", () => {
    const styled = styleCoachSpeechForTts(
      "[playfully] Welcome to Chess School. [chuckles] Try not to hang your queen.",
    );
    expect(styled).toBe(
      "Welcome to Chess School. Try not to hang your queen.",
    );
    expect(plainSpeechText(styled)).not.toMatch(/\[/);
  });

  it("keeps natural punctuation for accent delivery", () => {
    const styled = styleCoachSpeechForTts(
      "Welcome to Chess School, baby. Try not to hang that queen, darling.",
    );
    expect(styled).toContain("baby");
    expect(styled).toContain("darling");
  });
});
