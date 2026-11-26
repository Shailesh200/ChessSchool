import { describe, expect, it } from "vitest";
import { botArt, botMotion, gameMood, isCharacterBot, rankEmblem, type BotMood, type CharacterBot } from "./botArt";
import { RANKS } from "./progress";

const BOTS: CharacterBot[] = ["pip", "rooky", "bishop", "ivy", "atlas", "raja"];
const MOODS: BotMood[] = ["wait", "turn", "ahead", "behind", "won", "lost"];

describe("bot characters", () => {
  it("draws every bot in every mood as plain SVG the app can render", () => {
    for (const b of BOTS)
      for (const m of MOODS) {
        const { body, fx } = botArt(b, m);
        expect(body.startsWith("<svg")).toBe(true);
        // react-native-svg ignores CSS classes and styles, so neither may carry the drawing.
        expect(body).not.toMatch(/ class=| style=/);
        expect(fx).not.toMatch(/ class=| style=/);
      }
    expect(botArt("pip", "won").fx).toContain("I won?!");
    expect(botArt("raja", "wait").fx).toBe("");
    expect(isCharacterBot("cody")).toBe(false);
  });

  it("follows the game: result first, then whose turn, then who is ahead", () => {
    expect(gameMood({ result: "win", thinking: false, edge: 5 })).toBe("lost");
    expect(gameMood({ result: "loss", thinking: false, edge: -5 })).toBe("won");
    expect(gameMood({ result: null, thinking: true, edge: 5 })).toBe("turn");
    expect(gameMood({ result: null, thinking: false, edge: 3 })).toBe("ahead");
    expect(gameMood({ result: null, thinking: false, edge: -4 })).toBe("behind");
    expect(gameMood({ result: null, thinking: false, edge: 1 })).toBe("wait");
  });

  it("gives each bot its own rhythm that starts and ends at rest", () => {
    expect(botMotion("pip", "wait").ms).toBeLessThan(botMotion("raja", "wait").ms);
    for (const b of BOTS)
      for (const m of MOODS) {
        const { frames } = botMotion(b, m);
        expect(frames[0].at).toBe(0);
        expect(frames.at(-1)!.at).toBe(1);
      }
  });

  it("draws an emblem per rank, with the name banner only at full size", () => {
    for (const r of RANKS) {
      expect(rankEmblem(r.id, "Name")).toContain("NAME");
      expect(rankEmblem(r.id, "Name", { small: true })).not.toContain("NAME");
    }
  });
});
