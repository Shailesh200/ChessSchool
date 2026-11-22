import { describe, expect, it } from "vitest";
import { BOT_BACKDROPS, botBackdrop, CARD_BACKDROPS, LESSON_BACKDROP, MOTIFS, PUZZLE_BACKDROPS, puzzleBackdrop, TABS_BACKDROP, TILES, type Backdrop } from "./backdrops";

const all: Backdrop[] = [TABS_BACKDROP, LESSON_BACKDROP, ...Object.values(BOT_BACKDROPS), ...PUZZLE_BACKDROPS, ...Object.values(CARD_BACKDROPS)];

describe("backdrops", () => {
  it("gives tabs, lessons and every bot their own art", () => {
    const ids = new Set(all.map((b) => b.id));
    expect(ids.size).toBe(all.length);
    expect(TABS_BACKDROP.tile.id).not.toBe(LESSON_BACKDROP.tile.id);
    for (const bot of ["pip", "rooky", "bishop", "ivy", "atlas", "raja", "cody"]) expect(botBackdrop(bot).id).toBe(`bot-${bot}`);
    const looks = new Set(Object.values(BOT_BACKDROPS).map((b) => `${b.tile.id}:${b.motifs[0].shape}`));
    expect(looks.size).toBe(Object.keys(BOT_BACKDROPS).length);
  });

  it("picks the same art for the same id, and varies it across puzzles", () => {
    expect(botBackdrop("someone-new")).toBe(botBackdrop("someone-new"));
    expect(puzzleBackdrop("abc12")).toBe(puzzleBackdrop("abc12"));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => puzzleBackdrop(`p${i}`).id));
    expect(seen.size).toBe(PUZZLE_BACKDROPS.length);
  });

  it("stays faint and only uses shapes that exist", () => {
    for (const b of all) {
      expect(b.o).toBeGreaterThan(0);
      expect(b.o).toBeLessThanOrEqual(0.25);
      expect(TILES[b.tile.id]).toBe(b.tile);
      for (const m of b.motifs) {
        expect(MOTIFS[m.shape].length).toBeGreaterThan(0);
        expect(m.o).toBeLessThanOrEqual(0.15);
        expect(m.x).toBeGreaterThanOrEqual(0);
        expect(m.x).toBeLessThanOrEqual(1);
      }
    }
    for (const shapes of Object.values(MOTIFS)) for (const d of shapes) expect(d).not.toMatch(/NaN|undefined/);
  });
});
