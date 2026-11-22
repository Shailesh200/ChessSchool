import { afterEach, describe, expect, it } from "vitest";
import { copy } from "./copy";
import { setLanguage } from "./i18n";
import { keyMomentText, moveStory, type StoryFacts } from "./keyMoment";

const base: StoryFacts = { san: "Nf6", verdict: "blunder", lossPiece: null, better: null, captured: null, check: false, mate: false, missedMate: false, allowedMate: null, hanging: null, freeCapture: null, fork: null, pin: null, threat: null };

afterEach(() => setLanguage("en"));

describe("move stories", () => {
  it("says what went wrong, what was better and why, in plain words", () => {
    expect(moveStory({ ...base, better: "g6", allowedMate: "Qxf7#" })).toBe("Careful! This let your opponent checkmate with Qxf7#. g6 was the stronger move. Tip: before each move, look at every check your opponent could give.");
    const queen = moveStory({ ...base, san: "Qxe5+", better: "Qe2", lossPiece: "q", hanging: { square: "e5", piece: "q" } });
    expect(queen).toContain("Your queen on e5 was left unprotected");
    expect(queen).toContain("about a queen's worth");
    expect(moveStory({ ...base, better: "Ra8#", missedMate: true, lossPiece: "q" })).toContain("You had checkmate with Ra8#!");
    expect(moveStory({ ...base, verdict: "mistake", better: "Nxe5", freeCapture: { square: "e5", piece: "n" } })).toContain("Nxe5 would have won a free knight.");
    expect(moveStory({ ...base, verdict: "inaccuracy", better: "Nc7+", fork: ["k", "r"] })).toBe("Nc7+ was a fork: one piece attacking two at once.");
  });

  it("tells good moves and the opponent's slips as chances", () => {
    expect(moveStory({ ...base, verdict: "good", captured: "b" })).toBe("Nice, you took a bishop.");
    expect(moveStory({ ...base, verdict: "good", mate: true, check: true })).toBe(copy.analysis.explain.mate);
    expect(moveStory({ ...base, hanging: { square: "f6", piece: "n" } }, false)).toBe("Your opponent left their knight on f6 unprotected. Can you take it?");
    expect(moveStory({ ...base, verdict: "good" }, false)).toBe(copy.analysis.explain.opponent);
  });

  it("works in Hindi, and the key-moment card prefers the coach note, then the story", () => {
    setLanguage("hi");
    expect(moveStory({ ...base, better: "g6", hanging: { square: "e5", piece: "q" }, lossPiece: "q" })).toContain("e5 पर आपका मोहरा (रानी)");
    setLanguage("en");
    const facts = { ...base, better: "g6" };
    expect(keyMomentText({ kind: "mistake", verdict: "blunder", better: "g6", tags: [], facts }, "Coach says hi")).toBe("Coach says hi");
    expect(keyMomentText({ kind: "mistake", verdict: "blunder", better: "g6", tags: [], facts })).toContain("g6 was the stronger move.");
  });
});
