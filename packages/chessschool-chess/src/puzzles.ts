import type { Chess, Move } from "chess.js";
import { turnOf, type Color, type MoveRef, type PromotionPiece, type Square } from "./board";
import { kingInCheck, load, moveRef, parseUci, tryMove } from "./game";
import { PUZZLE_ROWS, PUZZLE_THEME_TAGS } from "./puzzles.data";
import { pick, sameMove, type BoardView } from "./runner";

export type PuzzleThemeId = (typeof PUZZLE_THEME_TAGS)[number];
export type Puzzle = { id: string; fen: string; moves: string[]; rating: number; themes: PuzzleThemeId[] };

export const PUZZLE_THEMES: readonly { id: PuzzleThemeId; name: string; blurb: string }[] = [
  { id: "mateIn1", name: "Mate in one", blurb: "Finish the game in a single move." },
  { id: "mateIn2", name: "Mate in two", blurb: "A short checkmate combination." },
  { id: "fork", name: "Forks", blurb: "Attack two things at once." },
  { id: "pin", name: "Pins", blurb: "Freeze a piece in front of a bigger one." },
  { id: "skewer", name: "Skewers", blurb: "Hit a big piece, win the one behind." },
  { id: "hangingPiece", name: "Free pieces", blurb: "Spot what's left unprotected." },
  { id: "discoveredAttack", name: "Discovered attacks", blurb: "Move one piece to unleash another." },
  { id: "backRankMate", name: "Back-rank mates", blurb: "When the king is stuck behind its pawns." },
  { id: "promotion", name: "Promotion", blurb: "Turn a pawn into a queen." },
  { id: "endgame", name: "Endgames", blurb: "Few pieces, precise moves." },
  { id: "defensiveMove", name: "Defence", blurb: "Find the move that saves you." },
  { id: "sacrifice", name: "Sacrifices", blurb: "Give something to get more." },
];

let cache: Puzzle[] | null = null;
/** The bundled pack (parsed once). */
export function allPuzzles(): Puzzle[] {
  if (!cache) cache = PUZZLE_ROWS.map(([id, fen, moves, rating, tags]) => ({ id, fen, moves: moves.split(" "), rating, themes: tags.map((t) => PUZZLE_THEME_TAGS[t]) }));
  return cache;
}
export const puzzleById = (id: string) => allPuzzles().find((p) => p.id === id) ?? null;
export const themeCount = (theme: PuzzleThemeId) => allPuzzles().filter((p) => p.themes.includes(theme)).length;

/** A puzzle near `rating` (optionally of one theme), avoiding recently seen ids. */
export function nextPuzzle(opts: { rating: number; theme?: PuzzleThemeId | null; exclude?: Iterable<string>; rand?: () => number }): Puzzle {
  const rand = opts.rand ?? Math.random;
  const skip = new Set(opts.exclude ?? []);
  const pool = allPuzzles().filter((p) => (!opts.theme || p.themes.includes(opts.theme)) && !skip.has(p.id));
  const list = pool.length ? pool : allPuzzles();
  for (const width of [100, 200, 400, 2000]) {
    const near = list.filter((p) => Math.abs(p.rating - opts.rating) <= width);
    if (near.length) return near[Math.floor(rand() * near.length)];
  }
  return list[0];
}

/** Same puzzle for everyone on a given local day. */
export function dailyPuzzle(day: string): Puzzle {
  const pool = allPuzzles().filter((p) => p.rating >= 800 && p.rating <= 1500);
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return pool[Math.abs(h) % pool.length];
}

export const START_RATING = 600;
/** Elo update against the puzzle's rating; settles faster for new solvers. */
export function updateRating(rating: number, puzzleRating: number, solved: boolean, attempts: number): number {
  const k = attempts < 20 ? 40 : 20;
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.round(Math.max(100, Math.min(3000, rating + k * ((solved ? 1 : 0) - expected))));
}

/* ---------------- solving ---------------- */

