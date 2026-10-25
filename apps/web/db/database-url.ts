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
 *
 * `VERCEL_ENV=production` must use the production Turso hostname below.
 * Preview and development must not. The hostname is public (README operator
 * links); it is not a URL and it contains no credentials.
 */

export const LOCAL_DATABASE_URL = "file:local.db";

/**
 * Production Turso hostnames only — no scheme, path, userinfo, or token.
 * Source: README operator links (`chessschool-shailesh200` in ap-south-1).
 */
export const PRODUCTION_DB_HOSTS = [
  "chessschool-shailesh200.aws-ap-south-1.turso.io",
] as const;

export type DatabaseUrlEnv = {
  DATABASE_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  /** Other env vars may be present (including secrets). They are not read. */
  [key: string]: string | undefined;
};

const PRODUCTION_HOST_LIST = PRODUCTION_DB_HOSTS.join(", ");

const MISSING_URL_ERROR =
  "DATABASE_URL is required when VERCEL is set. Set DATABASE_URL to a libsql: or https: URL. Refusing to open a local SQLite file.";

const INVALID_URL_ERROR =
  "DATABASE_URL must be a libsql: or https: URL when VERCEL is set. Refusing to open a local SQLite file.";

const PRODUCTION_HOST_REQUIRED_ERROR = `DATABASE_URL hostname must be the production Turso host (${PRODUCTION_HOST_LIST}) when VERCEL_ENV is production.`;

const PREVIEW_PROD_HOST_ERROR = `DATABASE_URL must not use the production Turso host (${PRODUCTION_HOST_LIST}) when VERCEL_ENV is not production. Point Preview and development at the staging database.`;

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

function isProductionDbHost(hostname: string): boolean {
  return PRODUCTION_DB_HOSTS.some((host) => host === hostname);
}

/**
 * Hostname only. `libsql:` is rewritten to `https:` so the WHATWG parser can
 * read it. The thrown error never includes the input URL.
 */
function databaseHostname(url: string): string {
  const parseable = url.startsWith("libsql:")
    ? `https:${url.slice("libsql:".length)}`
    : url;
  let hostname = "";
  try {
    hostname = new URL(parseable).hostname;
  } catch {
    throw new Error(INVALID_URL_ERROR);
  }
  const normalized = hostname.toLowerCase().replace(/\.+$/, "");
  if (!normalized) throw new Error(INVALID_URL_ERROR);
  return normalized;
}

/**
 * On Vercel, production may use only the production host. Every other
 * `VERCEL_ENV` (preview, development, or unset) must not use it.
 */
function assertVercelDatabaseHost(url: string, vercelEnv: string | undefined): void {
  const productionHost = isProductionDbHost(databaseHostname(url));
  if (vercelEnv === "production") {
    if (!productionHost) throw new Error(PRODUCTION_HOST_REQUIRED_ERROR);
    return;
  }
  if (productionHost) throw new Error(PREVIEW_PROD_HOST_ERROR);
}

export function resolveDatabaseUrl(env: DatabaseUrlEnv = process.env): string {
  const raw = env.DATABASE_URL?.trim() ?? "";
  if (requiresHostedDatabase(env)) {
    if (!raw) throw new Error(MISSING_URL_ERROR);
    if (!isHostedDatabaseUrl(raw)) throw new Error(INVALID_URL_ERROR);
    assertVercelDatabaseHost(raw, env.VERCEL_ENV);
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
