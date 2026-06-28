import { NextResponse } from "next/server";
import Ably from "ably";

export const dynamic = "force-dynamic";

/**
 * Mints a short-lived Ably token so the browser can SUBSCRIBE to game channels
 * (clients can't publish — the server is authoritative). Returns 503 when Ably
 * isn't configured, so the client silently falls back to polling.
 */
export async function GET() {
  const key = process.env.ABLY_API_KEY;
  if (!key) return NextResponse.json({ error: "ably_not_configured" }, { status: 503 });
  try {
    const rest = new Ably.Rest(key);
    const tokenRequest = await rest.auth.createTokenRequest({
      capability: { "game:*": ["subscribe"] },
    });
    return NextResponse.json(tokenRequest);
  } catch {
    return NextResponse.json({ error: "token_failed" }, { status: 500 });
  }
}
