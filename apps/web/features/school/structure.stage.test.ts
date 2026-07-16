import { describe, expect, it } from "vitest";
import { isStageGraduatedForDisplay } from "./structure";
import type { SchoolClass } from "@/content/school";

const cls = (id: string): SchoolClass => ({
  id,
  title: id,
  emoji: "♟️",
  blurb: "",
  lessonIds: [`${id}-l1`],
});

const stages = [
  { id: "preschool", optional: true, classes: [cls("pre-a")] },
  { id: "elementary", classes: [cls("elem-a")] },
  { id: "middle", classes: [cls("mid-a")] },
];

describe("isStageGraduatedForDisplay", () => {
  it("marks optional preschool graduated when elementary school exam is passed", () => {
    const graduated = isStageGraduatedForDisplay(0, stages, {}, [], ["elementary"]);
    expect(graduated).toBe(true);
  });

  it("keeps preschool open when elementary is not cleared", () => {
    const graduated = isStageGraduatedForDisplay(0, stages, {}, [], []);
    expect(graduated).toBe(false);
  });
});
