import { fileIndex, moveEffects, readFen, turnOf, type Color, type MoveRef, type Square } from "./board";
import { bestMove, quickEval } from "./engine";
import { kingInCheck, legalTargets, load, moveRef, tryMove } from "./game";

export type ReviewPly = { ply: number; san: string; by: Color; fenBefore: string; fen: string; lastMove: MoveRef; check: string | null };

/** Every position of a game, for stepping through it. Stops at the first unreadable move. */
export function reviewPlies(startFen: string, history: string[]): ReviewPly[] {
  const chess = load(startFen);
  const out: ReviewPly[] = [];
  for (const [i, san] of history.entries()) {
    const fenBefore = chess.fen();
    let m;
    try {
      m = chess.move(san);
    } catch {
      break;
    }
    out.push({ ply: i + 1, san: m.san, by: turnOf(fenBefore), fenBefore, fen: chess.fen(), lastMove: moveRef(m), check: kingInCheck(chess) });
  }
  return out;
}

export type MoveVerdict = "good" | "inaccuracy" | "mistake" | "blunder";
export type MoveNote = {
  verdict: MoveVerdict;
  /** Centipawns the move gave away, from the mover's side. */
  loss: number;
  better: string | null;
  betterMove: MoveRef | null;
  /** Evaluation after the move, White's point of view, centipawns (clamped to ±EVAL_CAP). */
  evalAfter: number;
};

export const EVAL_CAP = 1500;
const clamp = (cp: number) => Math.max(-EVAL_CAP, Math.min(EVAL_CAP, Math.round(cp)));

/** How much a move cost (in centipawns), the position afterwards, and what Cody would have played instead. */
export function assessMove(p: ReviewPly): MoveNote {
  const before = quickEval(p.fenBefore);
  const after = -quickEval(p.fen);
  const loss = Math.max(0, clamp(before) - clamp(after));
  const verdict: MoveVerdict = loss >= 400 ? "blunder" : loss >= 200 ? "mistake" : loss >= 90 ? "inaccuracy" : "good";
  const evalAfter = clamp(p.by === "w" ? after : -after);
  if (verdict === "good") return { verdict, loss, better: null, betterMove: null, evalAfter };
  const alt = bestMove(p.fenBefore, { depth: 2, quiescence: 3, timeMs: 500, noise: 0 });
  const differs = alt && alt.san !== p.san;
  return { verdict, loss, better: differs ? alt.san : null, betterMove: differs ? { from: alt.from as Square, to: alt.to as Square } : null, evalAfter };
}

export type KeyMoment = { ply: number; kind: MoveVerdict | "great" | "mate" };
export type GameSummary = {
  /** 0–100; every move scores 100 × e^(−loss / 350). */
  accuracy: number;
  counts: Record<MoveVerdict, number>;
  moments: KeyMoment[];
  /** The learner's move that turned the game most in their favour (at least 1.5 pawns), if any. */
  best: number | null;
};

/**
 * Sums up one side's moves (`side` null: every move, for pass & play).
 * `notes` is keyed by ply and may be partial while analysis is still running.
 */
export function summarise(plies: ReviewPly[], notes: Record<number, MoveNote>, side: Color | null): GameSummary {
  const counts: Record<MoveVerdict, number> = { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const moments: KeyMoment[] = [];
  let score = 0;
  let n = 0;
  let best: number | null = null;
  let bestSwing = 150;
  for (const p of plies) {
    const note = notes[p.ply];
    if (!note || (side && p.by !== side)) continue;
    counts[note.verdict]++;
    score += 100 * Math.exp(-note.loss / 350);
    n++;
    const pov = p.by === "w" ? 1 : -1;
    const prev = p.ply > 2 ? notes[p.ply - 2] : null;
    const swing = (note.evalAfter - (prev ? prev.evalAfter : 0)) * pov;
    if (note.verdict !== "good") moments.push({ ply: p.ply, kind: note.verdict });
    else if (swing >= bestSwing) {
      bestSwing = swing;
      best = p.ply;
    }
  }
  if (best) moments.push({ ply: best, kind: "great" });
  const last = plies.at(-1);
  if (last && last.san.endsWith("#") && (!side || last.by === side)) moments.push({ ply: last.ply, kind: "mate" });
  moments.sort((a, b) => a.ply - b.ply);
  return { accuracy: n ? Math.round(score / n) : 0, counts, moments, best };
}

export type MoveCue = "move" | "capture" | "check" | "mate" | "castle" | "promote";
/** Which sound a move makes. */
export function moveCue(san: string): MoveCue {
  if (san.includes("#")) return "mate";
  if (san.includes("+")) return "check";
  if (san.includes("=")) return "promote";
  if (san.startsWith("O-O")) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}

/** The sound for a move when only the positions are known (lessons, puzzles). */
export function positionCue(beforeFen: string, afterFen: string, move: MoveRef | null): MoveCue {
  const after = load(afterFen);
  if (after.isCheckmate()) return "mate";
  if (after.inCheck()) return "check";
  const e = moveEffects(beforeFen, afterFen, move);
  if (e.promoted) return "promote";
  if (e.captured) return "capture";
  const mover = move ? readFen(beforeFen).get(move.from) : undefined;
  if (move && mover?.type === "k" && Math.abs(fileIndex(move.from) - fileIndex(move.to)) === 2) return "castle";
  return "move";
}

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
/** Material on the board, White minus Black, in pawns. */
export function materialEdge(fen: string): number {
  let edge = 0;
  for (const p of readFen(fen).values()) edge += (p.color === "w" ? 1 : -1) * VALUE[p.type];
  return edge;
}

/** "+1.4", "−0.6", "0.0", or "+M" / "−M" once a mate is forced (White's point of view). */
export function formatEval(cp: number): string {
  if (Math.abs(cp) >= EVAL_CAP) return cp > 0 ? "+M" : "−M";
  const v = Math.abs(cp) < 5 ? 0 : cp / 100;
  return v === 0 ? "0.0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

/** Share of the evaluation bar that is White's, 0–1 (six pawns or more fills it). */
export const evalShare = (cp: number) => 0.5 + Math.max(-1, Math.min(1, cp / 600)) / 2;

/** "Try the better move": the learner gets the position before their move and must find Cody's suggestion. */
export type TryState = { fen: string; target: MoveRef; selected: Square | null; targets: Square[]; lastMove: MoveRef | null; status: "trying" | "right" | "wrong" | "shown"; misses: number };

export const startTry = (fenBefore: string, target: MoveRef): TryState => ({ fen: fenBefore, target, selected: null, targets: [], lastMove: null, status: "trying", misses: 0 });

/** Give up and see the answer (the board stays on the position before the move). */
export const showTry = (s: TryState): TryState => ({ ...s, selected: null, targets: [], status: "shown" });

export function tryReduce(s: TryState, sq: Square): TryState {
  if (s.status === "right" || s.status === "shown") return s;
  const chess = load(s.fen);
  if (s.selected && s.targets.includes(sq)) {
    if (s.selected === s.target.from && sq === s.target.to) {
      const m = tryMove(chess, s.selected, sq);
      return { ...s, fen: chess.fen(), selected: null, targets: [], lastMove: m ? moveRef(m) : s.target, status: "right" };
    }
    return { ...s, selected: null, targets: [], status: "wrong", misses: s.misses + 1 };
  }
  const piece = readFen(s.fen).get(sq);
  if (piece && piece.color === chess.turn()) return { ...s, selected: sq, targets: legalTargets(chess, sq), status: s.status === "wrong" ? "trying" : s.status };
  return { ...s, selected: null, targets: [] };
}
