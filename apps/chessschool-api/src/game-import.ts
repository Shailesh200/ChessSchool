import { parsePgn, reviewPlies } from "@chessschool/chess";
import { COACH_MAX_PLIES } from "./coach";

/**
 * Recent games from Lichess or Chess.com public APIs, or one pasted PGN, checked and trimmed to
 * what the review screen needs. The username is used for this request only and never stored.
 */
export type ImportedGame = { id: string; white: string; black: string; result: string; endedAt: number; startFen: string; moves: string[]; you: "w" | "b" | null };
/** Fetches a URL and returns its body (at most `maxBytes`), or null. Tests pass a fake. */
export type ImportFetch = (url: string, accept: string) => Promise<string | null>;

export const IMPORT_MAX = 20;
export const PGN_MAX_BYTES = 100_000;
const BODY_MAX_BYTES = 2_000_000;
export const isUsername = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{2,30}$/.test(v);

export const webFetch: ImportFetch = async (url, accept) => {
  try {
    const res = await fetch(url, { headers: { Accept: accept, "User-Agent": "ChessSchool (https://chess-school.in)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok || Number(res.headers.get("content-length") ?? 0) > BODY_MAX_BYTES) return null;
    const text = await res.text();
    return text.length > BODY_MAX_BYTES ? null : text;
  } catch {
    return null;
  }
};

/** A game from PGN text, or null when it isn't a legal standard game of a sensible length. */
export function gameFromPgn(pgn: string, id: string, username: string | null, endedAt: number): ImportedGame | null {
  const g = parsePgn(pgn);
  if (!g || !g.moves.length || g.moves.length > COACH_MAX_PLIES) return null;
  if (reviewPlies(g.startFen, g.moves).length !== g.moves.length) return null;
  const white = (g.headers.White ?? "").slice(0, 40);
  const black = (g.headers.Black ?? "").slice(0, 40);
  const lower = username?.toLowerCase();
  const you = lower ? (white.toLowerCase() === lower ? "w" : black.toLowerCase() === lower ? "b" : null) : null;
  return { id, white, black, result: g.headers.Result ?? "*", endedAt, startFen: g.startFen, moves: g.moves, you };
}

export async function lichessGames(username: string, get: ImportFetch): Promise<ImportedGame[] | null> {
  const body = await get(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${IMPORT_MAX}&pgnInJson=true`, "application/x-ndjson");
  if (body === null) return null;
  const out: ImportedGame[] = [];
  for (const line of body.split("\n")) {
    let row: { id?: unknown; variant?: unknown; pgn?: unknown; lastMoveAt?: unknown; createdAt?: unknown };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof row.pgn !== "string" || (row.variant && row.variant !== "standard")) continue;
    const ended = typeof row.lastMoveAt === "number" ? row.lastMoveAt : typeof row.createdAt === "number" ? row.createdAt : 0;
    const g = gameFromPgn(row.pgn, `lichess:${String(row.id ?? out.length)}`, username, ended);
    if (g) out.push(g);
  }
  return out.slice(0, IMPORT_MAX);
}

export async function chesscomGames(username: string, get: ImportFetch): Promise<ImportedGame[] | null> {
  const name = encodeURIComponent(username.toLowerCase());
  const list = await get(`https://api.chess.com/pub/player/${name}/games/archives`, "application/json");
  if (list === null) return null;
  let archives: string[];
  try {
    archives = ((JSON.parse(list) as { archives?: unknown }).archives as unknown[]).filter((u): u is string => typeof u === "string" && u.startsWith(`https://api.chess.com/pub/player/${name}/games/`));
  } catch {
    return null;
  }
  const out: ImportedGame[] = [];
  // Newest month first; one more month only when the newest is short.
  for (const url of archives.slice(-2).reverse()) {
    if (out.length >= IMPORT_MAX) break;
    const month = await get(url, "application/json");
    if (month === null) continue;
    let games: { pgn?: unknown; rules?: unknown; end_time?: unknown; uuid?: unknown; url?: unknown }[];
    try {
      games = (JSON.parse(month) as { games?: typeof games }).games ?? [];
    } catch {
      continue;
    }
    for (const row of [...games].reverse()) {
      if (typeof row.pgn !== "string" || row.rules !== "chess") continue;
      const g = gameFromPgn(row.pgn, `chesscom:${String(row.uuid ?? row.url ?? out.length)}`, username, typeof row.end_time === "number" ? row.end_time * 1000 : 0);
      if (g) out.push(g);
      if (out.length >= IMPORT_MAX) break;
    }
  }
  return out;
}
