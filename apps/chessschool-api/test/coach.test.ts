import { coachMoments, START_FEN } from "@chessschool/chess";
import { describe, expect, it } from "vitest";
import { askChain, coachPrompt, factCheck, splitAnswer } from "../src/coach";
import type { AiProvider } from "../src/ai";

const SCHOLAR = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];

describe("coach explanations", () => {
  it("builds facts for the learner's real mistake, numbered from the position", () => {
    const moments = coachMoments(START_FEN, SCHOLAR, "b");
    const six = moments.find((m) => m.ply === 6)!;
    expect(six).toMatchObject({ moveNo: 3, by: "b", san: "Nf6", threat: "Qxf7#" });
    const { system, prompt } = coachPrompt(moments, "meera", "en", "b");
    expect(system).toContain("9-year-old");
    expect(system).toContain("the better move by name and why it is better");
    expect(prompt).toContain("Move 3: You played Nf6");
    expect(prompt).toContain("It let the opponent play Qxf7#.");
    // A game started mid-way keeps the position's own move numbers.
    const italian = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const mid = coachMoments(italian, ["Ng5", "Qxg5", "d3", "Qxg2"], "w");
    expect(mid.length).toBeGreaterThan(0);
    for (const m of mid) expect(m.moveNo).toBe(4 + Math.floor((m.ply - 1) / 2));
  });

  it("only accepts an answer that names what the facts name", async () => {
    const moments = coachMoments(START_FEN, SCHOLAR, "b").filter((m) => m.ply === 6);
    const m = moments[0]!;
    expect(factCheck(`Your knight on f6 let the queen take on f7. Try ${m.better} next time.`, m)).toBe(true);
    expect(factCheck("Your bishop on a3 was loose.", m)).toBe(false);
    const good: AiProvider = { name: "good", complete: async () => `[1] Oh no, Nf6 let Qxf7# happen. ${m.better} was safer. Look at every check first!` };
    const bad: AiProvider = { name: "bad", complete: async () => "[1] Your rook on h8 was loose." };
    const failing: AiProvider = { name: "down", complete: async () => Promise.reject(new Error("503")) };
    expect((await askChain([failing, bad, good], moments, "meera", "en", "b"))?.provider).toBe("good");
    expect(await askChain([failing, bad], moments, "meera", "en", "b")).toBeNull();
    expect(splitAnswer("[1] a [2] b", 2)).toEqual(["a", "b"]);
  });
});
