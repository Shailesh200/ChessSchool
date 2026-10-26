import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const STATE_COOKIE = "chessschool_google_oauth_state";
const NEXT_COOKIE = "chessschool_google_oauth_next";
const COOKIE_MAX_AGE = 600;

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export async function setGoogleOAuthCookies(
  state: string,
  nextPath: string,
): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  jar.set(NEXT_COOKIE, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function readGoogleOAuthCookies(): Promise<{
  state: string | null;
  nextPath: string | null;
}> {
  const jar = await cookies();
  return {
    state: jar.get(STATE_COOKIE)?.value ?? null,
    nextPath: jar.get(NEXT_COOKIE)?.value ?? null,
  };
}

export async function clearGoogleOAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(STATE_COOKIE);
  jar.delete(NEXT_COOKIE);
}

const OAUTH_NEXT_FALLBACK = "/welcome";

/** Stay inside the httpOnly cookie shared with the OAuth state value. */
const MAX_OAUTH_NEXT_LENGTH = 2048;

/**
 * Sentinel origin for "did this stay a path?". A protocol-relative or absolute
 * URL resolves somewhere else. The host is not an allow-list entry.
 */
const OAUTH_NEXT_BASE = "https://oauth-next.invalid";

/** In-app path, query, and hash. No backslash, whitespace, or raw controls. */
const APP_PATH_PATTERN = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#:]*$/;

/** How many times to undo `%` encoding. Further layers fail closed. */
const MAX_DECODE_LAYERS = 4;

function isAuthScreen(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/register");
}

function pathPortion(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Collapse `.` and `..` so `/play/../login` still counts as `/login`. */
function normalizedPathname(pathname: string): string {
  const parts: string[] = [];
  for (const part of pathname.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join("/")}`;
}

/**
 * Reject characters the WHATWG parser treats specially, including after `%`
 * decoding. `searchParams` decodes once before this runs; a cookie value may
 * still be encoded. `%2F` → `//`, `%5C` → `\`, `%09`/`%0A`/`%0D` → controls.
 */
function isAllowListedAppPath(value: string): boolean {
  if (!APP_PATH_PATTERN.test(value)) return false;

  let current = value;
  for (let depth = 0; depth < MAX_DECODE_LAYERS; depth++) {
    if (current.includes("\\") || hasControlChar(current)) return false;
    const path = pathPortion(current);
    if (!path.startsWith("/") || path.includes("//")) return false;
    if (isAuthScreen(normalizedPathname(path))) return false;

    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return false;
    }
    if (decoded === current) return true;
    current = decoded;
  }

  return false;
}

/** Safe in-app redirect target from the OAuth `next` param. */
export function sanitizeOAuthNext(next: string | null | undefined): string {
  if (!next || next.length > MAX_OAUTH_NEXT_LENGTH) return OAUTH_NEXT_FALLBACK;
  if (!isAllowListedAppPath(next)) return OAUTH_NEXT_FALLBACK;

  // Backstop. `/\oauth-next.invalid` and a tabbed `//oauth-next.invalid` also
  // resolve to this sentinel, so the allow-list has to reject those first.
  let resolved: URL;
  try {
    resolved = new URL(next, OAUTH_NEXT_BASE);
  } catch {
    return OAUTH_NEXT_FALLBACK;
  }

  if (
    resolved.origin !== OAUTH_NEXT_BASE ||
    resolved.protocol !== "https:" ||
    resolved.username !== "" ||
    resolved.password !== "" ||
    !resolved.pathname.startsWith("/") ||
    resolved.pathname.startsWith("//") ||
    isAuthScreen(resolved.pathname)
  ) {
    return OAUTH_NEXT_FALLBACK;
  }

  return next;
}