export type PuzzleStatus = "setup" | "solving" | "reply" | "solved" | "failed";
export type PuzzleState = BoardView & {
  puzzle: Puzzle;
  you: Color;
  /** Index in `puzzle.moves` of the next expected move. */
  step: number;
  status: PuzzleStatus;
  hint: boolean;
  /** The learner got it wrong at least once (counts as a fail for rating). */
  missed: boolean;
  /** A pawn waiting on the last rank for the learner to pick a piece. */
  promotion: MoveRef | null;
};
export type PuzzleAction =
  | { type: "setup" }
  | { type: "reply" }
  | { type: "tap"; square: Square }
  | { type: "promote"; piece: PromotionPiece }
  | { type: "cancelPromotion" }
  | { type: "hint" }
  | { type: "retry" }
  | { type: "solution" };

/** The first move in a puzzle is the opponent's; the learner answers it. */
export function startPuzzle(puzzle: Puzzle): PuzzleState {
  return {
    puzzle,
    you: turnOf(puzzle.fen) === "w" ? "b" : "w",
    step: 0,
    status: "setup",
    hint: false,
    missed: false,
    promotion: null,
    fen: puzzle.fen,
    selected: null,
    targets: [],
    lastMove: null,
    check: kingInCheck(load(puzzle.fen)),
  };
}

function apply(s: PuzzleState, uci: string): PuzzleState {
  const chess = load(s.fen);
  const ref = parseUci(uci)!;
  const m = tryMove(chess, ref.from, ref.to, (uci[4] as "q") ?? "q");
  if (!m) return s;
  return { ...s, fen: chess.fen(), lastMove: moveRef(m), check: kingInCheck(chess), step: s.step + 1, selected: null, targets: [] };
}

export function puzzleReduce(s: PuzzleState, a: PuzzleAction): PuzzleState {
  const moves = s.puzzle.moves;
  if (a.type === "setup") return s.status === "setup" ? { ...apply(s, moves[0]), status: "solving" } : s;
  if (a.type === "reply") {
    if (s.status !== "reply") return s;
    const next = apply(s, moves[s.step]);
    return { ...next, status: next.step >= moves.length ? "solved" : "solving" };
  }
  if (a.type === "hint") return s.status === "solving" ? { ...s, hint: true, missed: true } : s;
  if (a.type === "retry") {
    if (s.status !== "failed") return s;
    // Back to the learner's first move.
    let r = startPuzzle(s.puzzle);
    r = { ...apply(r, moves[0]), status: "solving", missed: true };
    return r;
  }
  if (a.type === "solution") {
    // Replay from the start: after a wrong move the board shows the learner's move, not the puzzle.
    let r: PuzzleState = { ...startPuzzle(s.puzzle), hint: false };
    while (r.step < moves.length) {
      const next = apply(r, moves[r.step]);
      if (next === r) break;
      r = next;
    }
    return { ...r, status: "failed", missed: true };
  }

  if (a.type === "cancelPromotion") return { ...s, promotion: null, selected: null, targets: [] };
  if (a.type === "promote") {
    if (!s.promotion || s.status !== "solving") return s;
    const chess = load(s.fen);
    const move = tryMove(chess, s.promotion.from, s.promotion.to, a.piece);
    return move ? judge({ ...s, promotion: null }, move, chess) : { ...s, promotion: null };
  }

  // tap
  if (s.status !== "solving" || s.promotion) return s;
  const p = pick(s.fen, s.selected, s.targets, a.square, s.you, true);
  if (p.kind === "select") return { ...s, selected: p.selected, targets: p.targets };
  if (p.kind === "promote") return { ...s, promotion: { from: p.from, to: p.to } };
  if (p.kind !== "move") return { ...s, selected: null, targets: [] };
  return judge(s, p.move, p.chess);
}

function judge(s: PuzzleState, move: Move, after: Chess): PuzzleState {
  const moves = s.puzzle.moves;
  const last = s.step === moves.length - 1;
  // Any checkmate on the final move counts.
  const right = sameMove(move, moves[s.step]) || (last && after.isCheckmate());
  if (!right) return { ...s, status: "failed", missed: true, selected: null, targets: [], lastMove: moveRef(move), fen: after.fen(), check: kingInCheck(after) };
  const next = apply(s, `${move.from}${move.to}${move.promotion ?? ""}`);
  if (next.step >= moves.length) return { ...next, status: "solved" };
  return { ...next, status: "reply" };
}

/** Squares to highlight when the learner asks for a hint: the piece to move. */
export function puzzleHint(s: PuzzleState): Square[] {
  if (!s.hint || s.status !== "solving") return [];
  const ref = parseUci(s.puzzle.moves[s.step]);
  return ref ? [ref.from] : [];
}
