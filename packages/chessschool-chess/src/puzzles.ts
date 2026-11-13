import type { Chess, Move } from "chess.js";
import { turnOf, type Color, type MoveRef, type PromotionPiece, type Square } from "./board";
import { kingInCheck, load, moveRef, parseUci, tryMove } from "./game";
import { FALLBACK_PACK } from "./puzzles.fallback";
import { PUZZLE_SOURCE } from "./puzzleSource";
import { pick, sameMove, type BoardView } from "./runner";

export const PUZZLE_THEME_TAGS = ["mateIn1", "mateIn2", "fork", "pin", "skewer", "hangingPiece", "discoveredAttack", "backRankMate", "promotion", "endgame", "defensiveMove", "sacrifice"] as const;
export type PuzzleThemeId = (typeof PUZZLE_THEME_TAGS)[number];
export type Puzzle = { id: string; fen: string; moves: string[]; rating: number; themes: PuzzleThemeId[] };
export type PuzzlePack = { version: string; puzzles: Puzzle[] };

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

export type PuzzlePackStatus = "loading" | "cache" | "api" | "fallback";

let pack: PuzzlePack = FALLBACK_PACK;
/** Bundled mode is ready immediately. API mode stays loading until a cache or the network settles. */
let status: PuzzlePackStatus = PUZZLE_SOURCE === "bundled" ? "fallback" : "loading";
const packListeners = new Set<() => void>();
/** Puzzle captured when today's daily was served, so a later pack swap can still render it. */
let dailyLock: { day: string; puzzle: Puzzle } | null = null;

function notifyPack() {
  for (const fn of packListeners) fn();
}

/** Replace the live pack. An empty pack is ignored so a bad payload cannot wipe the store. */
export function setPuzzlePack(next: PuzzlePack) {
  if (!next || typeof next.version !== "string" || !next.version || !Array.isArray(next.puzzles) || next.puzzles.length === 0) return;
  pack = { version: next.version, puzzles: next.puzzles };
  notifyPack();
}

export function setPuzzlePackStatus(next: PuzzlePackStatus) {
  if (status === next) return;
  status = next;
  notifyPack();
}

export function getPuzzlePackVersion(): string {
  return pack.version;
}

export function getPuzzlePackStatus(): PuzzlePackStatus {
  return status;
}

export function packReady(): boolean {
  return status !== "loading";
}

export function subscribePuzzlePack(fn: () => void): () => void {
  packListeners.add(fn);
  return () => packListeners.delete(fn);
}

/** Remember the puzzle object for this day. Pass null to clear (tests). */
export function lockDailyPuzzle(day: string, puzzle: Puzzle | null) {
  dailyLock = puzzle ? { day, puzzle } : null;
}

