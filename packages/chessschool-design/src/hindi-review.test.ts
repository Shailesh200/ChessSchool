import { describe, expect, it } from "vitest";
import { glossaryFromSource, parseGlossary, reviewHindi } from "../scripts/hindi-review";
import { copy } from "./copy";
import { hi } from "./copy.hi";

describe("hindi review", () => {
  it("finds no hard errors in copy.hi.ts", () => {
    const hard = reviewHindi(copy, hi, glossaryFromSource()).filter((f) => f.severity === "hard");
    expect(hard.map((f) => `${f.key}: ${f.reason}`)).toEqual([]);
  });

  it("flags a missing line and a dropped placeholder, but not a language-neutral one", () => {
    const en = { a: "Hello there", b: (n: number) => `${n} games`, c: "ChessSchool" };
    const found = reviewHindi(en, { b: () => "खेल" }, []);
    expect(found.map((f) => [f.key, f.severity])).toEqual([
      ["a", "hard"],
      ["b", "hard"],
    ]);
  });

  it("reads the glossary and flags तुम as a soft finding", () => {
    const g = parseGlossary("/** Glossary: राजा king · शह-मात checkmate. The learner */");
    expect(g).toEqual([
      { hi: "राजा", en: "king" },
      { hi: "शह-मात", en: "checkmate" },
    ]);
    const found = reviewHindi({ a: "Move your king" }, { a: "तुम अपना राजा चलाओ" }, g);
    expect(found.map((f) => f.severity)).toEqual(["soft"]);
  });
});
