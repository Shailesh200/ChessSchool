import { describe, expect, it } from "vitest";

describe("useAppIsActive (DP-M-011)", () => {
  it("exports a hook", async () => {
    const mod = await import("./useAppIsActive");
    expect(typeof mod.useAppIsActive).toBe("function");
  });
});
