import { fileIndex, FILES, rankIndex, squareAt, type PieceType, type Square } from "./board";

/** Board-vision games in the Gym: 30 seconds each. */
export type VisionGame = "name" | "attack" | "knight";
export const VISION_GAMES: readonly VisionGame[] = ["name", "attack", "knight"];
export const VISION_SECONDS = 30;
/** Highest score the API accepts for one 30-second run. */
export const VISION_MAX_SCORE = 200;

export const isVisionGame = (g: unknown): g is VisionGame => VISION_GAMES.includes(g as VisionGame);
export const isVisionScore = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= VISION_MAX_SCORE;

const ALL: Square[] = FILES.flatMap((_, f) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => squareAt(f, r)));
const pick = <T>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length) % list.length];
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

/** FEN with a single white piece on `square` (or an empty board). */
export function loneFen(piece: PieceType | null, square?: Square): string {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    const f = piece && square && rankIndex(square) === r ? fileIndex(square) : -1;
    rows.push(f < 0 ? "8" : `${f || ""}${piece!.toUpperCase()}${7 - f || ""}`);
  }
  return `${rows.join("/")} w - - 0 1`;
}

/** Squares a lone white piece on `from` attacks on an empty board (a pawn attacks diagonally forward). */
export function attackSet(type: PieceType, from: Square): Square[] {
  const f0 = fileIndex(from);
  const r0 = rankIndex(from);
  const out: Square[] = [];
  const steps = (dirs: number[][], slide: boolean) => {
    for (const [df, dr] of dirs) {
      let f = f0 + df;
      let r = r0 + dr;
      while (onBoard(f, r)) {
        out.push(squareAt(f, r));
        if (!slide) break;
        f += df;
        r += dr;
      }
    }
  };
  const straight = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  if (type === "n") steps([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], false);
  else if (type === "b") steps(diagonal, true);
  else if (type === "r") steps(straight, true);
  else if (type === "q") steps([...straight, ...diagonal], true);
  else if (type === "k") steps([...straight, ...diagonal], false);
  else steps([[1, 1], [-1, 1]], false);
  return out;
}

/** Fewest knight hops from `from` to `to`. */
export function knightDistance(from: Square, to: Square): number {
  const seen = new Map<Square, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const sq = queue.shift()!;
    const d = seen.get(sq)!;
    if (sq === to) return d;
    for (const next of attackSet("n", sq)) {
      if (!seen.has(next)) {
        seen.set(next, d + 1);
        queue.push(next);
      }
    }
  }
  return -1;
}

/** Name the square: one square and four different names to choose from, the answer among them. */
export function nameRound(rand: () => number = Math.random): { square: Square; choices: Square[] } {
  const square = pick(ALL, rand);
  const choices = [square];
  while (choices.length < 4) {
    const other = pick(ALL, rand);
    if (!choices.includes(other)) choices.push(other);
  }
  // Shuffle so the answer is not always first.
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { square, choices };
}

/** Tap what it attacks: a piece alone on a square, and every square it attacks. Pawns stay off the back ranks. */
export function attackRound(rand: () => number = Math.random): { piece: PieceType; from: Square; targets: Square[] } {
  const piece = pick<PieceType>(["n", "b", "r", "q", "k", "p"], rand);
  const from = pick(
    ALL.filter((s) => piece !== "p" || (rankIndex(s) > 0 && rankIndex(s) < 7)),
    rand,
  );
  return { piece, from, targets: attackSet(piece, from) };
}

/** Knight hops: a new target two or three hops away from the knight. */
export function knightTarget(from: Square, rand: () => number = Math.random): Square {
  return pick(
    ALL.filter((s) => {
      const d = knightDistance(from, s);
      return d === 2 || d === 3;
    }),
    rand,
  );
}

export type VisionRound =
  | { game: "name"; square: Square; choices: Square[] }
  | { game: "attack"; piece: PieceType; from: Square; targets: Square[]; found: Square[] }
  | { game: "knight"; from: Square; target: Square };
export type VisionPlay = { round: VisionRound; score: number };

function newRound(game: VisionGame, rand: () => number, knightOn?: Square): VisionRound {
  if (game === "name") return { game, ...nameRound(rand) };
  if (game === "attack") return { game, ...attackRound(rand), found: [] };
  const from = knightOn ?? pick(ALL, rand);
  return { game, from, target: knightTarget(from, rand) };
}

export const startVision = (game: VisionGame, rand: () => number = Math.random): VisionPlay => ({ round: newRound(game, rand), score: 0 });

/** The FEN to show: an empty board for naming, else the lone piece. */
export const visionFen = (r: VisionRound) => (r.game === "name" ? loneFen(null) : loneFen(r.game === "attack" ? r.piece : "n", r.from));

/**
 * One answer (a tapped square, or a chosen name). A point for each right square; a wrong name or a wrong
 * attack square deals a new round, with `missed` the squares that were left to find. A non-knight move is ignored.
 */
export function visionAnswer(play: VisionPlay, sq: Square, rand: () => number = Math.random): { play: VisionPlay; result: "hit" | "miss" | "none"; missed: Square[] } {
  const r = play.round;
  const next = (score: number, result: "hit" | "miss", missed: Square[] = [], knightOn?: Square) => ({ play: { round: newRound(r.game, rand, knightOn), score }, result, missed });
  if (r.game === "name") return sq === r.square ? next(play.score + 1, "hit") : next(play.score, "miss", [r.square]);
  if (r.game === "knight") {
    if (!attackSet("n", r.from).includes(sq)) return { play, result: "none", missed: [] };
    if (sq === r.target) return next(play.score + 1, "hit", [], sq);
    return { play: { ...play, round: { ...r, from: sq } }, result: "hit", missed: [] };
  }
  if (sq === r.from || r.found.includes(sq)) return { play, result: "none", missed: [] };
  if (!r.targets.includes(sq)) return next(play.score, "miss", r.targets.filter((t) => !r.found.includes(t)));
  const found = [...r.found, sq];
  if (found.length === r.targets.length) return next(play.score + 1, "hit");
  return { play: { score: play.score + 1, round: { ...r, found } }, result: "hit", missed: [] };
}
