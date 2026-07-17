import { createHash, randomUUID } from "node:crypto";

/** SHA-256 hex digest — stored in DB; raw token stays in cookie/Bearer only. */
export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issue a new opaque bearer/cookie value (never persisted verbatim). */
export function newSessionToken(): string {
  return randomUUID();
}

/** Pre-M-047 rows used the raw UUID as the primary key. */
export function isLegacySessionId(storedId: string, rawToken: string): boolean {
  return storedId === rawToken;
}
