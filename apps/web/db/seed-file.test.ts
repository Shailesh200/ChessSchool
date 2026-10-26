import { describe, expect, it } from "vitest";
import {
  SEED_GZIP_MAX_BYTES,
  evaluateSeedArtifact,
  formatSeedBytes,
  gunzipSeedSql,
  gzipSeedSql,
} from "./seed-file.mjs";

describe("gzipSeedSql", () => {
  it("is deterministic and omits mtime and filename", () => {
    const sql = "-- ChessSchool seed.\nINSERT INTO lessons (id) VALUES ('a');\n";
    const first = gzipSeedSql(sql);
    const second = gzipSeedSql(Buffer.from(sql, "utf8"));
    expect(Buffer.compare(first, second)).toBe(0);
    expect(first[0]).toBe(0x1f);
    expect(first[1]).toBe(0x8b);
    expect(first[3] & 0x1c).toBe(0);
    expect(first.readUInt32LE(4)).toBe(0);
    expect(first[9]).toBe(255);
    expect(gunzipSeedSql(first)).toBe(sql);
  });
});

describe("evaluateSeedArtifact", () => {
  const ok = {
    gzPresent: true,
    gzBytes: 1024,
    gzipMagic: true,
    trackedFiles: ["apps/web/db/seed.sql.gz"],
  };

  it("accepts a gzip artifact at exactly 90 MB with no plain seed.sql", () => {
    expect(evaluateSeedArtifact({ ...ok, gzBytes: SEED_GZIP_MAX_BYTES })).toEqual([]);
  });

  it("fails when seed.sql.gz is over 90 MB", () => {
    const bytes = SEED_GZIP_MAX_BYTES + 1;
    const problems = evaluateSeedArtifact({ ...ok, gzBytes: bytes });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/over the 90 MB limit/);
    expect(problems[0]).toContain(String(bytes));
    expect(problems[0]).toContain(formatSeedBytes(bytes));
    expect(problems[0]).toContain(String(SEED_GZIP_MAX_BYTES));
  });

  it("fails when an uncompressed seed.sql is committed", () => {
    const problems = evaluateSeedArtifact({
      ...ok,
      trackedFiles: [
        "apps/web/db/seed.sql.gz",
        "apps/web/db/seed.sql",
        "seed.sql",
        "notes/seed.sql.bak",
      ],
    });
    expect(problems).toEqual([
      "Uncompressed apps/web/db/seed.sql is committed. Commit apps/web/db/seed.sql.gz instead.",
      "Uncompressed seed.sql is committed. Commit apps/web/db/seed.sql.gz instead.",
    ]);
  });

  it("fails when the gzip artifact is missing or not gzip", () => {
    expect(evaluateSeedArtifact({ ...ok, gzPresent: false })).toEqual([
      "apps/web/db/seed.sql.gz is missing.",
    ]);
    expect(evaluateSeedArtifact({ ...ok, gzipMagic: false })[0]).toMatch(/not gzip/);
  });
});
