import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { LESSONS } from "./curriculum";
import { isUnlocked } from "./unlock";
import { levelForXp, xpProgress } from "@/core/store/progression.store";

describe("curriculum integrity", () => {
  it("every move-step FEN is valid and every solution is legal", () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== "move" || !step.fen) continue;
        const fen = step.fen;
        for (const sol of step.solution ?? []) {
          const parts = sol.split(":");
          const from = parts[0]!;
          const to = parts[1]!;
          const g = new Chess(fen);
          const move = g.move({ from, to, promotion: "q" });
          expect(move, `${lesson.id}/${step.id} ${sol}`).toBeTruthy();
        }
      }
    }
  });

  it("every observe-step plays a fully legal move sequence", () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== "observe" || !step.fen) continue;
        const g = new Chess(step.fen);
        for (const mv of step.moves ?? []) {
          const [from, to] = mv.split(":");
          const move = g.move({ from: from!, to: to!, promotion: "q" });
          expect(move, `${lesson.id}/${step.id} ${mv}`).toBeTruthy();
        }
      }
    }
  });

  it("has no questionnaire steps (school flow only)", () => {
    const kinds = new Set(LESSONS.flatMap((l) => l.steps.map((s) => s.kind)));
    expect(kinds.has("choice" as never)).toBe(false);
    expect([...kinds].sort()).toEqual(["info", "move", "observe"]);
  });
});

describe("unlock logic", () => {
  it("root lessons are unlocked, gated lessons are locked initially", () => {
    expect(isUnlocked("board-basics", {})).toBe(true);
    expect(isUnlocked("fork-master", {})).toBe(false);
  });

  it("unlocks a lesson when prerequisites are mastered", () => {
    const records = {
      "board-basics": { mastery: 1, attempts: 1, lastSeen: 0, dueAt: 0 },
    };
    expect(isUnlocked("pawn-power", records)).toBe(true);
  });
});

describe("xp curve", () => {
  it("level increases monotonically with xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(5000)).toBeGreaterThan(levelForXp(1000));
  });

  it("progress within a level stays within bounds", () => {
    const { into, need } = xpProgress(150);
    expect(into).toBeGreaterThanOrEqual(0);
    expect(into).toBeLessThan(need);
  });
});
