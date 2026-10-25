import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { applySeedStatements, readSeedSql } from "../db/seed-file.mjs";

/**
 * Same content load as `pnpm db:load-seed` (the seed half of `db:provision`).
 * The database is a temp SQLite file. `readSeedSql` gunzips `db/seed.sql.gz`.
 */
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Step = {
  kind?: string;
  solution?: string[];
  promotion?: string;
  promotions?: Record<string, string>;
};

function provisionLocal() {
  const dir = mkdtempSync(join(tmpdir(), "promo-provision-"));
  dirs.push(dir);
  const dbPath = join(dir, "local.db");
  if (dbPath.startsWith("libsql:") || dbPath.includes("://")) {
    throw new Error(`refusing non-file database ${dbPath}`);
  }
  const sqlite = new Database(dbPath);
  applySeedStatements(sqlite, readSeedSql());
  return sqlite;
}

function promotingSteps(steps: Step[]) {
  const hits: { key: string; piece: string }[] = [];
  for (const step of steps) {
    if (
      step.promotion === "q" ||
      step.promotion === "r" ||
      step.promotion === "b" ||
      step.promotion === "n"
    ) {
      const key = step.solution?.[0] ?? "";
      hits.push({ key, piece: step.promotion });
    }
    for (const [key, piece] of Object.entries(step.promotions ?? {})) {
      if (piece === "q" || piece === "r" || piece === "b" || piece === "n") {
        hits.push({ key, piece });
      }
    }
  }
  return hits;
}

describe("provisioned seed promotion", () => {
  it("keeps the promotion piece on a step loaded from seed.sql.gz", () => {
    const db = provisionLocal();
    try {
      const lessons = db.prepare("SELECT id, steps FROM lessons").all() as {
        id: string;
        steps: string;
      }[];
      const homework = db.prepare("SELECT id, steps FROM homework_lessons").all() as {
        id: string;
        steps: string;
      }[];
      const tagged: { id: string; piece: string }[] = [];
      for (const row of [...lessons, ...homework]) {
        const steps = JSON.parse(row.steps) as Step[];
        for (const hit of promotingSteps(steps)) {
          tagged.push({ id: row.id, piece: hit.piece });
        }
      }
      expect(tagged.length).toBeGreaterThan(0);
      expect(tagged.some((row) => row.piece === "q")).toBe(true);
      expect(tagged.some((row) => row.piece === "n")).toBe(true);
      expect(tagged.some((row) => row.piece === "r")).toBe(true);

      const queenLesson = db
        .prepare("SELECT steps FROM lessons WHERE id = ?")
        .get("pre-moves-promotion") as { steps: string };
      const queenSteps = JSON.parse(queenLesson.steps) as Step[];
      const queen = queenSteps.find((step) => step.solution?.includes("e7:e8"));
      expect(queen?.promotion).toBe("q");
    } finally {
      db.close();
    }
  }, 120_000);
});
