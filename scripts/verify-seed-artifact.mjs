#!/usr/bin/env node
/**
 * Fail when the committed curriculum seed is too large or still plain SQL.
 *
 *   node scripts/verify-seed-artifact.mjs
 *
 * Limits:
 *   - apps/web/db/seed.sql.gz must exist, be gzip, and be ≤ 90 MB (90 MiB)
 *   - no tracked path whose basename is seed.sql (uncompressed)
 */
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_GZIP_MAX_BYTES,
  SEED_SQL_GZ_PATH,
  evaluateSeedArtifact,
  formatSeedBytes,
} from "../apps/web/db/seed-file.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot });
  if (result.error) {
    console.error(`✗ git ls-files failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    const detail = result.stderr?.toString("utf8").trim() || "git ls-files failed";
    console.error(`✗ ${detail}`);
    process.exit(1);
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

const gzPresent = existsSync(SEED_SQL_GZ_PATH);
let gzBytes = 0;
let gzipMagic = false;
if (gzPresent) {
  gzBytes = statSync(SEED_SQL_GZ_PATH).size;
  const fd = openSync(SEED_SQL_GZ_PATH, "r");
  try {
    const header = Buffer.alloc(2);
    readSync(fd, header, 0, 2, 0);
    gzipMagic = header[0] === 0x1f && header[1] === 0x8b;
  } finally {
    closeSync(fd);
  }
}

const problems = evaluateSeedArtifact({
  gzPresent,
  gzBytes,
  gzipMagic,
  trackedFiles: trackedFiles(),
  maxBytes: SEED_GZIP_MAX_BYTES,
});

if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  process.exit(1);
}

console.log(
  `✓ apps/web/db/seed.sql.gz is ${gzBytes} bytes (${formatSeedBytes(gzBytes)}), within the 90 MB limit (${SEED_GZIP_MAX_BYTES} bytes). No uncompressed seed.sql is committed.`,
);
