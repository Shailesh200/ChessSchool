import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const STATE_COOKIE = "chessschool_google_oauth_state";
const NEXT_COOKIE = "chessschool_google_oauth_next";
const COOKIE_MAX_AGE = 600;

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export async function setGoogleOAuthCookies(state: string, nextPath: string): Promise<void> {
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

/** Safe in-app redirect target from the OAuth `next` param. */
export function sanitizeOAuthNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/welcome";
  if (next.startsWith("/login") || next.startsWith("/register")) return "/welcome";
  return next;
}
