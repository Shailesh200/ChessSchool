import { describe, expect, it } from "vitest";
import { resolvePremiumMapState } from "./mapState";

describe("resolvePremiumMapState", () => {
  it("prioritizes offline and loading before normal", () => {
    expect(
      resolvePremiumMapState({
        online: false,
        ready: true,
        loadError: false,
        empty: false,
        dark: false,
      }),
    ).toBe("offline");
    expect(
      resolvePremiumMapState({
        online: true,
        ready: false,
        loadError: false,
        empty: false,
        dark: true,
      }),
    ).toBe("loading");
  });

  it("returns dark when ready and midnight theme", () => {
    expect(
      resolvePremiumMapState({
        online: true,
        ready: true,
        loadError: false,
        empty: false,
        dark: true,
      }),
    ).toBe("dark");
  });
});
