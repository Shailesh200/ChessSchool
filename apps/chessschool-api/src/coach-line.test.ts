import { describe, expect, it } from "vitest";
import { load, type PieceType } from "@chessschool/chess";
import { capWords, hintFacts, parseBotAnswer, parseLineInput } from "./coach-line";
import { factCheck } from "./coach";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const isCoach = (v: unknown): v is "meera" => v === "meera";

describe("coach lines", () => {
  it("accepts only legal moves in a legal position", () => {
    expect(parseLineInput({ kind: "hint", fen: START, move: "e4", coach: "meera" }, isCoach)).toMatchObject({ kind: "hint", move: "e4" });
    expect(parseLineInput({ kind: "hint", fen: START, move: "e5", coach: "meera" }, isCoach)).toBeNull();
    expect(parseLineInput({ kind: "comment", fen: "nonsense", move: "e4", coach: "meera" }, isCoach)).toBeNull();
    expect(parseLineInput({ kind: "bot", fen: START, bot: "cody", options: ["e4", "d4"] }, isCoach)).toMatchObject({ kind: "bot" });
    expect(parseLineInput({ kind: "bot", fen: START, bot: "cody", options: ["e4"] }, isCoach)).toBeNull();
    expect(parseLineInput({ kind: "bot", fen: START, bot: "cody", options: ["e4", "Ke2"] }, isCoach)).toBeNull();
  });

  it("reads the bot's pick and keeps a remark only when it names no other square", () => {
    expect(parseBotAnswer("2", ["e4", "d4"])).toEqual({ pick: 1, say: null });
    expect(parseBotAnswer("1 | Let's grab the middle!", ["e4", "d4"])).toEqual({ pick: 0, say: "Let's grab the middle!" });
    expect(parseBotAnswer("1 | Next I go to h5!", ["e4", "d4"])).toEqual({ pick: 0, say: null });
    expect(parseBotAnswer("3", ["e4", "d4"])).toBeNull();
    expect(parseBotAnswer("I like e4", ["e4", "d4"])).toBeNull();
  });
});

describe("capWords", () => {
  it("keeps short lines and cuts long ones to whole sentences, else 30 words", () => {
    expect(capWords("Take the knight.")).toBe("Take the knight.");
    const long = `${"word ".repeat(12).trim()}. ${"more ".repeat(25).trim()}.`;
    expect(capWords(long)).toBe(`${"word ".repeat(12).trim()}.`);
    const run = "a ".repeat(40).trim();
    expect(capWords(run).split(" ")).toHaveLength(30);
    expect(capWords(run).endsWith("…")).toBe(true);
  });
});

describe("hint facts", () => {
  const facts = (fen: string, san: string) => {
    const m = load(fen).move(san);
    return hintFacts(fen, { san: m.san, from: m.from, to: m.to, piece: m.piece as PieceType, captured: m.captured as PieceType | undefined, check: /[+#]/.test(m.san) });
  };
  it("says what the move wins, saves and builds, and lets those squares pass the fact check", () => {
    const grab = facts("rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", "Nxh4");
    expect(grab.notes).toContain("It wins a queen for free.");
    expect(grab.notes.some((n) => n.includes("pawn on e4 was in danger"))).toBe(true);
    expect(factCheck("Nxh4 wins the queen and saves the pawn on e4.", grab.fact)).toBe(true);
    expect(facts("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "O-O").notes[0]).toMatch(/castles/);
    expect(facts("rnbqkb1r/pppp1ppp/5n2/4p3/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 3", "Nc3").notes).toEqual(["It develops the knight: brings it off the back row into the game."]);
  });
});
