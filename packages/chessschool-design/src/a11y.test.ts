import { afterEach, describe, expect, it } from "vitest";
import { moveSpeech, squareSpeech } from "./a11y";
import { setLanguage } from "./i18n";

afterEach(() => setLanguage("en"));
const base = { piece: "n", to: "f3", capture: false, castle: null, promoted: null, check: false, mate: false } as const;

describe("board speech", () => {
  it("names squares and moves", () => {
    expect(squareSpeech("e4", { type: "n", color: "w" })).toBe("e4, white knight");
    expect(squareSpeech("e4", undefined)).toBe("e4, empty");
    expect(moveSpeech(base)).toBe("Knight to f3");
    expect(moveSpeech({ ...base, capture: true, check: true })).toBe("Knight takes f3. Check");
    expect(moveSpeech({ ...base, piece: "k", castle: "king", mate: true, check: true })).toBe("Castles kingside. Checkmate");
    expect(moveSpeech({ ...base, piece: "p", to: "b8", promoted: "q" })).toBe("Pawn to b8. Promotes to queen");
  });

  it("speaks Hindi when the app is in Hindi", () => {
    setLanguage("hi");
    expect(squareSpeech("e4", { type: "q", color: "b" })).toBe("e4, काली रानी");
    expect(moveSpeech({ ...base, check: true })).toBe("घोड़ा f3 पर। शह");
  });
});
