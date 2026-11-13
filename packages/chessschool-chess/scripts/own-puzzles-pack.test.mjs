import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PACK_VERSION, THEMES } from "./generate-own-puzzles.mjs";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "../data");
const buckets = Array.from({ length: 16 }, (_, i) => 400 + i * 100);

function load(name) {
  return JSON.parse(readFileSync(join(dataDir, name), "utf8"));
}

function assertPuzzle(p) {
  expect(typeof p.id).toBe("string");
  expect(p.id.length).toBeGreaterThan(0);
  expect(typeof p.fen).toBe("string");
  expect(Array.isArray(p.moves)).toBe(true);
  expect(p.moves.length).toBeGreaterThanOrEqual(2);
  expect(p.moves.every((m) => typeof m === "string")).toBe(true);
  expect(typeof p.rating).toBe("number");
  expect(Array.isArray(p.themes)).toBe(true);
  expect(p.themes.length).toBeGreaterThan(0);
  for (const theme of p.themes) expect(THEMES).toContain(theme);
}

describe("own puzzle pack files", () => {
  const pack = load("own-puzzles.json");
  const fallback = load("own-puzzles-fallback.json");

  it("uses one version string and the Puzzle shape", () => {
    expect(pack.version).toBe(PACK_VERSION);
    expect(fallback.version).toBe(pack.version);
    expect(pack.puzzles.length).toBeGreaterThan(100);
    for (const p of pack.puzzles) assertPuzzle(p);
    for (const p of fallback.puzzles) assertPuzzle(p);
  });

  it("keeps every fallback puzzle inside the pack and covers every bucket and theme", () => {
    const ids = new Set(pack.puzzles.map((p) => p.id));
    for (const p of fallback.puzzles) expect(ids.has(p.id), p.id).toBe(true);
    expect(fallback.puzzles.length).toBeGreaterThanOrEqual(80);
    expect(fallback.puzzles.length).toBeLessThanOrEqual(120);
    for (const b of buckets) {
      expect(fallback.puzzles.some((p) => Math.floor(p.rating / 100) * 100 === b), `bucket ${b}`).toBe(true);
    }
    for (const theme of THEMES) {
      expect(fallback.puzzles.some((p) => p.themes.includes(theme)), theme).toBe(true);
    }
  });
});
