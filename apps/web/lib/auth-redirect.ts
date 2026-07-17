/**
 * Safe in-app redirect after auth. Rejects open redirects and auth loops.
 * Client-safe (no cookies / server-only imports).
 */
export function sanitizeAppNext(
  next: string | null | undefined,
  fallback = "/academy",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (
    next.startsWith("/login") ||
    next.startsWith("/register") ||
    next.startsWith("/welcome")
  ) {
    return fallback;
  }
  return next;
}
