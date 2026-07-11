import { ChessEngine } from "@/features/chess-engine/engine";
import type { SavedGame } from "@/core/db/db";
import type { Color, MoveInput } from "@/core/types/chess";

/** Which side was the local human in a saved game. */
export function inferPlayerColor(game: SavedGame): Color {
  if (game.mode === "bot") return "w";
  if (game.whiteName === "You") return "w";
  if (game.blackName === "You") return "b";
  return "w";
}

/** Full move list from a PGN in order. */
export function movesFromPgn(pgn: string): MoveInput[] {
  try {
    const engine = ChessEngine.fromPgn(pgn || "");
    return engine.history().map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    }));
  } catch {
    return [];
  }
}

/** Opponent-only moves (shadow side) in order. */
export function opponentMoves(pgn: string, playerColor: Color): MoveInput[] {
  const engine = ChessEngine.fromPgn(pgn || "");
  const shadowColor: Color = playerColor === "w" ? "b" : "w";
  return engine
    .history()
    .flatMap((m) =>
      m.color === shadowColor
        ? [{ from: m.from, to: m.to, promotion: m.promotion }]
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

export function shadowFromGame(
  game: SavedGame,
  opts?: { flipColor?: boolean },
): ShadowConfig | null {
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
