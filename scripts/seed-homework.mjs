/**
 * Seed the dedicated homework pool (`homework_lessons`) from already-validated
 * curriculum puzzles, bucketed by routine type. Homework stays SEPARATE from the
 * school curriculum so daily homework never collides with serial progression.
 *
 * Flow:  pnpm db:fresh  [→ pnpm db:import-puzzles <file>]  → pnpm db:seed-homework → pnpm db:dump
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";

if (!existsSync("local.db")) {
  console.error("✗ local.db not found. Run `pnpm db:fresh` first.");
  process.exit(1);
}

// Routine type → curriculum tags it draws from.
const TYPE_TAGS = {
  warmup: ["capture", "piece", "check", "basics", "material"],
  practice: ["fork", "pin", "skewer", "discovered", "tactics", "doubleAttack", "deflection"],
  review: ["checkmate", "mate", "mateIn1", "mateIn2", "endgame"],
  reflection: ["opening", "promotion", "advantage", "defense", "strategy"],
};
const EMOJI = { warmup: "🤸", practice: "🎯", review: "🔍", reflection: "📝" };
const LABEL = { warmup: "Warmup", practice: "Tactics", review: "Checkmate review", reflection: "Reflection" };
const PUZZLES_PER = 4; // puzzles in one homework session
const MAX_PER_TYPE = 18; // ~2.5 weeks of daily rotation

const db = new Database("local.db");
db.exec(`CREATE TABLE IF NOT EXISTS homework_lessons (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '♟️',
  tag TEXT NOT NULL DEFAULT 'drill',
  xp INTEGER NOT NULL DEFAULT 20,
  steps TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);`);
const all = db.prepare("SELECT tag, steps FROM lessons").all();

// Flatten interactive move-steps grouped by tag.
const byTag = new Map();
for (const row of all) {
  let steps;
  try {
    steps = JSON.parse(row.steps);
  } catch {
    continue;
  }
  for (const s of steps) {
    if (s.kind === "move" && Array.isArray(s.solution) && s.solution.length && s.fen) {
      if (!byTag.has(row.tag)) byTag.set(row.tag, []);
      byTag.get(row.tag).push(s);
    }
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

db.exec("DELETE FROM homework_lessons");
const insert = db.prepare(
  "INSERT INTO homework_lessons (id, type, title, subtitle, emoji, tag, xp, steps, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
);

const allSteps = [...byTag.values()].flat();
let total = 0;
for (const [type, tags] of Object.entries(TYPE_TAGS)) {
  let pool = shuffle(tags.flatMap((t) => byTag.get(t) ?? []));
  // Fall back to any puzzles so every type always has homework (sparse local seed).
  if (pool.length < PUZZLES_PER * 2) pool = shuffle([...allSteps]);
  if (!pool.length) {
    console.warn(`  ⚠ no puzzles available for ${type}`);
    continue;
  }
  let made = 0;
  for (let i = 0; i < pool.length && made < MAX_PER_TYPE; i += PUZZLES_PER) {
    const chunk = pool.slice(i, i + PUZZLES_PER);
    if (chunk.length < 2) break; // need at least a couple of puzzles
    const steps = chunk.map((s, j) => ({ ...s, id: `s${j}`, tag: type }));
    insert.run(
      `hw-${type}-${made + 1}`,
      type,
      `${LABEL[type]} #${made + 1}`,
      `${chunk.length}-puzzle ${type} session`,
      EMOJI[type],
      type,
      15,
      JSON.stringify(steps),
      made,
    );
    made++;
    total++;
  }
  console.log(`  ${EMOJI[type]} ${type}: ${made} sessions`);
}

console.log(`✓ Seeded ${total} homework lessons across ${Object.keys(TYPE_TAGS).length} types.`);
db.close();
