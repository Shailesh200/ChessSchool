/**
 * Resolve `DATABASE_URL` for the web app and Drizzle Kit.
 *
 * Local dev, `next build`, and CI's Playwright server all run without a Turso
 * URL. `next build` and `next start` set `NODE_ENV=production` while still
 * using `file:local.db`, so production mode alone cannot be the gate.
 *
 * Vercel sets `VERCEL=1` for Production and Preview, at build and at runtime.
 * A missing URL there used to open an ephemeral SQLite file and hide a
 * misnamed env var. When `VERCEL` is set, the URL must be `libsql:` or
 * `https:`. The thrown error names `DATABASE_URL` and includes neither the
 * URL nor `DATABASE_AUTH_TOKEN`.
 */

export const LOCAL_DATABASE_URL = "file:local.db";

export type DatabaseUrlEnv = {
  DATABASE_URL?: string;
  VERCEL?: string;
  /** Other env vars may be present (including secrets). They are not read. */
  [key: string]: string | undefined;
};

const MISSING_URL_ERROR =
  "DATABASE_URL is required when VERCEL is set. Set DATABASE_URL to a libsql: or https: URL. Refusing to open a local SQLite file.";

const INVALID_URL_ERROR =
  "DATABASE_URL must be a libsql: or https: URL when VERCEL is set. Refusing to open a local SQLite file.";

/** True for Turso-style hosted URLs (`libsql:` or `https:`). */
export function isHostedDatabaseUrl(url: string): boolean {
  return url.startsWith("libsql:") || url.startsWith("https:");
}

/** True when Drizzle should use the Turso driver (hosted URL, or local `http:`). */
export function isRemoteDriverUrl(url: string): boolean {
  return isHostedDatabaseUrl(url) || url.startsWith("http:");
}

/**
 * Hosted deployments are exactly the Vercel environments (`VERCEL` set).
 * `ALLOW_LOCAL_DB` is intentionally not consulted — an opt-in on the build
 * script would also run during the Vercel build.
 */
export function requiresHostedDatabase(env: DatabaseUrlEnv): boolean {
  return Boolean(env.VERCEL);
}

export function resolveDatabaseUrl(env: DatabaseUrlEnv = process.env): string {
  const raw = env.DATABASE_URL?.trim() ?? "";
  if (requiresHostedDatabase(env)) {
    if (!raw) throw new Error(MISSING_URL_ERROR);
    if (!isHostedDatabaseUrl(raw)) throw new Error(INVALID_URL_ERROR);
    return raw;
  }
  if (!raw) return LOCAL_DATABASE_URL;
  if (
    raw.startsWith("libsql:") ||
    raw.startsWith("http:") ||
    raw.startsWith("https:") ||
    raw.startsWith("file:")
  ) {
    return raw;
  }
  return `file:${raw}`;
}
