import { describe, expect, it } from "vitest";
import { agreeAi, aiAgreed, aiExplainOn, answerPractice, createInitialState, completeNode, importGame, importedRecord, mergeProgress, recordPuzzle, recordReviewedGame, sanitizeProgress, setAiExplain, type GameRecord } from "./progress";
import { mistakeItems, practiceRequest } from "./review";
import { lessonSkill, mergeSkills, rankedSkills, sanitizeSkills, skillsAfter, tagSkills, themeSkills, weakSkills } from "./skills";
import { switchProfile, freshSlice } from "./profiles";

const NOW = new Date("2026-11-03T10:00:00");
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const game = (id: string): GameRecord => ({ id, endedAt: 1, setup: { opponent: { kind: "online" }, you: "w", time: "none", startFen: START, takebacks: false, askPromotion: true }, history: ["e4"], winner: null, reason: "imported" });

describe("skills", () => {
  it("moves a score up on success and down on a miss, and ranks weakest first", () => {
    let s = skillsAfter({}, ["fork"], true);
    expect(s.fork).toEqual({ s: 60, n: 1 });
    s = skillsAfter(s, ["fork"], true);
    expect(s.fork!.s).toBe(70);
    s = skillsAfter(s, ["pin"], false);
    expect(rankedSkills(s).map((x) => x.id)).toEqual(["pin", "fork"]);
    expect(weakSkills(s)).toEqual(["pin"]);
    expect(skillsAfter(s, [], false)).toBe(s);
  });

  it("maps lessons, puzzle themes and mistake tags to skills", () => {
    expect([lessonSkill("forks"), lessonSkill("practice03Pin"), lessonSkill("lucena"), lessonSkill("meet")]).toEqual(["fork", "pin", "endgame", null]);
    expect(themeSkills(["mateIn2", "mateIn1", "promotion"])).toEqual(["mate"]);
    expect(tagSkills(["freePiece", "hanging", "backRank"])).toEqual(["hanging", "backRank"]);
  });

  it("cleans and merges synced skills", () => {
    expect(sanitizeSkills({ fork: { s: 500, n: 2.5 }, nope: { s: 1, n: 1 } })).toEqual({ fork: { s: 100, n: 2 } });
    expect(sanitizeSkills("x")).toBeUndefined();
    expect(mergeSkills({ fork: { s: 10, n: 1 } }, { fork: { s: 90, n: 5 }, pin: { s: 50, n: 1 } })).toEqual({ fork: { s: 90, n: 5 }, pin: { s: 50, n: 1 } });
  });

  it("updates from lessons, puzzles and practice, and survives sync", () => {
    let st = completeNode(createInitialState("g"), "meet", NOW);
    expect(st.progress.skills).toBeUndefined();
    st = recordPuzzle(st, { id: "p1", solved: false, newRating: 590, themes: ["fork"] }, NOW);
    expect(st.progress.skills?.fork).toEqual({ s: 40, n: 1 });
    st = answerPractice(st, "pins:2", true, "2026-11-03");
    expect(st.progress.skills?.pin?.n).toBe(1);
    expect(st.review["pins:2"]).toBeTruthy();
    const back = sanitizeProgress(mergeProgress(st.progress, { ...st.progress, skills: undefined }), null);
    expect(back.skills).toEqual(st.progress.skills);
    expect(practiceRequest({}, {}, "2026-11-03", st.progress.skills).weak).toEqual(["fork", "pin"]);
  });

  it("turns reviewed-game mistakes into practice once per game", () => {
    const rec = importedRecord({ id: "lichess:x", white: "a", black: "b", result: "0-1", endedAt: 7, startFen: START, moves: ["e4"], you: "b" });
    expect(rec).toMatchObject({ winner: "b", setup: { opponent: { kind: "online" }, you: "b" } });
    expect(JSON.stringify(rec)).not.toContain('"a"');
    let st = importGame(createInitialState("g"), game("lichess:abc"));
    expect(st.progress.games.played).toBe(0);
    const m = { fen: START, from: "e2", to: "e4", better: "e4", tags: ["hanging"] };
    st = recordReviewedGame(st, "lichess:abc", [m], "2026-11-03");
    expect(st.progress.skills?.hanging?.s).toBe(40);
    expect(st.mistakes).toHaveLength(1);
    expect(recordReviewedGame(st, "lichess:abc", [m], "2026-11-03")).toBe(st);
    expect(mistakeItems(st.mistakes, st.review, "2026-11-03")).toEqual([]);
    const [item] = mistakeItems(st.mistakes, st.review, "2026-11-04");
    expect(item!.step).toMatchObject({ kind: "move", fen: START, goal: { type: "exact", from: "e2", to: "e4" } });
    st = answerPractice(st, item!.ref, false, "2026-11-04");
    expect(st.progress.skills?.hanging?.n).toBe(2);
  });
});

describe("AI explanations setting", () => {
  it("is on for adults, off for a child until turned on, and consent is per profile", () => {
    let st = createInitialState("g");
    expect(aiExplainOn(st)).toBe(true);
    st = agreeAi(st);
    expect(aiAgreed(st)).toBe(true);
    st = switchProfile(st, "kid1", freshSlice(st, "Kid", "cody"));
    expect(aiExplainOn(st)).toBe(false);
    expect(aiAgreed(st)).toBe(false);
    st = setAiExplain(st, true);
    expect(aiExplainOn(st)).toBe(true);
    expect(aiExplainOn(switchProfile(st, null))).toBe(true);
  });
});
