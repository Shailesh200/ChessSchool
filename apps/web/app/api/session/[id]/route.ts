import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { publishSession } from "@/lib/ably-server";
import { seatColorForUser } from "@/lib/game-session";
import { formatSeatToken, verifySeatToken } from "@/lib/session-secret";
import { sessionPostSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return (
    await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1)
  )[0];
}

/** Load the latest state, push it to realtime subscribers, and return it. */
async function respond(id: string) {
  const state = await load(id);
  await publishSession(id, state);
  return NextResponse.json(state);
}

/** Get session state. `?join=1` claims Black for the authenticated user. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let s = await load(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const user = await getApiUser(req);
  const join = new URL(req.url).searchParams.get("join") === "1";
  let claimed = false;
  let myColor: "w" | "b" | undefined;

  if (join) {
    if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });
    myColor = seatColorForUser(s, user.id) ?? undefined;
    if (!myColor && !s.blackJoined && s.whiteUserId !== user.id) {
      const res = await db
        .update(gameSessions)
        .set({
          blackJoined: 1,
          blackUserId: user.id,
          status: "active",
          updatedAt: Date.now(),
        })
        .where(and(eq(gameSessions.id, id), eq(gameSessions.blackJoined, 0)));
      claimed = (res as { rowsAffected?: number }).rowsAffected === 1;
      if (claimed) {
        s = (await load(id))!;
        await publishSession(id, s);
        myColor = "b";
      }
    }
  } else if (user) {
    myColor = seatColorForUser(s, user.id) ?? undefined;
  }

  return NextResponse.json({
    ...s,
    claimed,
    color: myColor,
    seatToken: myColor && user ? formatSeatToken(id, myColor, user.id) : undefined,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const { id } = await params;
  const s = await load(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const seat = seatColorForUser(s, user.id);
  if (!seat) return NextResponse.json({ error: "not a participant" }, { status: 403 });

  const limited = enforceRateLimit(
    req,
    "session:move",
    { limit: 180, windowMs: 60_000 },
    user.id,
  );
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = sessionPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const body = parsed.data;

  if (!verifySeatToken(id, seat, user.id, body.seatToken)) {
    return NextResponse.json({ error: "invalid seat" }, { status: 403 });
  }

  if (body.action === "resign") {
    await db
      .update(gameSessions)
      .set({ status: "over", result: `resign:${seat}`, updatedAt: Date.now() })
      .where(eq(gameSessions.id, id));
    return respond(id);
  }

  if (body.action === "timeout") {
    const flagged = body.color ?? body.seat;
    if (flagged !== "w" && flagged !== "b") {
      return NextResponse.json({ error: "invalid timeout" }, { status: 400 });
    }
    const winner = flagged === "w" ? "b" : "w";
    await db
      .update(gameSessions)
      .set({ status: "over", result: `time:${winner}`, updatedAt: Date.now() })
      .where(eq(gameSessions.id, id));
    return respond(id);
  }

  // move — mover color comes from the authenticated seat, not the client body
  const g = new Chess();
  if (s.pgn) {
    try {
      g.loadPgn(s.pgn);
    } catch {
      g.load(s.fen);
    }
  }
  if (g.turn() !== seat) {
    return NextResponse.json({ error: "not your turn" }, { status: 409 });
  }

  const now = Date.now();
  let whiteMs = s.whiteMs;
  let blackMs = s.blackMs;
  if (s.status === "active" && s.timeControlMin > 0) {
    const elapsed = Math.max(0, now - s.updatedAt);
    if (seat === "w") whiteMs = Math.max(0, whiteMs - elapsed);
    else blackMs = Math.max(0, blackMs - elapsed);
    if ((seat === "w" && whiteMs <= 0) || (seat === "b" && blackMs <= 0)) {
      await db
        .update(gameSessions)
        .set({
          status: "over",
          result: `time:${seat === "w" ? "b" : "w"}`,
          whiteMs,
          blackMs,
          updatedAt: now,
        })
        .where(eq(gameSessions.id, id));
      return respond(id);
    }
  }

  let applied;
  try {
    applied = g.move({
      from: body.from,
      to: body.to,
      promotion: body.promotion ?? "q",
    });
  } catch {
    applied = null;
  }
  if (!applied) return NextResponse.json({ error: "illegal move" }, { status: 400 });

  const over = g.isGameOver();
  const result = over
    ? g.isCheckmate()
      ? g.turn() === "w"
        ? "0-1"
        : "1-0"
      : "1/2-1/2"
    : null;
  await db
    .update(gameSessions)
    .set({
      fen: g.fen(),
      pgn: g.pgn(),
      turn: g.turn(),
      lastFrom: body.from,
      lastTo: body.to,
      status: over ? "over" : "active",
      result,
      whiteMs,
      blackMs,
      updatedAt: now,
    })
    .where(eq(gameSessions.id, id));
  return respond(id);
}
