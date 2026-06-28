import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Chess } from "chess.js";
import { db } from "@/db";
import { gameSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return (await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1))[0];
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
  }
  return NextResponse.json({ ...s, claimed });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await load(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as {
    action: "move" | "resign";
    color?: "w" | "b";
    from?: string;
    to?: string;
    promotion?: string;
  };

  if (body.action === "resign") {
    await db
      .update(gameSessions)
      .set({ status: "over", result: `resign:${body.color}`, updatedAt: Date.now() })
      .where(eq(gameSessions.id, id));
    return NextResponse.json(await load(id));
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
      updatedAt: Date.now(),
    })
    .where(eq(gameSessions.id, id));
  return NextResponse.json(await load(id));
}
