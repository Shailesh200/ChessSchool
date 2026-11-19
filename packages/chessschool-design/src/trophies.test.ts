import { describe, expect, it } from "vitest";
import { badgeKind, isUnitBadge, unitFinishDay } from "./trophies";

describe("trophy room", () => {
  it("keeps unit badges out of the grid and groups the rest", () => {
    expect(isUnitBadge("unit3")).toBe(true);
    expect(isUnitBadge("firstLesson")).toBe(false);
    expect(badgeKind("streak7")).toBe("streak");
    expect(badgeKind("beatBishop")).toBe("win");
    expect(badgeKind("daily5")).toBe("puzzle");
    expect(badgeKind("practice5")).toBe("practice");
    expect(badgeKind("firstLesson")).toBe("learn");
  });

  it("dates a unit by its last lesson, and only once every lesson is done", () => {
    const course = { lessons: [{ id: "a", unit: "u1" }, { id: "b", unit: "u1" }, { id: "c", unit: "u2" }] } as never;
    expect(unitFinishDay(course, { a: "2026-11-02", b: "2026-11-09" }, "u1")).toBe("2026-11-09");
    expect(unitFinishDay(course, { a: "2026-11-02" }, "u1")).toBeNull();
    expect(unitFinishDay(course, {}, "u9")).toBeNull();
  });
});
