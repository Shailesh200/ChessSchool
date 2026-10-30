import { describe, expect, it } from "vitest";
import { parseAdminSemesterFields } from "./admin-semester-fields";

describe("admin semester field validation (DP-W-008)", () => {
  it("rejects non-hex colors and invalid stages", () => {
    const bad = parseAdminSemesterFields({
      title: "Spring",
      blurb: "Hello",
      color: "red;background:url(x)",
      stage: "x",
    });
    expect(bad).toEqual({ error: expect.stringMatching(/hex/i) });

    const stageBad = parseAdminSemesterFields({
      title: "Spring",
      blurb: "Hello",
      color: "#5b5bd6",
      stage: "x",
    });
    expect("error" in stageBad).toBe(true);
  });

  it("accepts allowlisted stage and hex color", () => {
    const ok = parseAdminSemesterFields({
      title: "  Spring  ",
      blurb: "A short blurb",
      color: "#5b5bd6",
      stage: "elementary",
    });
    expect(ok).toEqual({
      ok: true,
      data: {
        title: "Spring",
        blurb: "A short blurb",
        color: "#5b5bd6",
        stage: "elementary",
      },
    });
  });
});