/** The live pack (fallback until a cached or API pack is installed). */
export function allPuzzles(): Puzzle[] {
  return pack.puzzles;
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

/**
 * Puzzle themes a finished lesson unlocks. Lessons that only teach the board, openings or
 * how the pieces move do not narrow the daily puzzle.
 */
const LESSON_PUZZLE_THEMES: Readonly<Record<string, readonly PuzzleThemeId[]>> = {
  check: ["mateIn1"],
  forks: ["fork"],
  pins: ["pin"],
  values: ["hangingPiece"],
  special: ["promotion"],
  ladder: ["mateIn1", "mateIn2"],
  queenMate: ["mateIn1", "mateIn2"],
  skewer: ["skewer"],
  discovery: ["discoveredAttack"],
  defender: ["defensiveMove"],
  doubleCheck: ["discoveredAttack", "mateIn1"],
  activeKing: ["endgame"],
  opposition: ["endgame"],
  passedPawn: ["endgame", "promotion"],
  escort: ["endgame", "promotion"],
  rookFile: ["endgame"],
  backRank: ["backRankMate", "mateIn1"],
  smothered: ["mateIn1"],
  arabian: ["mateIn1", "mateIn2"],
  bishopPair: ["endgame"],
  rookKing: ["mateIn1", "endgame"],
  sacrifice: ["sacrifice"],
  queenEnding: ["endgame"],
};

/** Themes of lessons the learner has completed, in first-seen order. Unknown ids add nothing. */
export function themesForCompletedLessons(completedIds: Iterable<string>): PuzzleThemeId[] {
  const out: PuzzleThemeId[] = [];
  const have = new Set<PuzzleThemeId>();
  for (const id of completedIds) {
    for (const theme of LESSON_PUZZLE_THEMES[id] ?? []) {
      if (have.has(theme)) continue;
      have.add(theme);
      out.push(theme);
    }
  }
  return out;
}

function dayHash(day: string): number {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Date-seeded puzzle from the everyday band. Same result for every learner on that day. */
function dateSeededPuzzle(day: string): Puzzle {
  const all = allPuzzles();
  const pool = all.filter((p) => p.rating >= 800 && p.rating <= 1500);
  const list = pool.length ? pool : all;
  return list[dayHash(day) % list.length];
}

/**
 * Puzzle to show for a local day, once the pack is ready.
 * A persisted `servedId` stays for that day: the copy in the current pack if it is still there,
 * otherwise `stored` (or the in-memory lock). Nothing is chosen, and `persist` stays false, while loading.
 */
export function selectDailyPuzzle(opts: {
  day: string;
  completedThemes?: readonly string[];
  seenIds?: Iterable<string>;
  servedDay?: string | null;
  servedId?: string | null;
  stored?: Puzzle | null;
}): { puzzle: Puzzle | null; persist: boolean } {
  if (!packReady()) return { puzzle: null, persist: false };
  const lockedId = opts.servedDay === opts.day && opts.servedId ? opts.servedId : null;
  if (lockedId) {
    const fromPack = puzzleById(lockedId);
    if (fromPack) {
      dailyLock = { day: opts.day, puzzle: fromPack };
      return { puzzle: fromPack, persist: false };
    }
    const fromMemory = dailyLock && dailyLock.day === opts.day && dailyLock.puzzle.id === lockedId ? dailyLock.puzzle : null;
    const kept = opts.stored?.id === lockedId ? opts.stored : fromMemory;
    if (kept) {
      dailyLock = { day: opts.day, puzzle: kept };
      return { puzzle: kept, persist: false };
    }
    return { puzzle: null, persist: false };
  }
  const puzzle = dailyPuzzle(opts.day, opts.completedThemes ?? [], opts.seenIds ?? []);
  return { puzzle, persist: true };
}

/**
 * One puzzle for a local day (`YYYY-MM-DD`).
 * Picks deterministically from puzzles whose themes match `completedThemes`, skipping `seenIds`.
 * Falls back to the date-seeded puzzle when no themes are completed or every match was already served.
 */
export function dailyPuzzle(day: string, completedThemes: readonly string[] = [], seenIds: Iterable<string> = []): Puzzle {
  const themes = new Set(completedThemes);
  const seen = new Set(seenIds);
  if (themes.size) {
    const pool = allPuzzles()
      .filter((p) => !seen.has(p.id) && p.themes.some((t) => themes.has(t)))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (pool.length) return pool[dayHash(day) % pool.length];
  }
  return dateSeededPuzzle(day);
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

/** How long to wait before the opponent plays. `null` when it is the learner's turn. */
export function puzzleBeatDelay(status: PuzzleStatus): number | null {
  if (status === "setup") return 600;
  if (status === "reply") return 420;
  return null;
}

export type PuzzleBeat = { key: string; alive: boolean; cancel: () => void };

/**
 * Arms the opponent beat once per status+step. Calling it again for the same live beat keeps the
 * original timer, so a re-render cannot cancel the move before it plays. A beat that was already
 * cancelled (unmount, or a new step) is replaced.
 */
export function armPuzzleBeat(status: PuzzleStatus, step: number, pending: PuzzleBeat | null, fire: () => void): PuzzleBeat | null {
  const delay = puzzleBeatDelay(status);
  if (delay == null) {
    pending?.cancel();
    return null;
  }
  const key = `${status}:${step}`;
  if (pending?.key === key && pending.alive) return pending;
  pending?.cancel();
  const timers = globalThis as unknown as {
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  };
  const beat: PuzzleBeat = {
    key,
    alive: true,
    cancel: () => {
      if (!beat.alive) return;
      beat.alive = false;
      timers.clearTimeout(timer);
    },
  };
  const timer = timers.setTimeout(() => {
    beat.alive = false;
    fire();
  }, delay);
  return beat;
}

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
