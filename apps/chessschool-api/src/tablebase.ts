import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { tablebase } from "./schema";

/** Best move in an endgame position from the Lichess tablebase (7 pieces or fewer), cached in cs_tablebase. */
export type TablebaseAnswer = { move: string | null; category: string };
export type TablebaseFetch = (fen: string) => Promise<TablebaseAnswer | null>;

/** Only the board and side to move matter; clocks are dropped so equal positions share a cache row. */
export function tablebaseKey(fen: string): string | null {
  const [board, side, castling = "-", ep = "-"] = fen.trim().split(/\s+/);
  if (!board || !/^[1-8pnbrqkPNBRQK/]+$/.test(board) || board.split("/").length !== 8 || (side !== "w" && side !== "b")) return null;
  const pieces = board.replace(/[^a-zA-Z]/g, "").length;
  if (pieces > 7 || !board.includes("k") || !board.includes("K")) return null;
  return `${board} ${side} ${castling} ${ep}`;
}

/** Lichess's public tablebase. Only the position is sent. */
export const lichessTablebase: TablebaseFetch = async (fen) => {
  try {
    const res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`, { headers: { "User-Agent": "ChessSchool (https://chess-school.in)" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { category?: string; moves?: { uci: string }[] };
    return { move: d.moves?.[0]?.uci ?? null, category: d.category ?? "unknown" };
  } catch {
    return null;
  }
};

export async function bestEndgameMove(db: Db, key: string, ask: TablebaseFetch): Promise<TablebaseAnswer | null> {
  const hit = await db.query.tablebase.findFirst({ where: eq(tablebase.fen, key) });
  if (hit) return { move: hit.move, category: hit.category };
  const got = await ask(`${key} 0 1`);
  if (got) await db.insert(tablebase).values({ fen: key, move: got.move, category: got.category }).onConflictDoNothing();
  return got;
}
