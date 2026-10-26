/**
 * Production Turso hostnames only — no scheme, path, userinfo, or token.
 *
 * Same name and value as `PRODUCTION_DB_HOSTS` in PR #8
 * (`apps/web/db/database-url.ts` on `luffy/b4-db-fail-closed`). That branch is
 * not in this stack. Whichever of #8 and #34 lands second should keep a single
 * definition and import it from the other.
 *
 * Source: README operator links (`chessschool-shailesh200` in ap-south-1).
 */
export const PRODUCTION_DB_HOSTS = ["chessschool-shailesh200.aws-ap-south-1.turso.io"];

export function isProductionDbHost(hostname) {
  if (!hostname) return false;
  const normalized = String(hostname).toLowerCase().replace(/\.+$/, "");
  return PRODUCTION_DB_HOSTS.some((host) => host.toLowerCase() === normalized);
}
