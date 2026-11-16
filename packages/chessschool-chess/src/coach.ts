import type { Chess, Move } from "chess.js";
import { readFen, squareAt, fileIndex, rankIndex, type Color, type PieceType, type Square } from "./board";
import { quickEval } from "./engine";
import { load, withTurn } from "./game";
import { assessMove, decisiveMoment, EVAL_CAP, reviewPlies, type MoveNote, type MoveVerdict, type ReviewPly } from "./review";

/**
 * Mistake detectors for the AI coach and the skills tracker. Each one is a plain board check
 * (no engine), so the facts the coach talks about are things the board really shows.
 */
export type MistakeTag = "hanging" | "freePiece" | "fork" | "pin" | "mate" | "backRank";

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const other = (c: Color): Color => (c === "w" ? "b" : "w");

/** Pieces of `color` (knights and up) the other side can win: attacked and undefended, or attacked by something cheaper. */
export function hangingPieces(fen: string, color: Color): Square[] {
  const chess = load(fen);
  const out: Square[] = [];
  for (const [sq, p] of readFen(fen)) {
    if (p.color !== color || p.type === "k" || VALUE[p.type] < 3) continue;
    const attackers = chess.attackers(sq, other(color));
    if (!attackers.length) continue;
    const cheapest = Math.min(...attackers.map((a) => VALUE[chess.get(a)!.type]));
    if (cheapest < VALUE[p.type] || !chess.attackers(sq, color).length) out.push(sq);
  }
  return out;
}

const play = (fen: string, san: string): { chess: Chess; move: Move } | null => {
  const chess = load(fen);
  try {
    return { chess, move: chess.move(san) };
  } catch {
    return null;
  }
};

/** Squares a move forks: two or more targets that are the king, worth more than the forker, or undefended. Empty when it isn't a fork. */
export function forkTargets(fen: string, san: string): Square[] {
  const r = play(fen, san);
  if (!r) return [];
  const { chess, move } = r;
  const me = move.color;
  const after = chess.fen();
  if (hangingPieces(after, me).includes(move.to as Square) && !chess.inCheck()) return [];
  const turned = load(withTurn(after, me));
  const targets = turned
    .moves({ square: move.to, verbose: true })
    .filter((m) => m.captured && m.captured !== "k")
    .filter((m) => VALUE[m.captured as PieceType] > VALUE[move.piece as PieceType] || !turned.attackers(m.to, other(me)).length)
    .map((m) => m.to as Square);
  if (chess.inCheck()) for (const [sq, p] of readFen(after)) if (p.type === "k" && p.color !== me) targets.push(sq);
  return targets.length >= 2 ? [...new Set(targets)] : [];
}

const LINES: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
};
LINES.q = [...LINES.b, ...LINES.r];

/** The square of the piece (knight or bigger) a move pins in front of its king or a bigger piece, or null. */
export function pinnedBy(fen: string, san: string): Square | null {
  const r = play(fen, san);
  if (!r || !LINES[r.move.piece]) return null;
  const board = readFen(r.chess.fen());
  const from = r.move.to as Square;
  for (const [df, dr] of LINES[r.move.piece]) {
    const seen: { sq: Square; type: PieceType; color: Color }[] = [];
    for (let f = fileIndex(from) + df, k = rankIndex(from) + dr; f >= 0 && f < 8 && k >= 0 && k < 8 && seen.length < 2; f += df, k += dr) {
      const sq = squareAt(f, k);
      const p = board.get(sq);
      if (p) seen.push({ sq, ...p });
    }
    const [a, b] = seen;
    if (a && b && a.color !== r.move.color && b.color !== r.move.color && VALUE[a.type] >= 3 && VALUE[b.type] > VALUE[a.type]) return a.sq;
  }
  return null;
}

/** A move that mates at once, or null. */
export function mateInOne(fen: string): string | null {
  const chess = load(fen);
  for (const m of chess.moves({ verbose: true })) {
    if (!m.san.includes("#")) continue;
    return m.san;
  }
  return null;
}

/** A checking first move that forces mate next move, or null (checks only, which keeps it quick). */
export function mateInTwo(fen: string): string | null {
  const chess = load(fen);
  for (const m of chess.moves({ verbose: true })) {
    if (!m.san.includes("+")) continue;
    chess.move(m.san);
    const replies = chess.moves();
    const forced = replies.length > 0 && replies.every((reply) => {
      chess.move(reply);
      const mate = mateInOne(chess.fen());
      chess.undo();
      return Boolean(mate);
    });
    chess.undo();
    if (forced) return m.san;
  }
  return null;
}

/** A mating move by a rook or queen along the mated king's home rank. */
export function isBackRankMate(fen: string, san: string): boolean {
  const r = play(fen, san);
  if (!r || !r.chess.isCheckmate() || (r.move.piece !== "r" && r.move.piece !== "q")) return false;
  const home = r.move.color === "w" ? "8" : "1";
  return r.move.to[1] === home && [...readFen(r.chess.fen())].some(([sq, p]) => p.type === "k" && p.color !== r.move.color && sq[1] === home);
}

export type MistakeFacts = { tags: MistakeTag[]; squares: Square[]; pieces: PieceType[]; better: string | null; threat: string | null };

