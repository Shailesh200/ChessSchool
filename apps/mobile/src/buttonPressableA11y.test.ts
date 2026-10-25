import { describe, expect, it } from "vitest";
import { buttonPressableA11yProps } from "./buttonPressableA11y";

describe("buttonPressableA11yProps", () => {
  it("forwards accessibilityLabel to the Pressable props when set", () => {
    expect(buttonPressableA11yProps("Start here")).toEqual({
      accessibilityLabel: "Start here",
    });
    expect(buttonPressableA11yProps("")).toEqual({ accessibilityLabel: "" });
  });

  it("omits accessibilityLabel when unset so the accessible name stays the label", () => {
    expect(buttonPressableA11yProps()).toEqual({});
    expect(buttonPressableA11yProps(undefined)).not.toHaveProperty(
      "accessibilityLabel",
    );
  });
});
