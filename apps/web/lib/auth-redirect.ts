import { safeNextPath } from "@chess-school/core";

/**
 * Safe in-app redirect after auth. Rejects open redirects and auth loops.
 * Client-safe (no cookies / server-only imports).
 */
export function sanitizeAppNext(
  next: string | null | undefined,
  fallback = "/academy",
): string {
  return safeNextPath(next, fallback);
}
