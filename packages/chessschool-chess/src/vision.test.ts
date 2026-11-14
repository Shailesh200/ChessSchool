import { describe, expect, it } from "vitest";
import { readFen } from "./board";
import { attackRound, attackSet, isVisionScore, knightDistance, knightTarget, loneFen, nameRound, startVision, visionAnswer, visionFen, type VisionPlay } from "./vision";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("board vision", () => {
  it("builds a FEN with one piece, or an empty board", () => {
    expect(loneFen(null)).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(loneFen("n", "a1")).toBe("8/8/8/8/8/8/8/N7 w - - 0 1");
    expect(loneFen("q", "h8")).toBe("7Q/8/8/8/8/8/8/8 w - - 0 1");
    expect([...readFen(loneFen("r", "d4"))]).toEqual([["d4", { type: "r", color: "w" }]]);
  });

  it("lists the squares each lone piece attacks", () => {
    expect(attackSet("n", "a1").sort()).toEqual(["b3", "c2"]);
    expect(attackSet("n", "d4")).toHaveLength(8);
    expect(attackSet("k", "h8").sort()).toEqual(["g7", "g8", "h7"]);
    expect(attackSet("r", "d4")).toHaveLength(14);
    expect(attackSet("b", "a1")).toHaveLength(7);
    expect(attackSet("q", "d4")).toHaveLength(27);
    expect(attackSet("p", "a2")).toEqual(["b3"]);
  });

  it("counts knight hops", () => {
    expect(knightDistance("a1", "a1")).toBe(0);
    expect(knightDistance("a1", "b3")).toBe(1);
    expect(knightDistance("a1", "h8")).toBe(6);
    expect(knightDistance("a1", "b2")).toBe(4);
  });

  it("deals rounds: four distinct names with the answer, attack targets, and a 2-3 hop knight target", () => {
    const n = nameRound(seq(0.1, 0.1, 0.5, 0.9, 0.3, 0.7));
    expect(new Set(n.choices).size).toBe(4);
    expect(n.choices).toContain(n.square);
    const a = attackRound(seq(0.99, 0.0));
    expect(a.piece).toBe("p");
    expect(a.from).toBe("a2");
    expect(a.targets).toEqual(["b3"]);
    for (let i = 0; i < 20; i++) expect([2, 3]).toContain(knightDistance("e4", knightTarget("e4")));
  });

  it("accepts whole scores from 0 to 200", () => {
    expect([0, 17, 200].every(isVisionScore)).toBe(true);
    expect([-1, 201, 2.5, "3", null].some(isVisionScore)).toBe(false);
  });

  it("scores a named square, and deals a new square after a wrong name", () => {
    const play: VisionPlay = { score: 0, round: { game: "name", square: "e4", choices: ["e4", "d4", "e5", "a1"] } };
    expect(visionAnswer(play, "e4").play.score).toBe(1);
    const wrong = visionAnswer(play, "d4");
    expect([wrong.result, wrong.play.score, wrong.missed]).toEqual(["miss", 0, ["e4"]]);
    expect(visionFen(play.round)).toBe(loneFen(null));
  });

  it("counts each attacked square once, finishes the piece, and ends it on a wrong square", () => {
    const play: VisionPlay = { score: 0, round: { game: "attack", piece: "k", from: "h8", targets: ["g8", "g7", "h7"], found: [] } };
    let a = visionAnswer(play, "g8");
    expect(visionAnswer(a.play, "g8").result).toBe("none");
    expect(visionAnswer(a.play, "h8").result).toBe("none");
    a = visionAnswer(visionAnswer(a.play, "g7").play, "h7");
    expect([a.result, a.play.score, a.play.round.game === "attack" && a.play.round.found]).toEqual(["hit", 3, []]);
    const wrong = visionAnswer(play, "a1");
    expect([wrong.result, wrong.play.score, wrong.missed]).toEqual(["miss", 0, ["g8", "g7", "h7"]]);
  });

  it("hops the knight, ignores other squares, and scores on the star with a new star", () => {
    const play: VisionPlay = { score: 0, round: { game: "knight", from: "a1", target: "c3" } };
    expect(visionAnswer(play, "a2").result).toBe("none");
    const hop = visionAnswer(play, "b3");
    expect([hop.play.score, hop.play.round.game === "knight" && hop.play.round.from]).toEqual([0, "b3"]);
    const star = visionAnswer({ score: 2, round: { game: "knight", from: "b1", target: "c3" } }, "c3");
    expect(star.play.score).toBe(3);
    expect(star.play.round.game === "knight" && star.play.round.from).toBe("c3");
    expect(startVision("knight").score).toBe(0);
  });
});
