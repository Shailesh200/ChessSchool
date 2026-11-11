import { describe, expect, it } from "vitest";
import { focusCourse, lessonAfter, parseCourse, type Course } from "./course";

const course: Course = {
  units: [
    { id: "unit1", title: "Unit 1 · First steps", sub: "" },
    { id: "unit2", title: "Unit 2 · Playing well", sub: "" },
  ],
  lessons: [
    { id: "a", unit: "unit1", title: "A", sub: "a", minutes: 2, xp: 10, steps: [] },
    { id: "b", unit: "unit1", title: "B", sub: "b", minutes: 5, xp: 20, steps: [] },
    { id: "c", unit: "unit2", title: "C", sub: "c", minutes: 5, xp: 20, steps: [] },
    { id: "d", unit: "unit2", title: "D", sub: "d", minutes: 5, xp: 20, steps: [] },
    { id: "e", unit: "unit2", title: "E", sub: "e", minutes: 5, xp: 20, steps: [] },
  ],
};

describe("focusCourse", () => {
  it("starts at the first lesson", () => {
    const f = focusCourse(course, {});
    expect(f.current?.id).toBe("a");
    expect(f.justFinished).toBeNull();
    expect(f.upcoming.map((l) => l.id)).toEqual(["b", "c"]);
    expect(f.rest.map((l) => l.id)).toEqual(["d", "e"]);
    expect(f.unitsDone).toHaveLength(0);
  });

  it("puts the last finished lesson behind the current one", () => {
    const f = focusCourse(course, { a: "2026-11-01", b: "2026-11-02" });
    expect(f.doneCount).toBe(2);
    expect(f.unitsDone.map((u) => u.id)).toEqual(["unit1"]);
    expect(f.justFinished?.id).toBe("b");
    expect(f.current?.id).toBe("c");
    expect(f.upcoming.map((l) => l.id)).toEqual(["d", "e"]);
    expect(f.rest).toHaveLength(0);
  });

  it("finds the following lesson", () => {
    expect(lessonAfter(course, "c")?.id).toBe("d");
    expect(lessonAfter(course, "e")).toBeNull();
    expect(parseCourse("nope")).toBeNull();
    expect(parseCourse(JSON.stringify(course))?.lessons).toHaveLength(5);
  });
});
