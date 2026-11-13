import { describe, expect, it } from "vitest";
import { focusCourse, guestClassCap, guestUnitBlocked, lessonAccess, lessonAfter, nextOpenLesson, parseCourse, unitUnlocked, type Course } from "./course";

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

describe("class unlock", () => {
  it("keeps the next class locked until this one is finished", () => {
    expect(unitUnlocked(course, {}, "unit1")).toBe(true);
    expect(unitUnlocked(course, {}, "unit2")).toBe(false);
    expect(lessonAccess(course, {}, "a")).toBe("current");
    expect(lessonAccess(course, {}, "b")).toBe("locked");
    expect(lessonAccess(course, {}, "c")).toBe("locked");
  });

  it("unlocks the next class after the current one is finished", () => {
    const done = { a: "2026-11-01", b: "2026-11-02" };
    expect(unitUnlocked(course, done, "unit2")).toBe(true);
    expect(lessonAccess(course, done, "b")).toBe("done");
    expect(lessonAccess(course, done, "c")).toBe("current");
    expect(lessonAccess(course, done, "d")).toBe("locked");
  });

  it("continues to the next open lesson, skipping ones already done", () => {
    expect(nextOpenLesson(course, {}, "a")?.id).toBe("b");
    expect(nextOpenLesson(course, { a: "2026-11-01", b: "2026-11-01" }, "a")?.id).toBe("c");
    expect(nextOpenLesson(course, { a: "2026-11-01", b: "2026-11-01", c: "2026-11-02" }, "b")?.id).toBe("d");
    expect(nextOpenLesson(course, { a: "d", b: "d", c: "d", d: "d", e: "d" }, "e")).toBeNull();
  });
});

describe("guest class cap", () => {
  it("reads a cap only when the course payload includes one", () => {
    expect(guestClassCap(course)).toBeNull();
    expect(guestClassCap(null)).toBeNull();
    expect(guestClassCap({ ...course, guestClasses: 3 })).toBe(3);
    expect(guestClassCap({ ...course, guestClasses: 3.9 })).toBe(3);
    expect(guestUnitBlocked(course, "unit2", null)).toBe(false);
    expect(guestUnitBlocked(course, "unit1", 1)).toBe(false);
    expect(guestUnitBlocked(course, "unit2", 1)).toBe(true);
    expect(parseCourse(JSON.stringify({ ...course, guestClasses: 3 }))?.guestClasses).toBe(3);
    expect(parseCourse(JSON.stringify(course))?.guestClasses).toBeUndefined();
  });
});
