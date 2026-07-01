import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";
import { publishSession } from "@/lib/ably-server";
import { signSeatToken } from "@/lib/session-secret";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return (await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1))[0];
}

function verifySeatToken(id: string, color: "w" | "b" | undefined, token: string | undefined): boolean {
  if (!color || !token) return false;
  const [tokenColor, sig] = token.split(".");
  if (tokenColor !== color || !sig) return false;
  const expected = signSeatToken(id, color);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Load the latest state, push it to realtime subscribers, and return it. */
async function respond(id: string) {
  const state = await load(id);
  await publishSession(id, state);
  return NextResponse.json(state);
}

/** Get session state. `?join=1` claims the Black seat if it's open. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let s = await load(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const join = new URL(req.url).searchParams.get("join") === "1";
  let claimed = false;
  if (join) {
    const res = await db
      .update(gameSessions)
      .set({ blackJoined: 1, status: "active", updatedAt: Date.now() })
      .where(and(eq(gameSessions.id, id), eq(gameSessions.blackJoined, 0)));
    claimed = (res as { rowsAffected?: number }).rowsAffected === 1;
    s = (await load(id))!;
    if (claimed) await publishSession(id, s); // notify the creator their opponent joined
  }
  return NextResponse.json({ ...s, claimed, color: claimed ? "b" : undefined, seatToken: claimed ? `b.${signSeatToken(id, "b")}` : undefined });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await load(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as {
    action: "move" | "resign" | "timeout";
    color?: "w" | "b";
    seat?: "w" | "b";
    seatToken?: string;
    from?: string;
    to?: string;
    promotion?: string;
  };
  const actor = body.action === "timeout" ? body.seat : body.color;
  if (!verifySeatToken(id, actor, body.seatToken)) {
    return NextResponse.json({ error: "invalid seat" }, { status: 403 });
  }

  if (body.action === "resign") {
    await db
      .update(gameSessions)
      .set({ status: "over", result: `resign:${body.color}`, updatedAt: Date.now() })
      .where(eq(gameSessions.id, id));
    return respond(id);
  }

  if (body.action === "timeout") {
    const winner = body.color === "w" ? "b" : "w";
    await db
      .update(gameSessions)
      .set({ status: "over", result: `time:${winner}`, updatedAt: Date.now() })
      .where(eq(gameSessions.id, id));
    return respond(id);
  }

  // move
  const g = new Chess();
  if (s.pgn) {
    try {
      g.loadPgn(s.pgn);
    } catch {
      g.load(s.fen);
    }
  }
  if (body.color && g.turn() !== body.color) {
    return NextResponse.json({ error: "not your turn" }, { status: 409 });
  }

  // Deduct the mover's elapsed time; flag (lose on time) if it runs out.
  const now = Date.now();
  const mover = g.turn();
  let whiteMs = s.whiteMs;
  let blackMs = s.blackMs;
  if (s.status === "active" && s.timeControlMin > 0) {
    const elapsed = Math.max(0, now - s.updatedAt);
    if (mover === "w") whiteMs = Math.max(0, whiteMs - elapsed);
    else blackMs = Math.max(0, blackMs - elapsed);
    if ((mover === "w" && whiteMs <= 0) || (mover === "b" && blackMs <= 0)) {
      await db
        .update(gameSessions)
        .set({ status: "over", result: `time:${mover === "w" ? "b" : "w"}`, whiteMs, blackMs, updatedAt: now })
        .where(eq(gameSessions.id, id));
      return respond(id);
    }
  }

  let applied;
  try {
    applied = g.move({ from: body.from!, to: body.to!, promotion: (body.promotion as "q") ?? "q" });
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
