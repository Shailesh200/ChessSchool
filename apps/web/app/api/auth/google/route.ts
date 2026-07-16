import { NextResponse } from "next/server";
import {
  createOAuthState,
  sanitizeOAuthNext,
  setGoogleOAuthCookies,
} from "@/lib/google-oauth-cookies.server";
import { googleAuthUrl, googleOAuthConfigured } from "@/lib/google-oauth.server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Start Google OAuth — redirects to Google's consent screen. */
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "auth:google", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const next = sanitizeOAuthNext(url.searchParams.get("next"));
  const state = createOAuthState();
  await setGoogleOAuthCookies(state, next);

  return NextResponse.redirect(googleAuthUrl(req, state));
}
