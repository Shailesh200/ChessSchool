/**
 * Safe in-app redirect after auth. Rejects open redirects and auth loops.
 * Client-safe (no cookies / server-only imports).
 */
import { safeNextPath } from "./safeNextPath";

export function sanitizeAppNext(
  next: string | null | undefined,
  fallback = "/academy",
): string {
  return safeNextPath(next, fallback);
}

export { safeNextPath };
