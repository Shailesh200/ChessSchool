import { describe, expect, it } from "vitest";
import { capWords, parseBotAnswer, parseLineInput } from "./coach-line";

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
