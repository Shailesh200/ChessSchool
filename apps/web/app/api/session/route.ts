import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { formatSeatToken } from "@/lib/session-secret";

export const dynamic = "force-dynamic";

function shortId(): string {
  return randomBytes(6).toString("base64url");
}

/** Create a shareable live session — creator plays White. */
export async function POST() {
  const g = new Chess();
  const id = shortId();
  const now = Date.now();
  await db.insert(gameSessions).values({
    id,
    fen: g.fen(),
    pgn: "",
    turn: "w",
    status: "waiting",
    blackJoined: 0,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id, color: "w", seatToken: formatSeatToken(id, "w") });
}
