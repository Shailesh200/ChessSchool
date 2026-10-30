import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  const cases: Array<{ in: string | null | undefined; want: string; note?: string }> = [
    { in: undefined, want: "/" },
    { in: null, want: "/" },
    { in: "", want: "/" },
    { in: "/play", want: "/play" },
    { in: "/(tabs)/academy", want: "/(tabs)/academy" },
    { in: "/onboarding?x=1", want: "/onboarding?x=1" },
    { in: "//evil.com", want: "/" },
    { in: "/\\evil.com", want: "/" },
    { in: "/%5C%5Cevil.com", want: "/" },
    { in: "/%2f%2fevil.com", want: "/" },
    { in: "https://evil.com", want: "/" },
    { in: "javascript:alert(1)", want: "/" },
    { in: "/login", want: "/" },
    { in: "/register?next=/play", want: "/" },
    { in: "/welcome", want: "/" },
    { in: "/welcome?next=/account", want: "/" },
    { in: "/academy%0d%0aSet-Cookie:bad", want: "/" },
    { in: "/play%09/../evil", want: "/" },
    { in: "%2Fplay", want: "/play" },
    { in: "/%2F%2Fevil", want: "/" },
  ];

  it.each(cases)("safeNextPath($in) → $want", ({ in: input, want }) => {
    expect(safeNextPath(input, "/")).toBe(want);
  });

  it("decodes nested encodings up to four passes", () => {
    const encoded = encodeURIComponent(encodeURIComponent("/play"));
    expect(safeNextPath(encoded, "/")).toBe("/play");
  });

  it("honors custom fallback", () => {
    expect(safeNextPath(undefined, "/academy")).toBe("/academy");
    expect(safeNextPath("//evil.com", "/(tabs)/academy")).toBe("/(tabs)/academy");
  });
});
