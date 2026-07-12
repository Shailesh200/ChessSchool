import { NextResponse } from "next/server";
import { z } from "zod";
import { signInWithGoogleIdToken } from "@/lib/auth";
import { googleOAuthConfigured } from "@/lib/google-oauth.server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(20),
});

/** Mobile Google Sign-In — verify ID token, return bearer session. */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "auth:google", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const res = await signInWithGoogleIdToken(parsed.data.idToken);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 401 });
  }

  return NextResponse.json({
    token: res.token,
    user: res.user,
    isNewUser: res.isNewUser,
  });
}
