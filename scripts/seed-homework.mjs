/**
 * FALLBACK homework seeder (no CSV needed) — derives the `homework_lessons` pool
 * from puzzles already in the `lessons` table, bucketed by routine type. Runs in
 * `db:fresh` so local dev always has homework.
 *
 * For a homework pool that's DISTINCT from the curriculum puzzles, use
 * `pnpm db:import-homework <lichess_db_puzzle.csv[.zst]>` instead — it pulls a
 * separate slice of puzzles straight from the Lichess DB.
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
  let made = 0;
  const emit = (concept, steps) => {
    insert.run(
      `hw-${type}-${made + 1}`,
      type,
      concept === "tactics" ? `${LABEL[type]} #${made + 1}` : `${LABEL[type]}: ${concept}`,
      `${steps.length}-puzzle ${concept} session`,
      EMOJI[type],
      concept, // tag = topic, for "already learned" filtering
      15,
      JSON.stringify(steps.map((s, j) => ({ ...s, id: `s${j}` }))),
      made,
    );
    made++;
    total++;
  };
  // Single-concept sessions per source tag this type covers.
  const concepts = tags.filter((t) => (byTag.get(t)?.length ?? 0) >= 2);
  if (concepts.length) {
    for (const concept of concepts) {
      const pool = shuffle([...(byTag.get(concept) ?? [])]);
      for (let i = 0; i + 2 <= pool.length && made < MAX_PER_TYPE; i += PUZZLES_PER) {
        emit(concept, pool.slice(i, i + PUZZLES_PER));
      }
    }
  } else {
    // Sparse local seed: fall back to mixed puzzles so the type still has homework.
    const pool = shuffle([...allSteps]);
    for (let i = 0; i + 2 <= pool.length && made < MAX_PER_TYPE; i += PUZZLES_PER) {
      emit("tactics", pool.slice(i, i + PUZZLES_PER));
    }
  }
  console.log(`  ${EMOJI[type]} ${type}: ${made} sessions`);
}

console.log(`✓ Seeded ${total} homework lessons across ${Object.keys(TYPE_TAGS).length} types.`);
db.close();
