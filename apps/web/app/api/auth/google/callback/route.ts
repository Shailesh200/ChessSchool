import { NextResponse } from "next/server";
import {
  clearGoogleOAuthCookies,
  readGoogleOAuthCookies,
  sanitizeOAuthNext,
} from "@/lib/google-oauth-cookies.server";
import { googleOAuthConfigured, googleProfileFromCode } from "@/lib/google-oauth.server";
import { establishWebSession, signInWithGoogle } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Google OAuth callback — exchanges code, links account, sets session cookie. */
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "auth:google-callback", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", req.url));
  }

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    await clearGoogleOAuthCookies();
    return NextResponse.redirect(new URL("/login?error=google_denied", req.url));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = await readGoogleOAuthCookies();
  await clearGoogleOAuthCookies();

  if (!code || !state || !stored.state || state !== stored.state) {
    return NextResponse.redirect(new URL("/login?error=google_state", req.url));
  }

  const profile = await googleProfileFromCode(req, code);
  if ("error" in profile) {
    return NextResponse.redirect(new URL("/login?error=google_failed", req.url));
  }

  const signedIn = await signInWithGoogle(profile);
  if ("error" in signedIn) {
    return NextResponse.redirect(new URL("/login?error=google_failed", req.url));
  }

  await establishWebSession(signedIn.user.id);

  const next = sanitizeOAuthNext(stored.nextPath);
  const dest = signedIn.isNewUser ? "/onboarding" : next;
  return NextResponse.redirect(new URL(dest, req.url));
}
