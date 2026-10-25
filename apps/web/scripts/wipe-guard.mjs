/**
 * Shared refusal for db:wipe-users and db:remote-clean.
 * Prints hostnames only. Callers must not log DATABASE_URL or the auth token.
 */
import { databaseHostname } from "./seed-content.mjs";
import { isProductionDbHost } from "../db/production-db-hosts.mjs";

const HOSTED = ["libsql:", "https:", "http:"];

export function wipeTarget(url) {
  if (!url || url.startsWith("file:")) {
    return { hosted: false, hostname: "local.db" };
  }
  if (HOSTED.some((scheme) => url.startsWith(scheme))) {
    return { hosted: true, hostname: databaseHostname(url) };
  }
  return { hosted: false, hostname: null, invalid: true };
}

/**
 * Production hosts are refused even when CONFIRM is `WIPE:<that host>`.
 * Other hosts require CONFIRM to equal `WIPE:` plus the exact hostname.
 * The local file (no hosted URL) uses the hostname `local.db`.
 */
export function assertCanWipe(url, confirm) {
  const target = wipeTarget(url);
  if (target.invalid) {
    return {
      ok: false,
      lines: ["Refusing to wipe: DATABASE_URL is not a hosted or file URL."],
    };
  }
  if (target.hosted && !target.hostname) {
    return {
      ok: false,
      lines: ["Refusing to wipe: DATABASE_URL has no hostname."],
    };
  }
  const hostname = target.hostname;
  if (isProductionDbHost(hostname)) {
    return {
      ok: false,
      hostname,
      lines: [
        `Refusing to wipe production host ${hostname}.`,
        "Hosts in PRODUCTION_DB_HOSTS cannot be wiped.",
        "No rows were deleted.",
      ],
    };
  }
  if (confirm !== `WIPE:${hostname}`) {
    return {
      ok: false,
      hostname,
      lines: [
        `Refusing to wipe ${hostname}.`,
        `Set CONFIRM=WIPE:${hostname}.`,
        "The auth token and full URL are not printed.",
      ],
    };
  }
  return { ok: true, hostname, hosted: target.hosted };
}
