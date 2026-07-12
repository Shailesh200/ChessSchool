import { Chess } from "chess.js";
import type { Square, VerboseMove } from "../types/chess";

export interface Frame {
  ply: number;
  san: string | null;
  fen: string;
  from?: Square;
  to?: Square;
  captured?: string;
  check: boolean;
  mate: boolean;
}

export type MatePattern = "back-rank" | "diagonal" | "general";

export interface MateInfo {
  kingSquare: Square;
  attackers: Square[];
  covered: { square: Square; reason: "attacked" | "blocked" }[];
  pattern: MatePattern;
}

export function replayFrames(pgn: string): Frame[] {
  const source = new Chess();
  try {
    source.loadPgn(pgn);
  } catch {
    return [{ ply: 0, san: null, fen: new Chess().fen(), check: false, mate: false }];
  }
  const moves = source.history({ verbose: true });
  const g = new Chess();
  const frames: Frame[] = [{ ply: 0, san: null, fen: g.fen(), check: false, mate: false }];
  moves.forEach((m, i) => {
    g.move({ from: m.from, to: m.to, promotion: m.promotion });
    frames.push({
      ply: i + 1,
      san: m.san,
      fen: g.fen(),
      from: m.from as Square,
      to: m.to as Square,
      captured: m.captured,
      check: g.inCheck(),
      mate: g.isCheckmate(),
    });
  });
  return frames;
}

export function analyzeMate(fen: string): MateInfo | null {
  const g = new Chess(fen);
  if (!g.isCheckmate()) return null;
  const mated = g.turn();
  const enemy = mated === "w" ? "b" : "w";

  let kingSquare: Square | null = null;
  for (const row of g.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === mated) kingSquare = cell.square as Square;
    }
  }
  if (!kingSquare) return null;

  const attackers = g.attackers(kingSquare as never, enemy) as Square[];
  const file = kingSquare.charCodeAt(0);
  const rank = Number(kingSquare[1]);
  const covered: MateInfo["covered"] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = file + df;
      const r = rank + dr;
      if (f < 97 || f > 104 || r < 1 || r > 8) continue;
      const sq = `${String.fromCharCode(f)}${r}` as Square;
      const occupant = g.get(sq as never) as { color: typeof mated } | undefined;
      if (occupant && occupant.color === mated) covered.push({ square: sq, reason: "blocked" });
      else if (g.isAttacked(sq as never, enemy)) covered.push({ square: sq, reason: "attacked" });
    }
  }

  const ownBackRank = mated === "w" ? 1 : 8;
  let pattern: MatePattern = "general";
  for (const sq of attackers) {
    const piece = g.get(sq as never) as { type: string } | undefined;
    if (!piece) continue;
    const af = sq.charCodeAt(0);
    const ar = Number(sq[1]);
    const sameRank = ar === rank;
    const onDiagonal = Math.abs(af - file) === Math.abs(ar - rank);
    if ((piece.type === "r" || piece.type === "q") && sameRank && rank === ownBackRank) {
      pattern = "back-rank";
      break;
    }
    if ((piece.type === "b" || piece.type === "q") && onDiagonal) pattern = "diagonal";
  }

  return { kingSquare, attackers, covered, pattern };
}

export function matePreventionTip(pattern: MatePattern): string {
  if (pattern === "back-rank") {
    return "It's a back-rank mate — your own pawns trapped the king. Play a quiet pawn move (luft) earlier to give it air.";
  }
  if (pattern === "diagonal") {
    return "A diagonal mate — pushing the f- or g-pawns early opened lines to your king. Keep the squares around your king defended.";
  }
  return "Spot the attacker's path a move earlier: make an escape square, block the check, or trade off the attacking piece.";
}

export function lastMoveFrames(pgn: string, count = 5): Frame[] {
  const all = replayFrames(pgn);
  if (all.length <= 1) return all;
  const startPly = Math.max(0, all.length - 1 - count);
  return all.slice(startPly);
}

export function framesFromHistory(moves: VerboseMove[]): Frame[] {
  const g = new Chess();
  const frames: Frame[] = [{ ply: 0, san: null, fen: g.fen(), check: false, mate: false }];
  moves.forEach((m, i) => {
    g.move({ from: m.from, to: m.to, promotion: m.promotion });
    frames.push({
      ply: i + 1,
      san: m.san,
      fen: g.fen(),
      from: m.from,
      to: m.to,
      captured: m.captured,
      check: g.inCheck(),
      mate: g.isCheckmate(),
    });
  });
  return frames;
}

export function lastMoveFramesFromHistory(moves: VerboseMove[], count = 5): Frame[] {
  const all = framesFromHistory(moves);
  if (all.length <= 1) return all;
  const startPly = Math.max(0, all.length - 1 - count);
  return all.slice(startPly);
}
