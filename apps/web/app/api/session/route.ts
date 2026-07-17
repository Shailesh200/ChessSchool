import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { createGameSessionId } from "@/lib/game-session";
import { formatSeatToken } from "@/lib/session-secret";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Create a shareable live session — authenticated creator plays White. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const limited = enforceRateLimit(
    req,
    "session:create",
    { limit: 30, windowMs: 60_000 },
    user.id,
  );
  if (limited) return limited;

  const g = new Chess();
  const id = await createGameSessionId();
  const now = Date.now();
  await db.insert(gameSessions).values({
    id,
    fen: g.fen(),
    pgn: "",
    turn: "w",
    status: "waiting",
    blackJoined: 0,
    whiteUserId: user.id,
    blackUserId: null,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({
    id,
    color: "w",
    seatToken: formatSeatToken(id, "w", user.id),
  });
}
