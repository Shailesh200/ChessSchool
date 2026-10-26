import { NextResponse } from "next/server";
import Ably from "ably";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { gameChannel } from "@/lib/ably-server";
import { getApiUser } from "@/lib/auth";
import { isParticipant } from "@/lib/game-session";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** UUID game ids from `createGameSessionId`. Rejects `*`, lists, and channel names. */
const GAME_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ably's standard token lifetime. Clients renew through authUrl. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Per signed-in user. A live game needs a handful of mints; this stops one
 * account from looping the token API. Keep the limit in sync with
 * `ably-token.integration.test.ts`.
 */
const TOKEN_RATE = { limit: 30, windowMs: 60_000 } as const;

/**
 * Short-lived Ably token so a seated player can SUBSCRIBE to that game only.
 * The server publishes; clients cannot. 503 when Ably isn't configured so the
 * client keeps polling. Anonymous callers, missing ids, and non-seats never
 * reach Ably.
 *
 * Ably's authUrl client appends its own token params (capability, ttl, nonce).
 * Those are ignored — the signed capability is exactly `game:<id>` subscribe.
 */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }

  const limited = await enforceRateLimit(req, "ably:token", TOKEN_RATE, user.id);
  if (limited) return limited;

  const gameParam = new URL(req.url).searchParams.get("game");
  if (gameParam === null || gameParam.trim() === "") {
    return NextResponse.json({ error: "game id required" }, { status: 400 });
  }
  const gameId = gameParam.trim().toLowerCase();
  if (!GAME_ID_RE.test(gameId)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const session = (
    await db.select().from(gameSessions).where(eq(gameSessions.id, gameId)).limit(1)
  )[0];
  if (!session || !isParticipant(session, user.id)) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }

  const key = process.env.ABLY_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ably_not_configured" }, { status: 503 });
  }

  try {
    const rest = new Ably.Rest(key);
    const tokenRequest = await rest.auth.createTokenRequest({
      ttl: TOKEN_TTL_MS,
      capability: { [gameChannel(session.id)]: ["subscribe"] },
    });
    return NextResponse.json(tokenRequest);
  } catch {
    return NextResponse.json({ error: "token_failed" }, { status: 500 });
  }
}
