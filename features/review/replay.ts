import { Chess } from "chess.js";
import type { Color, Square } from "@/core/types/chess";

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

/** Reconstruct every position from a PGN, one frame per ply (frame 0 = start). */
export function replayFrames(pgn: string): Frame[] {
  const source = new Chess();
  try {
    source.loadPgn(pgn);
  } catch {
    return [{ ply: 0, san: null, fen: new Chess().fen(), check: false, mate: false }];
  }
  const moves = source.history({ verbose: true }) as Array<{
    from: Square;
    to: Square;
    san: string;
    promotion?: string;
    captured?: string;
  }>;
  const g = new Chess();
  const frames: Frame[] = [
    { ply: 0, san: null, fen: g.fen(), check: false, mate: false },
  ];
  moves.forEach((m, i) => {
    g.move({ from: m.from, to: m.to, promotion: m.promotion as never });
    frames.push({
      ply: i + 1,
      san: m.san,
      fen: g.fen(),
      from: m.from,
      to: m.to,
      captured: m.captured,
      check: g.isCheck(),
      mate: g.isCheckmate(),
    });
  });
  return frames;
}

export type MatePattern = "back-rank" | "diagonal" | "general";

export interface MateInfo {
  kingSquare: Square;
  /** enemy squares delivering check */
  attackers: Square[];
  /** adjacent squares the king cannot use, with the reason */
  covered: { square: Square; reason: "attacked" | "blocked" }[];
  pattern: MatePattern;
}

/** Explain *how* the checkmate works from a terminal (mated) FEN. */
export function analyzeMate(fen: string): MateInfo | null {
  const g = new Chess(fen);
  if (!g.isCheckmate()) return null;
  const mated: Color = g.turn();
  const enemy: Color = mated === "w" ? "b" : "w";

  // locate the mated king
  let kingSquare: Square | null = null;
  for (const row of g.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === mated) kingSquare = cell.square;
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
      const occupant = g.get(sq as never) as { color: Color } | undefined;
      if (occupant && occupant.color === mated) {
        covered.push({ square: sq, reason: "blocked" });
      } else if (g.isAttacked(sq as never, enemy)) {
        covered.push({ square: sq, reason: "attacked" });
      }
    }
  }

  // Classify the mating pattern from the checking piece(s) relative to the king.
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
    if ((piece.type === "b" || piece.type === "q") && onDiagonal) {
      pattern = "diagonal";
    }
  }

  return { kingSquare, attackers, covered, pattern };
}
