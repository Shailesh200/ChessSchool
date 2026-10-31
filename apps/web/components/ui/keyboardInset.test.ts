import { describe, expect, it } from "vitest";
import { keyboardOverlap } from "./keyboardInset";

describe("keyboardOverlap", () => {
  it("is the part of the layout the keyboard covers", () => {
    expect(keyboardOverlap(800, 800, 0)).toBe(0);
    expect(keyboardOverlap(800, 420, 0)).toBe(380);
    expect(keyboardOverlap(800, 420, 12)).toBe(368);
  });

  it("never lifts the sheet by a negative amount", () => {
    expect(keyboardOverlap(400, 800, 0)).toBe(0);
    expect(keyboardOverlap(Number.NaN, 100, 0)).toBe(0);
  });
});
