import { copy } from "./copy";

type PieceLetter = "p" | "n" | "b" | "r" | "q" | "k";
export type SpokenMove = { piece: PieceLetter; to: string; capture: boolean; castle: "king" | "queen" | null; promoted: PieceLetter | null; check: boolean; mate: boolean };

/** Screen-reader label for a square: "e4, white knight" / "e4, empty". */
export function squareSpeech(sq: string, piece: { type: PieceLetter; color: "w" | "b" } | undefined): string {
  return copy.a11y.square(sq, piece ? copy.a11y.piece(piece.color, piece.type) : null);
}

/** What the board announces after a move: "Knight to f3. Check". */
export function moveSpeech(m: SpokenMove): string {
  const a = copy.a11y;
  const name = a.pieceNames[m.piece];
  const parts = [m.castle ? a.castles[m.castle] : m.capture ? a.takes(name, m.to) : a.moves(name, m.to)];
  if (m.promoted) parts.push(a.promotes(a.pieceNames[m.promoted]));
  if (m.mate) parts.push(a.mate);
  else if (m.check) parts.push(a.check);
  return parts.join(a.sep);
}
