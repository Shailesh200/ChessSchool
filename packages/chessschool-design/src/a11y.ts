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

/** Smallest touch target we allow anywhere (WCAG 2.5.5 / Apple HIG). Primary buttons use the larger `minTarget`. */
export const MIN_TOUCH = 44;

/** Extra touch area around a control drawn smaller than MIN_TOUCH, split evenly on each side. */
export function hitSlopFor(width: number, height = width): { top: number; bottom: number; left: number; right: number } {
  const x = Math.max(0, Math.ceil((MIN_TOUCH - width) / 2));
  const y = Math.max(0, Math.ceil((MIN_TOUCH - height) / 2));
  return { top: y, bottom: y, left: x, right: x };
}

/**
 * How a highlighted square is marked besides its colour, for colour-blind learners ("Shapes on highlights").
 * last: dashed corner brackets; hint: diagonal stripes; teach: a solid inner ring; target: the existing dot / ring.
 * With shapes off, only `target` (already a shape) is drawn.
 */
export type SquareMark = "last" | "hint" | "teach" | "target";
export function squareMarks(s: { last?: boolean; hint?: boolean; teach?: boolean; target?: boolean }, shapes: boolean): SquareMark[] {
  const out: SquareMark[] = [];
  if (shapes && s.last) out.push("last");
  if (shapes && s.hint) out.push("hint");
  if (shapes && s.teach) out.push("teach");
  if (s.target) out.push("target");
  return out;
}

/** Screen-reader words for a square's highlights, so a hint or the last move is never shown by colour alone. */
export function markSpeech(s: { last?: boolean; hint?: boolean }): string[] {
  const out: string[] = [];
  if (s.last) out.push(copy.platform.marks.lastMove);
  if (s.hint) out.push(copy.platform.marks.hintSquare);
  return out;
}
