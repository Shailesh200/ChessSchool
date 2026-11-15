import { Chess } from "chess.js";
import { readFen, type Color, type Square } from "./board";

/** What a board reader returns: 8 ranks (8 down to 1), 8 characters each, "." for empty. */
export type ScannedBoard = { ranks: string[]; side: Color | null; confidence: number };

/** FEN piece placement from scanned ranks, or null if the grid is not 8 x 8 of piece letters and dots. */
export function placementFromRanks(ranks: unknown): string | null {
  if (!Array.isArray(ranks) || ranks.length !== 8) return null;
  if (!ranks.every((r) => typeof r === "string" && /^[KQRBNPkqrbnp.]{8}$/.test(r))) return null;
  return (ranks as string[]).map((r) => r.replace(/\.+/g, (dots) => String(dots.length))).join("/");
}

/** Puts `piece` ("N", "p", ...) on `square`, or empties it when null. Tapping the same piece again empties it. */
export function editPlacement(placement: string, square: Square, piece: string | null): string {
  const at = readFen(placement);
  const now = at.get(square);
  const same = now && piece && (now.color === "w" ? now.type.toUpperCase() : now.type) === piece;
  const ranks = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, f) => {
      const sq = `${"abcdefgh"[f]}${8 - r}` as Square;
      if (sq === square) return piece && !same ? piece : ".";
      const p = at.get(sq);
      return p ? (p.color === "w" ? p.type.toUpperCase() : p.type) : ".";
    }).join(""),
  );
  return placementFromRanks(ranks) ?? placement;
}

/** A full FEN for a set-up position: castling where king and rook stand on their home squares, no en passant. */
export function setupFen(placement: string, side: Color): string {
  const at = readFen(placement);
  const is = (sq: Square, ch: string) => {
    const p = at.get(sq);
    return Boolean(p && (p.color === "w" ? p.type.toUpperCase() : p.type) === ch);
  };
  const castling = [is("e1", "K") && is("h1", "R") && "K", is("e1", "K") && is("a1", "R") && "Q", is("e8", "k") && is("h8", "r") && "k", is("e8", "k") && is("a8", "r") && "q"].filter(Boolean).join("");
  return `${placement} ${side} ${castling || "-"} - 0 1`;
}

/** Why a set-up position can't be played, or null when chess.js accepts it. */
export function setupProblem(fen: string): "kings" | "pawns" | "check" | "invalid" | null {
  const pieces = [...readFen(fen).entries()];
  const kings = (c: Color) => pieces.filter(([, p]) => p.type === "k" && p.color === c).length;
  if (kings("w") !== 1 || kings("b") !== 1) return "kings";
  if (pieces.some(([sq, p]) => p.type === "p" && (sq[1] === "1" || sq[1] === "8"))) return "pawns";
  try {
    new Chess(fen);
    // The side not to move can't be in check.
    const other = new Chess(fen.replace(/ [wb] /, (m) => (m === " w " ? " b " : " w ")).replace(/ [KQkq]+ /, " - "));
    if (other.inCheck()) return "check";
    return null;
  } catch {
    return "invalid";
  }
}
