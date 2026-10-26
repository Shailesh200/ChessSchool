import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  SEED_GZIP_MAX_BYTES,
  SEED_SQL_GZ_PATH,
  applySeedStatements,
  gzipSeedSql,
  readSeedSql,
} from "./seed-file.mjs";

function insertCounts(sql: string) {
  const counts = new Map<string, number>();
  for (const line of sql.split("\n")) {
    const match = /^INSERT INTO ([A-Za-z0-9_]+) /.exec(line);
    if (!match) continue;
    const table = match[1];
    counts.set(table, (counts.get(table) ?? 0) + 1);
  }
  return counts;
}

describe("committed seed.sql.gz", () => {
  it("imports into a fresh in-memory database with the same row counts as the SQL", () => {
    const gz = readFileSync(SEED_SQL_GZ_PATH);
    expect(gz.length).toBeGreaterThan(1024);
    expect(gz.length).toBeLessThanOrEqual(SEED_GZIP_MAX_BYTES);
    expect(gz[0]).toBe(0x1f);
    expect(gz[1]).toBe(0x8b);

    const sql = readSeedSql();
    expect(sql.startsWith("-- ChessSchool seed.")).toBe(true);
    expect(Buffer.compare(gzipSeedSql(sql), gz)).toBe(0);

    const expected = insertCounts(sql);
    expect(expected.get("lessons") ?? 0).toBeGreaterThan(0);
    expect(expected.get("homework_lessons") ?? 0).toBeGreaterThan(0);

    const db = new Database(":memory:");
    try {
      const statements = applySeedStatements(db, sql);
      expect(statements).toBeGreaterThan(0);
      const summary: string[] = [];
      for (const [table, count] of expected) {
        const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
          c: number;
        };
        expect(row.c, table).toBe(count);
        summary.push(`${count} ${table}`);
      }
      console.log(`seed.sql.gz import: ${summary.join(" · ")}`);
    } finally {
      db.close();
    }
  }, 180_000);
});
