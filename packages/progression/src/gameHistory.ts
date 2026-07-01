import { ChessEngine } from "@chess-school/core";

export type EndReason =
  | "checkmate"
  | "resign"
  | "stalemate"
  | "draw"
  | "insufficient"
  | "timeout";

/** Cross-platform game record stored in progress.recentGames and Dexie. */
export type SyncGame = {
  id: string;
  mode: "bot" | "pass" | "sandbox" | "online";
  pgn: string;
  fen: string;
  whiteName: string;
  blackName: string;
  createdAt: number;
  updatedAt: number;
  turn?: "w" | "b";
  result: string;
  endReason?: EndReason;
  winner?: "w" | "b" | null;
  moveCount: number;
  elo: number | null;
  durationMs?: number;
  /** Legacy mobile — player-relative outcome */
  playerResult?: "win" | "loss" | "draw";
  /** @deprecated legacy mobile */
  moves?: string[];
  /** @deprecated legacy mobile */
  at?: number;
};

export function normalizeSyncGame(raw: unknown): SyncGame | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.id !== "string") return null;
  const mode = g.mode;
  if (mode !== "bot" && mode !== "pass" && mode !== "sandbox" && mode !== "online") return null;

  const moves = Array.isArray(g.moves) ? g.moves.filter((m): m is string => typeof m === "string") : undefined;
  const pgn = typeof g.pgn === "string" ? g.pgn : "";
  const createdAt = typeof g.createdAt === "number" ? g.createdAt : typeof g.at === "number" ? g.at : Date.now();
  const updatedAt = typeof g.updatedAt === "number" ? g.updatedAt : createdAt;

  let moveCount = typeof g.moveCount === "number" ? g.moveCount : moves?.length ?? 0;
  if (!moveCount && pgn) moveCount = movesFromSyncGame({ ...(g as SyncGame), pgn, moves, moveCount: 0 }).length;

  const legacyResult = g.result;
  const playerResult =
    legacyResult === "win" || legacyResult === "loss" || legacyResult === "draw"
      ? legacyResult
      : g.playerResult === "win" || g.playerResult === "loss" || g.playerResult === "draw"
        ? g.playerResult
        : undefined;

  let result: string;
  let winner: "w" | "b" | null =
    g.winner === "w" || g.winner === "b" ? g.winner : g.winner === null ? null : null;

  if (playerResult) {
    result = playerResult === "win" ? "1-0" : playerResult === "loss" ? "0-1" : "1/2-1/2";
    winner = playerResult === "win" ? "w" : playerResult === "loss" ? "b" : null;
  } else if (g.result === "1-0" || g.result === "0-1" || g.result === "1/2-1/2") {
    result = g.result;
  } else {
    result = "1/2-1/2";
  }

  return {
    id: g.id,
    mode,
    pgn,
    fen: typeof g.fen === "string" ? g.fen : "",
    whiteName: typeof g.whiteName === "string" ? g.whiteName : "White",
    blackName: typeof g.blackName === "string" ? g.blackName : "Black",
    createdAt,
    updatedAt,
    turn: g.turn === "w" || g.turn === "b" ? g.turn : undefined,
    result,
    endReason: isEndReason(g.endReason) ? g.endReason : undefined,
    winner,
    moveCount,
    elo: typeof g.elo === "number" ? g.elo : null,
    durationMs: typeof g.durationMs === "number" ? g.durationMs : undefined,
    playerResult,
    moves,
    at: typeof g.at === "number" ? g.at : undefined,
  };
}

function isEndReason(v: unknown): v is EndReason {
  return (
    v === "checkmate" ||
    v === "resign" ||
    v === "stalemate" ||
    v === "draw" ||
    v === "insufficient" ||
    v === "timeout"
  );
}

/** UCI-style from:to moves for replay UI. */
export function movesFromSyncGame(g: SyncGame): string[] {
  if (g.moves?.length) return g.moves;
  if (!g.pgn.trim()) return [];
  try {
    const e = ChessEngine.fromPgn(g.pgn);
    return e.history().map((m) => `${m.from}:${m.to}`);
  } catch {
    return [];
  }
}

/** Player-relative result (mobile review list). Default perspective: white. */
export function playerResultOf(g: SyncGame, playerColor: "w" | "b" = "w"): "win" | "loss" | "draw" {
  if (g.playerResult) return g.playerResult;
  if (g.result === "win" || g.result === "loss" || g.result === "draw") return g.result;
  if (g.winner === null || g.result === "1/2-1/2") return "draw";
  return g.winner === playerColor ? "win" : "loss";
}

export function mergeRecentGames(local: unknown[], remote: unknown[]): SyncGame[] {
  const byId = new Map<string, SyncGame>();
  for (const raw of [...remote, ...local]) {
    const g = normalizeSyncGame(raw);
    if (!g) continue;
    const prev = byId.get(g.id);
    if (!prev || g.updatedAt >= prev.updatedAt) byId.set(g.id, g);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
}

export function prependRecentGame(existing: unknown[], game: SyncGame): SyncGame[] {
  return mergeRecentGames([game], existing);
}
