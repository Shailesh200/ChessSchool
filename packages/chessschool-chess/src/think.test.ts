import { describe, expect, it } from "vitest";
import { load } from "./game";
import type { Step } from "./lessons";
import { runnerReduce, startRunner } from "./runner";
import { THINK_LESSONS, thinkLesson, thinkNext, thinkTrack } from "./think";


describe("think track", () => {
  it("has unique ids", () => {
    const ids = THINK_LESSONS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every move step is a legal move for the learner's side, in both languages, and Hindi is translated", () => {
    for (const lang of ["en", "hi"] as const) {
      for (const lesson of thinkTrack(lang).flatMap((u) => u.lessons)) {
        expect(lesson.steps.length, lesson.id).toBeGreaterThan(2);
        for (const s of lesson.steps as Step[]) {
          expect(s.title && s.body, `${lesson.id} ${lang}`).toBeTruthy();
          if (lang === "hi") expect(s.body, lesson.id).toMatch(/[\u0900-\u097F]/);
          const c = load(s.fen);
          if (s.kind === "move" && s.goal.type === "exact") {
            expect(c.turn(), `${lesson.id}: ${s.title}`).toBe(s.side ?? "w");
            expect(() => c.move({ from: s.goal.type === "exact" ? s.goal.from : "a1", to: s.goal.type === "exact" ? s.goal.to : "a1", promotion: "q" }), `${lesson.id}: ${s.title}`).not.toThrow();
          }
          if (s.kind === "game") expect(c.turn(), lesson.id).toBe(s.side ?? "w");
          if (s.kind === "choice") expect(s.options.filter((o) => o.correct)).toHaveLength(1);
        }
      }
    }
  });

  it("the attack lesson ends in checkmate", () => {
    const steps = thinkLesson("thinkAttack", "en")!.steps;
    const last = steps.filter((s) => s.kind === "move").at(-1)!;
    const c = load(last.fen);
    if (last.kind === "move" && last.goal.type === "exact") c.move({ from: last.goal.from, to: last.goal.to });
    expect(c.isCheckmate()).toBe(true);
  });

  it("finds the next open lesson", () => {
    expect(thinkNext("thinkStart", {}, "en")?.id).toBe("thinkReply");
    expect(thinkNext("thinkStart", { thinkReply: "2026-11-27" }, "en")?.id).toBe("thinkItalian");
  });


  it("plays a whole Black lesson through the runner, up to its game", () => {
    let r = startRunner(thinkLesson("thinkSicilian", "en")!.steps);
    for (let guard = 0; guard < 40 && r.status !== "finished"; guard++) {
      const step = r.steps[r.index]!;
      if (step.kind === "game") break;
      if (step.kind === "move" && step.goal.type === "exact" && r.status === "working") {
        r = runnerReduce(r, { type: "tap", square: step.goal.from });
        r = runnerReduce(r, { type: "tap", square: step.goal.to });
        expect(r.status, step.title).toBe("ready");
      } else if (step.kind === "choice" && r.status === "working") r = runnerReduce(r, { type: "choose", index: step.options.findIndex((o) => o.correct) });
      r = runnerReduce(r, { type: "next" });
    }
    expect(r.steps[r.index]!.kind).toBe("game");
    expect(r.misses).toBe(0);
  });
});
