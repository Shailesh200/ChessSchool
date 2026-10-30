import { describe, expect, it } from "vitest";
import { validateCurriculumOrder } from "./validate-curriculum-order.mjs";
import {
  PRESCHOOL_CLASS_IDS,
  PRESCHOOL_CLASS_LESSONS,
  PRESCHOOL_LESSON_ORDER,
} from "../content/data/preschool-curriculum.mjs";
import {
  PRESCHOOL_CLASS_IDS as PROGRESSION_CLASS_IDS,
  PRESCHOOL_CLASS_LESSONS as PROGRESSION_CLASS_LESSONS,
  PRESCHOOL_LESSON_ORDER as PROGRESSION_LESSON_ORDER,
} from "@chess-school/progression/src/preschool";

describe("validateCurriculumOrder", () => {
  it("passes for the curated school spine", () => {
    expect(validateCurriculumOrder()).toEqual([]);
  });
});

describe("progression preschool spine sync", () => {
  it("matches preschool-curriculum.mjs class ids", () => {
    expect([...PROGRESSION_CLASS_IDS]).toEqual(PRESCHOOL_CLASS_IDS);
  });

  it("matches preschool-curriculum.mjs lesson order", () => {
    expect([...PROGRESSION_LESSON_ORDER]).toEqual(PRESCHOOL_LESSON_ORDER);
  });

  it("matches preschool-curriculum.mjs per-class lesson lists", () => {
    for (const id of PRESCHOOL_CLASS_IDS) {
      expect(PROGRESSION_CLASS_LESSONS[id]).toEqual(PRESCHOOL_CLASS_LESSONS[id]);
    }
  });
});
