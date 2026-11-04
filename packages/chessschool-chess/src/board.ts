/** Board geometry and FEN reading. Rendering never needs a legal position, only this model. */

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = { type: PieceType; color: Color };
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type MoveRef = { from: Square; to: Square };

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const PIECE_NAMES: Record<PieceType, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export function isSquare(s: string): s is Square {
  return /^[a-h][1-8]$/.test(s);
}

export const fileIndex = (sq: Square) => sq.charCodeAt(0) - 97;
export const rankIndex = (sq: Square) => Number(sq[1]) - 1;
export const squareAt = (file: number, rank: number) => `${FILES[file]}${rank + 1}` as Square;

/** a1 is dark. */
export const isLightSquare = (sq: Square) => (fileIndex(sq) + rankIndex(sq)) % 2 === 1;

/** Squares in reading order (top-left first) for the given side at the bottom. */
export function boardSquares(orientation: Color = "w"): Square[] {
  const out: Square[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = orientation === "w" ? col : 7 - col;
      const rank = orientation === "w" ? 7 - row : row;
      out.push(squareAt(file, rank));
    }
  }
  return out;
}

/** Reads piece placement from a FEN (only the first field is required). */
export function readFen(fen: string): Map<Square, Piece> {
  const pieces = new Map<Square, Piece>();
  const rows = fen.trim().split(/\s+/)[0].split("/");
  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const lower = ch.toLowerCase() as PieceType;
      if (file < 8 && "pnbrqk".includes(lower)) pieces.set(squareAt(file, 7 - r), { type: lower, color: ch === lower ? "b" : "w" });
      file++;
    }
  });
  return pieces;
}

export function turnOf(fen: string): Color {
  return fen.split(/\s+/)[1] === "b" ? "b" : "w";
}

/** Plain-language square label for screen readers: "e4, white knight" / "e4, empty". */
export function squareLabel(sq: Square, piece: Piece | undefined): string {
  return piece ? `${sq}, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : `${sq}, empty`;
}

export type BoardArrow = { from: Square; to: Square; tone: "played" | "better" };
/** An arrow in board units (the board is 800 × 800, one square = 100): a shaft and a head polygon. */
export function arrowShape(a: BoardArrow, orientation: Color) {
  const at = (sq: Square) => {
    const f = fileIndex(sq);
    const r = rankIndex(sq);
    return orientation === "w" ? [f * 100 + 50, (7 - r) * 100 + 50] : [(7 - f) * 100 + 50, r * 100 + 50];
  };
  const [x1, y1] = at(a.from);
  const [tx, ty] = at(a.to);
  const ang = Math.atan2(ty - y1, tx - x1);
  const len = Math.hypot(tx - x1, ty - y1) - 30;
  const x2 = x1 + Math.cos(ang) * len;
  const y2 = y1 + Math.sin(ang) * len;
  const tip = [x2 + Math.cos(ang) * 32, y2 + Math.sin(ang) * 32];
  const side = (s: number) => [x2 + Math.cos(ang + (s * Math.PI) / 2) * 28, y2 + Math.sin(ang + (s * Math.PI) / 2) * 28];
  const r = (n: number) => Math.round(n * 10) / 10;
  return { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2), head: [tip, side(1), side(-1)].map(([x, y]) => `${r(x)},${r(y)}`).join(" ") };
}
