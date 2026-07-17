import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {Object} BankPuzzle
 * @property {string} id
 * @property {string} stage
 * @property {string[]} concepts
 * @property {number} rating
 * @property {'authored'|'adapted'|'reference'} source
 * @property {string} [sourceRef]
 * @property {string} fen
 * @property {string[]} line
 * @property {{ setup?: string, success?: string, hint?: string }} [coach]
 */

/**
 * Load all JSONL puzzle records from a bank directory tree.
 * @param {string} bankDir
 * @returns {BankPuzzle[]}
 */
export function loadBank(bankDir) {
  if (!existsSync(bankDir)) return [];

  const puzzles = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".jsonl")) {
        const text = readFileSync(p, "utf8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          puzzles.push(JSON.parse(trimmed));
        }
      }
    }
  };
  walk(bankDir);
  return puzzles;
}

/** @param {BankPuzzle[]} puzzles */
export function bucketPuzzles(puzzles) {
  /** @type {Map<string, BankPuzzle[]>} */
  const buckets = new Map();
  for (const p of puzzles) {
    const concept = p.concepts[0] ?? "unknown";
    const key = `${p.stage}:${concept}`;
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.rating - b.rating);
  }
  return buckets;
}
