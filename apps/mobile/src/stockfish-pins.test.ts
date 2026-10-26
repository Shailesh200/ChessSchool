import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const script = readFileSync(path.join(root, "scripts/fetch-stockfish.sh"), "utf8");
const docs = readFileSync(path.join(root, "STOCKFISH.md"), "utf8");

const PIN_NAMES = ["TARBALL_SHA256", "NNUE_BIG_SHA256", "NNUE_SMALL_SHA256"] as const;

describe("Stockfish fetch pins", () => {
  it("keeps each SHA-256 as one 64-hex constant, documented in STOCKFISH.md", () => {
    for (const name of PIN_NAMES) {
      const assignments = [...script.matchAll(new RegExp(`^${name}="([0-9a-f]+)"`, "gm"))];
      expect(assignments, name).toHaveLength(1);
      const hex = assignments[0]![1]!;
      expect(hex, name).toMatch(/^[0-9a-f]{64}$/);
      // The literal digest appears only on that assignment, not copied elsewhere in the script.
      expect(script.split(hex).length - 1, name).toBe(1);
      expect(docs, `${name} missing from STOCKFISH.md`).toContain(hex);
    }
  });
});
