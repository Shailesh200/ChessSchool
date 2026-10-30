import { describe, expect, it } from "vitest";
import { isPremiumUi, premiumDataTheme } from "./uiShell";

describe("premium ui kit gate", () => {
  it("treats premium kit as illustrated UI", () => {
    expect(isPremiumUi("premium")).toBe(true);
    expect(isPremiumUi("legacy")).toBe(false);
  });

  it("maps midnight app theme to premium dark", () => {
    expect(premiumDataTheme("midnight")).toBe("dark");
    expect(premiumDataTheme("default")).toBe("light");
  });
});