/** What went wrong with one move: the tags, the squares and pieces involved, the better move and the reply it allowed. */
export function detectMistakes(p: ReviewPly, engineBetter: string | null): MistakeFacts {
  const me = p.by;
  const tags = new Set<MistakeTag>();
  const squares = new Set<Square>();
  const pieces = new Set<PieceType>();
  const before = readFen(p.fenBefore);
  const after = readFen(p.fen);
  const note = (sq: Square, board = after) => {
    squares.add(sq);
    const piece = board.get(sq);
    if (piece) pieces.add(piece.type);
  };
  let better = engineBetter;
  let threat: string | null = null;

  const mate1 = mateInOne(p.fenBefore);
  const mate = mate1 ?? (engineBetter && play(p.fenBefore, engineBetter)?.move.san.includes("+") ? mateInTwo(p.fenBefore) : null);
  if (mate && mate !== p.san) {
    tags.add("mate");
    better = mate;
    if (mate1 && isBackRankMate(p.fenBefore, mate1)) tags.add("backRank");
  }
  const allowed = mateInOne(p.fen);
  if (allowed) {
    tags.add("mate");
    threat = allowed;
    if (isBackRankMate(p.fen, allowed)) tags.add("backRank");
  }

  const wasHanging = new Set(hangingPieces(p.fenBefore, me));
  for (const sq of hangingPieces(p.fen, me)) {
    if (wasHanging.has(sq) && sq !== p.lastMove.to) continue;
    tags.add("hanging");
    note(sq);
  }
  if (better) {
    const b = play(p.fenBefore, better);
    if (b?.move.captured && hangingPieces(p.fenBefore, other(me)).includes(b.move.to as Square)) {
      tags.add("freePiece");
      note(b.move.to as Square, before);
    }
    const forked = forkTargets(p.fenBefore, better);
    if (forked.length) {
      tags.add("fork");
      forked.forEach((sq) => note(sq, before));
    }
    const pinned = pinnedBy(p.fenBefore, better);
    if (pinned) {
      tags.add("pin");
      note(pinned, before);
    }
  }
  if (!threat) {
    for (const reply of load(p.fen).moves()) {
      const forked = forkTargets(p.fen, reply);
      const pinned = forked.length ? null : pinnedBy(p.fen, reply);
      if (!forked.length && !pinned) continue;
      tags.add(forked.length ? "fork" : "pin");
      threat = reply;
      (forked.length ? forked : [pinned!]).forEach((sq) => note(sq));
      break;
    }
  }
  const moved = after.get(p.lastMove.to);
  if (moved) pieces.add(moved.type);
  return { tags: [...tags], squares: [...squares], pieces: [...pieces], better, threat };
}

/** One explained moment of a game: everything the coach may talk about, and nothing else. */
export type CoachMoment = { ply: number; moveNo: number; by: Color; san: string; verdict: Exclude<MoveVerdict, "good">; loss: number } & MistakeFacts;

const clamp = (cp: number) => Math.max(-EVAL_CAP, Math.min(EVAL_CAP, Math.round(cp)));

/**
 * The (up to) `max` biggest mistakes of a game, by centipawns lost, in move order. `side` limits
 * them to one player (null: both, for pass & play). Only those few get the slower best-move search.
 */
export function coachMoments(startFen: string, history: string[], side: Color | null, max = 3): CoachMoment[] {
  const plies = reviewPlies(startFen, history);
  const evals = new Map<string, number>();
  const ev = (fen: string) => evals.get(fen) ?? evals.set(fen, quickEval(fen)).get(fen)!;
  const losses = plies
    .filter((p) => !side || p.by === side)
    .map((p) => ({ p, loss: Math.max(0, clamp(ev(p.fenBefore)) - clamp(-ev(p.fen))) }))
    .filter((x) => x.loss >= 90)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, max);
  return losses
    .map(({ p }) => {
      const n = assessMove(p);
      if (n.verdict === "good") return null;
      return { ply: p.ply, moveNo: Math.ceil(p.ply / 2), by: p.by, san: p.san, verdict: n.verdict, loss: n.loss, ...detectMistakes(p, n.better) };
    })
    .filter((m): m is CoachMoment => m !== null)
    .sort((a, b) => a.ply - b.ply);
}

/** Everything the key-moment card shows: the decisive move, what was better, and why (detector tags). */
export type KeyMomentCard = { ply: number; kind: "mistake" | "great"; by: Color; san: string; move: string; verdict: MoveVerdict; better: string | null; betterMove: MoveNote["betterMove"]; tags: MistakeTag[]; fenBefore: string; fen: string; lastMove: ReviewPly["lastMove"] };

/** The card for a reviewed game, or null when nothing stands out (or the analysis is not there yet). */
export function keyMomentCard(plies: ReviewPly[], notes: Record<number, MoveNote>, side: Color | null): KeyMomentCard | null {
  const pick = decisiveMoment(plies, notes, side);
  const p = pick ? plies[pick.ply - 1] : undefined;
  const n = p ? notes[p.ply] : undefined;
  if (!pick || !p || !n) return null;
  const mistake = pick.kind === "mistake";
  const facts = mistake ? detectMistakes(p, n.better) : null;
  return {
    ply: p.ply,
    kind: pick.kind,
    by: p.by,
    san: p.san,
    move: `${Math.ceil(p.ply / 2)}${p.by === "w" ? "." : "…"} ${p.san}`,
    verdict: n.verdict,
    better: mistake ? (facts?.better ?? n.better) : null,
    betterMove: mistake ? n.betterMove : null,
    tags: facts?.tags ?? [],
    fenBefore: p.fenBefore,
    fen: p.fen,
    lastMove: p.lastMove,
  };
}
