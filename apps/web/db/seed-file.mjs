/**
 * Committed curriculum snapshot: `apps/web/db/seed.sql.gz`.
 *
 * Readers gunzip this file. Writers gzip it. The bytes are deterministic:
 * zlib level 9, gzip mtime 0, no original filename, OS byte pinned to 255.
 * Regenerating the same SQL produces the same artifact, so a seed diff is a
 * real content change.
 *
 * Node's built-in zlib only — no extra dependencies.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

/** Fixed deflate level. XFL in the gzip header follows this level. */
export const SEED_GZIP_LEVEL = 9;

/**
 * CI limit for the committed artifact. 90 MiB, under GitHub's 100 MB blob cap.
 * "Over 90 MB" means strictly greater than this value.
 */
export const SEED_GZIP_MAX_BYTES = 90 * 1024 * 1024;

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `apps/web/db/seed.sql.gz`, resolved from this file, not `process.cwd()`. */
export const SEED_SQL_GZ_PATH = join(WEB_ROOT, "db/seed.sql.gz");

/** `apps/web/local.db`, resolved from this file, not `process.cwd()`. */
export const LOCAL_DB_PATH = join(WEB_ROOT, "local.db");

/**
 * Gzip `sql` with no mtime and no filename. `sql` may be a string or the
 * exact file bytes (a Buffer). The OS byte is forced to 255 so Linux and
 * macOS zlib builds match.
 *
 * @param {string | Buffer} sql
 * @returns {Buffer}
 */
export function gzipSeedSql(sql) {
  const input = Buffer.isBuffer(sql) ? sql : Buffer.from(sql, "utf8");
  const gz = Buffer.from(gzipSync(input, { level: SEED_GZIP_LEVEL, mtime: 0 }));
  // RFC 1952 header: magic, method, flags, mtime (4), xfl, os.
  // Flag bits 2–4 (FEXTRA, FNAME, FCOMMENT) must stay unset so the header
  // stays 10 bytes and carries no filename.
  if (gz.length < 10 || gz[0] !== 0x1f || gz[1] !== 0x8b) {
    throw new Error("zlib gzip header was not produced");
  }
  if ((gz[3] & 0x1c) !== 0) {
    throw new Error("gzip header includes a filename, comment, or extra field");
  }
  gz[9] = 255;
  return gz;
}

/**
 * @param {Buffer | Uint8Array} gz
 * @returns {string}
 */
export function gunzipSeedSql(gz) {
  return gunzipSync(gz).toString("utf8");
}

/**
 * @param {string} [path]
 * @returns {string}
 */
export function readSeedSql(path = SEED_SQL_GZ_PATH) {
  return gunzipSeedSql(readFileSync(path));
}

/**
 * Write deterministic gzip. Replaces `path` via a temp file in the same directory.
 *
 * @param {string | Buffer} sql
 * @param {string} [path]
 * @returns {Buffer}
 */
export function writeSeedSql(sql, path = SEED_SQL_GZ_PATH) {
  const gz = gzipSeedSql(sql);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, gz);
  renameSync(tmp, path);
  return gz;
}

/**
 * Same statement split the loaders have always used: one statement per
 * `;\n`, dropping the leading comment and PRAGMA lines.
 *
 * @param {string} raw
 * @returns {string[]}
 */
export function splitSeedStatements(raw) {
  return raw
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        statement && !statement.startsWith("--") && !/^PRAGMA/i.test(statement),
    );
}

/**
 * Apply seed SQL with better-sqlite3 (local file or `:memory:`).
 * Foreign keys are off for the load, matching `db:load-seed`.
 *
 * @param {{ pragma: Function, transaction: Function, exec: Function }} db
 * @param {string} sql
 * @returns {number}
 */
export function applySeedStatements(db, sql) {
  const statements = splitSeedStatements(sql);
  db.pragma("foreign_keys = OFF");
  const tx = db.transaction(() => {
    for (const statement of statements) db.exec(`${statement};`);
  });
  tx();
  db.pragma("foreign_keys = ON");
  return statements.length;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatSeedBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Problems that should fail CI. Empty means the artifact is acceptable.
 *
 * @param {{
 *   gzPresent: boolean,
 *   gzBytes?: number,
 *   gzipMagic?: boolean,
 *   trackedFiles?: string[],
 *   maxBytes?: number,
 * }} input
 * @returns {string[]}
 */
export function evaluateSeedArtifact(input) {
  const maxBytes = input.maxBytes ?? SEED_GZIP_MAX_BYTES;
  const problems = [];
  if (!input.gzPresent) {
    problems.push("apps/web/db/seed.sql.gz is missing.");
  } else if (!input.gzipMagic) {
    problems.push(
      "apps/web/db/seed.sql.gz is not gzip (missing 1f 8b header). An uncompressed seed.sql or a Git LFS pointer must not be committed under that name.",
    );
  } else if ((input.gzBytes ?? 0) > maxBytes) {
    const bytes = input.gzBytes ?? 0;
    problems.push(
      `apps/web/db/seed.sql.gz is ${bytes} bytes (${formatSeedBytes(bytes)}), over the 90 MB limit (${maxBytes} bytes).`,
    );
  }
  for (const file of input.trackedFiles ?? []) {
    if (file === "seed.sql" || file.endsWith("/seed.sql")) {
      problems.push(
        `Uncompressed ${file} is committed. Commit apps/web/db/seed.sql.gz instead.`,
      );
    }
  }
  return problems;
}
