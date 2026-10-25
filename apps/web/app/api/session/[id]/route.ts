import { NextResponse } from "next/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions, type DBGameSession } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { publishSession } from "@/lib/ably-server";
import { seatColorForUser } from "@/lib/game-session";
import { formatSeatToken, verifySeatToken } from "@/lib/session-secret";
import { sessionPostSchema } from "@/lib/api-schemas";
import { enforceRateLimit } from "@/lib/rate-limit";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";

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

/**
 * Moves, resignations, and flag claims are accepted only while the game is
 * active, both seats are filled, and no result is stored yet.
 * `inPlayWhere` is the same predicate on the UPDATE so a finishing write
 * cannot be overwritten by one that read an earlier row. Ordering two
 * concurrent moves is intentionally not handled here.
 */
function isInPlay(s: DBGameSession): boolean {
  return (
    s.status === "active" &&
    s.blackJoined === 1 &&
    s.whiteUserId != null &&
    s.blackUserId != null &&
    s.result == null
  );
}

function inPlayWhere(id: string) {
  return and(
    eq(gameSessions.id, id),
    eq(gameSessions.status, "active"),
    eq(gameSessions.blackJoined, 1),
    isNotNull(gameSessions.whiteUserId),
    isNotNull(gameSessions.blackUserId),
    isNull(gameSessions.result),
  );
}

function wroteOne(res: unknown): boolean {
  return (res as { rowsAffected?: number }).rowsAffected === 1;
}

/** Current row plus an error code so the caller can replace its local board. */
function conflict(state: DBGameSession) {
  return NextResponse.json({ ...state, error: "game not active" }, { status: 409 });
}

async function appliedOrConflict(id: string, res: unknown): Promise<NextResponse> {
  if (wroteOne(res)) return respond(id);
  const current = await load(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  return conflict(current);
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
        .where(
          and(
            eq(gameSessions.id, id),
            eq(gameSessions.blackJoined, 0),
            eq(gameSessions.status, "waiting"),
            isNull(gameSessions.result),
          ),
        );
      claimed = (res as { rowsAffected?: number }).rowsAffected === 1;
      if (claimed) {
        s = (await load(id))!;
        await publishSession(id, s);
        myColor = "b";
        void insertAnalyticsEvents([
          {
            name: "online_game_join",
            userId: user.id,
            props: { sessionId: id, color: "b" },
          },
        ]).catch(() => void 0);
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

  const limited = await enforceRateLimit(
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

  if (!isInPlay(s)) return conflict(s);

  if (body.action === "resign") {
    const res = await db
      .update(gameSessions)
      .set({ status: "over", result: `resign:${seat}`, updatedAt: Date.now() })
      .where(inPlayWhere(id));
    return appliedOrConflict(id, res);
  }

  if (body.action === "timeout") {
    const now = Date.now();
    let whiteMs = s.whiteMs;
    let blackMs = s.blackMs;
    if (s.status === "active" && s.timeControlMin > 0) {
      const elapsed = Math.max(0, now - s.updatedAt);
      if (s.turn === "w") whiteMs = Math.max(0, whiteMs - elapsed);
      else blackMs = Math.max(0, blackMs - elapsed);
    }
    const wTimedOut = whiteMs <= 0;
    const bTimedOut = blackMs <= 0;
    if (!wTimedOut && !bTimedOut) {
      return NextResponse.json({ error: "clock still running" }, { status: 409 });
    }
    // Derive the timed-out seat from server clocks — never trust client `color`.
    const flagged: "w" | "b" =
      wTimedOut && !bTimedOut
        ? "w"
        : bTimedOut && !wTimedOut
          ? "b"
          : s.turn === "b"
            ? "b"
            : "w";
    const winner = flagged === "w" ? "b" : "w";
    const res = await db
      .update(gameSessions)
      .set({
        status: "over",
        result: `time:${winner}`,
        whiteMs,
        blackMs,
        updatedAt: now,
      })
      .where(inPlayWhere(id));
    return appliedOrConflict(id, res);
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
      const res = await db
        .update(gameSessions)
        .set({
          status: "over",
          result: `time:${seat === "w" ? "b" : "w"}`,
          whiteMs,
          blackMs,
          updatedAt: now,
        })
        .where(inPlayWhere(id));
      return appliedOrConflict(id, res);
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
  const res = await db
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
    .where(inPlayWhere(id));
  return appliedOrConflict(id, res);
}
