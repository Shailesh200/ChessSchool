import { describe, expect, it } from "vitest";
import type { CurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

describe("curriculum skeleton shape", () => {
  it("lesson rows omit step blobs (metadata only)", () => {
    const row: CurriculumSkeleton["lessons"][number] = {
      id: "lesson-1",
      classId: "class-pieces",
      title: "Pawn Power",
      emoji: "♟️",
      tag: "pawns",
      isExam: 0,
      sortOrder: 1,
    };
    expect(row).not.toHaveProperty("steps");
    expect(Object.keys(row).sort()).toEqual(
      ["classId", "emoji", "id", "isExam", "sortOrder", "tag", "title"].sort(),
    );
  });

  it("groups lesson counts per class from skeleton", () => {
    const skeleton: CurriculumSkeleton = {
      semesters: [],
      classes: [
        {
          id: "c1",
          title: "A",
          emoji: "♟️",
          blurb: "",
          semesterId: "s1",
          difficulty: 1,
          examId: null,
          sortOrder: 0,
        },
      ],
      lessons: [
        {
          id: "l1",
          classId: "c1",
          title: "L1",
          emoji: "♟️",
          tag: "t",
          isExam: 0,
          sortOrder: 0,
        },
        {
          id: "l2",
          classId: "c1",
          title: "L2",
          emoji: "♟️",
          tag: "t",
          isExam: 0,
          sortOrder: 1,
        },
        {
          id: "l3",
          classId: "c2",
          title: "L3",
          emoji: "♟️",
          tag: "t",
          isExam: 0,
          sortOrder: 0,
        },
      ],
    };
    const counts: Record<string, number> = {};
    for (const l of skeleton.lessons) counts[l.classId] = (counts[l.classId] ?? 0) + 1;
    expect(counts.c1).toBe(2);
    expect(counts.c2).toBe(1);
  });
});
