import { describe, expect, it } from "vitest";
import { buttonPressableA11yProps } from "./buttonPressableA11y";

describe("buttonPressableA11yProps", () => {
  it('uses "Start here" for a label of "Start here →"', () => {
    expect(buttonPressableA11yProps("Start here →")).toEqual({
      accessibilityLabel: "Start here",
    });
    expect(buttonPressableA11yProps("Start here→")).toEqual({
      accessibilityLabel: "Start here",
    });
    expect(buttonPressableA11yProps("  Start here →  ")).toEqual({
      accessibilityLabel: "Start here",
    });
  });

  it("leaves a label with no arrow unchanged", () => {
    expect(buttonPressableA11yProps("Continue")).toEqual({
      accessibilityLabel: "Continue",
    });
  });

  it("lets an explicit accessibilityLabel win", () => {
    expect(buttonPressableA11yProps("Start here →", "Open the Starter stage")).toEqual({
      accessibilityLabel: "Open the Starter stage",
    });
  });

  it("falls back to the arrow-stripped label when accessibilityLabel is empty or whitespace", () => {
    expect(buttonPressableA11yProps("Start here →", "")).toEqual({
      accessibilityLabel: "Start here",
    });
    expect(buttonPressableA11yProps("Start here →", "   ")).toEqual({
      accessibilityLabel: "Start here",
    });
    expect(buttonPressableA11yProps("Continue", undefined)).toEqual({
      accessibilityLabel: "Continue",
    });
  });
});
