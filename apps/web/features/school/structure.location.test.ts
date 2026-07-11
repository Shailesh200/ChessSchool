import { describe, expect, it } from "vitest";
import { SEMESTERS } from "@/content/school";
import { currentLocation, hasStartedRequiredTrack } from "./structure";

const semesters = SEMESTERS;
const titles: Record<string, string> = {};

describe("currentLocation", () => {
  it("starts brand-new guests in Pre-School", () => {
    const loc = currentLocation({}, [], semesters, titles);
    expect(loc.cls.id).toBe("class-pre-board");
    expect(loc.lessonId).toBe("pre-board-intro");
    expect(loc.complete).toBe(false);
  });

  it("skips Pre-School when the required track already has progress", () => {
    const records = {
      "board-basics": { mastery: 0.5, attempts: 1, lastSeen: 0, dueAt: 0 },
    };
    const loc = currentLocation(records, [], semesters, titles);
    expect(loc.cls.id).not.toMatch(/^class-pre-/);
    expect(hasStartedRequiredTrack(records, [], semesters)).toBe(true);
  });

  it("hasStartedRequiredTrack is false with empty progress", () => {
    expect(hasStartedRequiredTrack({}, [], semesters)).toBe(false);
  });
});
