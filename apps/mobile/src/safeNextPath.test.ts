import { describe, expect, it } from "vitest";
import { safeNextPath } from "@chess-school/core";

describe("safeNextPath (mobile welcome)", () => {
  const fallback = "/(tabs)/academy";

  it.each([
    { in: "//evil.com", want: fallback },
    { in: "/\\evil.com", want: fallback },
    { in: "/%2f%2fevil.com", want: fallback },
    { in: "/lesson/foo", want: "/lesson/foo" },
  ] as const)("safeNextPath($in)", ({ in: input, want }) => {
    expect(safeNextPath(input, fallback)).toBe(want);
  });
});
