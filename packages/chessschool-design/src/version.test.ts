import { describe, expect, it } from "vitest";
import { isNewerVersion } from "./api";

describe("isNewerVersion", () => {
  it("compares dotted versions", () => {
    expect(isNewerVersion("0.4.1", "0.4.0")).toBe(true);
    expect(isNewerVersion("0.5.0", "0.4.9")).toBe(true);
    expect(isNewerVersion("0.4.0", "0.4.0")).toBe(false);
    expect(isNewerVersion("0.3.0", "0.4.0")).toBe(false);
  });
});
