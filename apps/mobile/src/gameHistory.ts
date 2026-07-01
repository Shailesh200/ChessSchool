import { ChessEngine } from "@chess-school/core";
import type { EndReason, SyncGame } from "@chess-school/progression";

export function buildSyncGame(opts: {
  engine: ChessEngine;
  id: string;
  mode: SyncGame["mode"];
  createdAt: number;
  whiteName: string;
  blackName: string;
  elo: number | null;
  endReason: EndReason;
  winner: "w" | "b" | null;
  playerResult: "win" | "loss" | "draw";
  durationMs?: number;
}): SyncGame {
  const result = opts.winner === "w" ? "1-0" : opts.winner === "b" ? "0-1" : "1/2-1/2";
  return {
    id: opts.id,
    mode: opts.mode,
    pgn: opts.engine.pgn(),
    fen: opts.engine.fen(),
    whiteName: opts.whiteName,
    blackName: opts.blackName,
    createdAt: opts.createdAt,
    updatedAt: Date.now(),
    turn: opts.engine.turn(),
    result,
    endReason: opts.endReason,
    winner: opts.winner,
    moveCount: opts.engine.history().length,
    elo: opts.elo,
    durationMs: opts.durationMs ?? Date.now() - opts.createdAt,
    playerResult: opts.playerResult,
  };
}

export function winnerFromPlayerResult(result: "win" | "loss" | "draw", playerColor: "w" | "b"): "w" | "b" | null {
  if (result === "draw") return null;
  if (result === "win") return playerColor;
  return playerColor === "w" ? "b" : "w";
}

export function endReasonFromStatus(status: string): EndReason {
  if (status === "checkmate") return "checkmate";
  if (status === "stalemate") return "stalemate";
  return "draw";
}
