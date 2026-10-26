import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import Ably from "ably";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { gameChannel } from "@/lib/ably-server";
import { getApiUser } from "@/lib/auth";
import { isParticipant, seatTokenMatchesSession } from "@/lib/game-session";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** UUID game ids from `createGameSessionId`. Rejects `*`, lists, and channel names. */
const GAME_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ably's standard token lifetime. Clients renew through authUrl. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Per signed-in user, or per guest seat. A live game needs a handful of
 * mints; this stops one account or seat from looping the token API. Keep
 * the limit in sync with `ably-token.integration.test.ts`.
 */
const TOKEN_RATE = { limit: 30, windowMs: 60_000 } as const;

/** Guest credential from #33. Not a session bearer. Never logged. */
const SEAT_TOKEN_HEADER = "x-seat-token";
const MAX_SEAT_TOKEN_LEN = 256;

/**
 * Short-lived Ably token so a seated player can SUBSCRIBE to that game only.
 * The server publishes; clients cannot. 503 when Ably isn't configured so the
 * client keeps polling. Callers with neither a session nor a seat token,
 * missing ids, and non-seats never reach Ably.
 *
 * A guest seat token is checked with `verifySeatToken` against the white or
 * black user id on the game — the same check the session route uses. The
 * signed capability is exactly `game:<id>` subscribe. Ably's authUrl client
 * appends its own token params (capability, ttl, nonce). Those are ignored.
 */
function presentedSeatToken(req: Request): string | null {
  const raw = req.headers.get(SEAT_TOKEN_HEADER);
  if (raw === null) return null;
  const token = raw.trim();
  if (!token) return null;
  // Overlong values are not a seat token. Keep a stand-in so the attempt
  // still fails the seat check instead of being hashed or logged in full.
  if (token.length > MAX_SEAT_TOKEN_LEN) return "invalid";
  return token;
}

/** Rate-limit id for a guest. The raw seat token is not the key. */
function guestRateUserId(seatToken: string): string {
  const digest = createHash("sha256").update(seatToken).digest("hex");
  return `seat:${digest}`;
}

export async function GET(req: Request) {
  const user = await getApiUser(req);
  const seatToken = user ? null : presentedSeatToken(req);
  if (!user && !seatToken) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }

  // Await before the game-id check. Guests are keyed by a hash of the seat
  // token. With no seat identity, `enforceRateLimit` falls back to IP.
  const limited = await enforceRateLimit(
    req,
    "ably:token",
    TOKEN_RATE,
    user ? user.id : seatToken ? guestRateUserId(seatToken) : undefined,
  );
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
  const holdsSeat = !session
    ? false
    : user
      ? isParticipant(session, user.id)
      : !!seatToken && seatTokenMatchesSession(session, seatToken);
  if (!session || !holdsSeat) {
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
