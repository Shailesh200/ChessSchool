import { ChessEngine } from "@chess-school/core";
import type { SyncGame } from "@chess-school/progression";

export type Color = "w" | "b";

export type MoveInput = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

export function inferPlayerColor(game: SyncGame): Color {
  if (game.mode === "bot") return "w";
  if (game.whiteName === "You") return "w";
  if (game.blackName === "You") return "b";
  return "w";
}

export function opponentMoves(pgn: string, playerColor: Color): MoveInput[] {
  const engine = ChessEngine.fromPgn(pgn || "");
  const shadowColor: Color = playerColor === "w" ? "b" : "w";
  return engine
    .history()
    .flatMap((m) =>
      m.color === shadowColor
        ? [{ from: m.from, to: m.to, promotion: m.promotion as MoveInput["promotion"] }]
        : [],
    );
}

export interface ShadowConfig {
  gameId: string;
  pgn: string;
  playerColor: Color;
  opponentName: string;
  flipped?: boolean;
}

export function shadowFromGame(game: SyncGame, opts?: { flipColor?: boolean }): ShadowConfig | null {
  if (!game.pgn?.trim() || game.moveCount < 2) return null;
  let playerColor = inferPlayerColor(game);
  if (opts?.flipColor) playerColor = playerColor === "w" ? "b" : "w";
  const opponentName = opts?.flipColor
    ? "your past self"
    : playerColor === "w"
      ? game.blackName
      : game.whiteName;
  return {
    gameId: game.id,
    pgn: game.pgn,
    playerColor,
    opponentName,
    flipped: opts?.flipColor ?? false,
  };
}
