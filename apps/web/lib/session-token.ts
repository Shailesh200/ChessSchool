import { createHash, randomUUID } from "node:crypto";

/** SHA-256 hex digest — stored in DB; raw token stays in cookie/Bearer only. */
export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issue a new opaque bearer/cookie value (never persisted verbatim). */
export function newSessionToken(): string {
  return randomUUID();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pre-M-047 rows used the raw UUID as the primary key. Only a UUID-shaped value
 * qualifies: a stored SHA-256 digest (64 hex) must never be accepted as a credential
 * by the legacy fallback, or a leaked session table would double as valid logins (DP-X-003).
 */
export function isLegacySessionId(storedId: string, rawToken: string): boolean {
  return storedId === rawToken && UUID_RE.test(rawToken);
}
