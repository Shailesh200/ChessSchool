/**
 * Same-origin relative redirect paths only. Rejects open redirects, schemes,
 * backslashes, and control characters. Decodes repeatedly to catch encoded bypasses.
 */
const CTRL = /[\u0000-\u001F\u007F]/;

function decodeRepeated(raw: string, maxPasses = 4): string {
  let cur = raw;
  for (let i = 0; i < maxPasses; i++) {
    let next: string;
    try {
      next = decodeURIComponent(cur);
    } catch {
      break;
    }
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

function hasScheme(path: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path);
}

export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (next == null) return fallback;
  let path = String(next).trim();
  if (!path) return fallback;

  path = decodeRepeated(path);
  if (CTRL.test(path)) return fallback;
  if (hasScheme(path)) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.startsWith("/\\") || path.includes("\\")) return fallback;
  if (/(^|\/)\.\.(\/|$)/.test(path)) return fallback;

  const q = path.indexOf("?");
  const bare = (q >= 0 ? path.slice(0, q) : path).replace(/\/+$/, "") || "/";
  if (bare.startsWith("/login") || bare.startsWith("/register") || bare.startsWith("/welcome")) {
    return fallback;
  }
  return path;
}
