import { readFileSync } from "node:fs";
import { THINK_LESSONS } from "@chessschool/chess";
import { sanitizeProgress, THINK_PATH } from "@chessschool/design";
import { describe, expect, it } from "vitest";

const course = JSON.parse(readFileSync(new URL("../data/course.json", import.meta.url), "utf8")) as { lessons: { id: string }[] };

describe("think track on the server", () => {
  it("the design list matches the track, and no id clashes with the course", () => {
    expect(THINK_PATH).toEqual(THINK_LESSONS);
    const server = new Set(course.lessons.map((l) => l.id));
    expect(THINK_PATH.filter((n) => server.has(n.id))).toEqual([]);
  });

  it("keeps track completions and their XP outside the course order", () => {
    const p = sanitizeProgress({ completed: { thinkStart: "2026-11-27" }, xp: 20, streak: { count: 1, lastDay: "2026-11-27" }, minutes: { day: null, value: 0 } } as never, [{ id: "board", xp: 10 }]);
    expect(p.completed.thinkStart).toBe("2026-11-27");
    expect(p.xp).toBe(20);
  });
});
