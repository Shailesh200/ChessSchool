import { Chess, type Move } from "chess.js";
import { readFen, squareAt, START_FEN, turnOf, type Color, type MoveRef, type Piece, type PieceType, type PromotionPiece, type Square } from "./board";
import { rankMoves } from "./engine";
import { kingInCheck, load, moveRef } from "./game";
import { pick } from "./runner";

/* ---------------- position editor ---------------- */

export type Castling = { K: boolean; Q: boolean; k: boolean; q: boolean };
export type EditorState = { pieces: Map<Square, Piece>; turn: Color; castling: Castling };
export const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
/** Palette order for the editor: White then Black, king first. */
export const PALETTE: readonly Piece[] = (["w", "b"] as const).flatMap((color) => (["k", "q", "r", "b", "n", "p"] as const).map((type) => ({ type, color })));

/** The editor's view of a FEN: pieces, side to move and castling flags. */
export function editorFrom(fen: string): EditorState {
  const parts = fen.trim().split(/\s+/);
  const flags = parts[2] ?? "-";
  return { pieces: readFen(fen), turn: parts[1] === "b" ? "b" : "w", castling: { K: flags.includes("K"), Q: flags.includes("Q"), k: flags.includes("k"), q: flags.includes("q") } };
}

/** Places `piece` on `sq`; the same piece again (or null) clears it. A second king of a colour moves the first. */
export function placePiece(s: EditorState, sq: Square, piece: Piece | null): EditorState {
  const pieces = new Map(s.pieces);
  const here = pieces.get(sq);
  if (!piece || (here && here.type === piece.type && here.color === piece.color)) pieces.delete(sq);
  else {
    if (piece.type === "k") for (const [at, p] of pieces) if (p.type === "k" && p.color === piece.color) pieces.delete(at);
    pieces.set(sq, piece);
  }
  return { ...s, pieces };
}

/** Castling rights that the pieces allow: the king and that rook still on their home squares. */
export function possibleCastling(pieces: Map<Square, Piece>): Castling {
  const at = (sq: Square, type: PieceType, color: Color) => pieces.get(sq)?.type === type && pieces.get(sq)?.color === color;
  return {
    K: at("e1", "k", "w") && at("h1", "r", "w"),
    Q: at("e1", "k", "w") && at("a1", "r", "w"),
    k: at("e8", "k", "b") && at("h8", "r", "b"),
    q: at("e8", "k", "b") && at("a8", "r", "b"),
  };
}

/** The editor position as a FEN. Castling flags the pieces do not allow are dropped. */
export function editorFen(s: EditorState): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let gap = 0;
    for (let file = 0; file < 8; file++) {
      const p = s.pieces.get(squareAt(file, rank));
      if (!p) {
        gap++;
        continue;
      }
      if (gap) row += String(gap);
      gap = 0;
      row += p.color === "w" ? p.type.toUpperCase() : p.type;
    }
    rows.push(row + (gap ? String(gap) : ""));
  }
  const ok = possibleCastling(s.pieces);
  const flags = (["K", "Q", "k", "q"] as const).filter((f) => s.castling[f] && ok[f]).join("") || "-";
  return `${rows.join("/")} ${s.turn} ${flags} - 0 1`;
}

export type PositionProblem = "kings" | "pawns" | "check" | "fen";

/** Why a position cannot be played from, or null when it can. */
export function positionProblem(fen: string): PositionProblem | null {
  const pieces = readFen(fen);
  const kings = (c: Color) => [...pieces.values()].filter((p) => p.type === "k" && p.color === c).length;
  if (kings("w") !== 1 || kings("b") !== 1) return "kings";
  for (const [sq, p] of pieces) if (p.type === "p" && (sq[1] === "1" || sq[1] === "8")) return "pawns";
  // The side that just moved cannot be left in check.
  const other = turnOf(fen) === "w" ? "b" : "w";
  const flipped = fen.trim().split(/\s+/);
  flipped[1] = other;
  flipped[3] = "-";
  try {
    if (load(flipped.join(" ")).inCheck()) return "check";
    new Chess(fen);
  } catch {
    return "fen";
  }
  return null;
}

/** A pasted FEN, completed with defaults when only the board (and maybe the side) is given. Null when unreadable. */
export function readPastedFen(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (!parts[0] || !/^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/.test(parts[0])) return null;
  if (parts[0].split("/").some((row) => [...row].reduce((n, ch) => n + (/\d/.test(ch) ? Number(ch) : 1), 0) !== 8)) return null;
  const turn = parts[1] === "b" ? "b" : "w";
  const castling = parts[2] && /^(-|K?Q?k?q?)$/.test(parts[2]) ? parts[2] : "-";
  const ep = parts[3] && /^(-|[a-h][36])$/.test(parts[3]) ? parts[3] : "-";
  const half = /^\d+$/.test(parts[4] ?? "") ? parts[4] : "0";
  const full = /^[1-9]\d*$/.test(parts[5] ?? "") ? parts[5] : "1";
  return `${parts[0]} ${turn} ${castling} ${ep} ${half} ${full}`;
}

/* ---------------- free play with undo and redo ---------------- */

export type LineMove = { san: string; fen: string; lastMove: MoveRef };
/** A line of moves from `start`; `at` moves are on the board, the rest can be redone. */
export type AnalysisLine = { start: string; moves: LineMove[]; at: number; selected: Square | null; targets: Square[]; promotion: MoveRef | null };

export const startLine = (fen: string = START_FEN): AnalysisLine => ({ start: fen, moves: [], at: 0, selected: null, targets: [], promotion: null });
export const lineFen = (l: AnalysisLine) => (l.at ? l.moves[l.at - 1].fen : l.start);
export const lineLast = (l: AnalysisLine) => (l.at ? l.moves[l.at - 1].lastMove : null);
export const lineCheck = (l: AnalysisLine): Square | null => {
  try {
    return kingInCheck(load(lineFen(l)));
  } catch {
    return null;
  }
};

/** A legal move from the current position. A new move replaces what could be redone. */
export function playOnLine(l: AnalysisLine, from: Square, to: Square, promotion: PromotionPiece = "q"): AnalysisLine {
  const chess = load(lineFen(l));
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch {
    return { ...l, selected: null, targets: [], promotion: null };
  }
  const next = l.moves[l.at];
  // Playing the move that comes next keeps the rest of the line.
  if (next && next.san === m.san) return { ...l, at: l.at + 1, selected: null, targets: [], promotion: null };
  return { ...l, moves: [...l.moves.slice(0, l.at), { san: m.san, fen: chess.fen(), lastMove: moveRef(m) }], at: l.at + 1, selected: null, targets: [], promotion: null };
}

/** A tap on the board for whichever side is to move (both sides are played by hand). */
export function tapLine(l: AnalysisLine, sq: Square, askPromotion = true): AnalysisLine {
  const fen = lineFen(l);
  const r = pick(fen, l.selected, l.targets, sq, turnOf(fen), askPromotion);
  if (r.kind === "select") return { ...l, selected: r.selected, targets: r.targets, promotion: null };
  if (r.kind === "promote") return { ...l, promotion: { from: r.from, to: r.to } };
  if (r.kind === "move") return playOnLine(l, r.move.from as Square, r.move.to as Square, (r.move.promotion as PromotionPiece | undefined) ?? "q");
  return { ...l, selected: null, targets: [], promotion: null };
}

export const promoteLine = (l: AnalysisLine, piece: PromotionPiece | null): AnalysisLine => (l.promotion && piece ? playOnLine(l, l.promotion.from, l.promotion.to, piece) : { ...l, promotion: null, selected: null, targets: [] });
export const goLine = (l: AnalysisLine, at: number): AnalysisLine => ({ ...l, at: Math.max(0, Math.min(l.moves.length, at)), selected: null, targets: [], promotion: null });
export const undoLine = (l: AnalysisLine) => goLine(l, l.at - 1);
export const redoLine = (l: AnalysisLine) => goLine(l, l.at + 1);

/** A line set from SAN moves (a game opened in analysis), on the last move or `at`. Stops at an unreadable move. */
export function lineFromMoves(start: string, sans: readonly string[], at = sans.length): AnalysisLine {
  const chess = load(start);
  const moves: LineMove[] = [];
  for (const san of sans) {
    try {
      const m = chess.move(san);
      moves.push({ san: m.san, fen: chess.fen(), lastMove: moveRef(m) });
    } catch {
      break;
    }
  }
  return { ...startLine(start), moves, at: Math.max(0, Math.min(moves.length, at)) };
}

/* ---------------- engine evaluation, a little at a time ---------------- */

const MATE_SCORE = 50_000;
/** `cp` is White's point of view (centipawns); `mate` is moves to mate (+ White mates, − Black mates). */
export type Evaluation = { cp: number; mate: number | null; depth: number; best: string[]; bestMove: MoveRef | null; over: "checkmate" | "stalemate" | null };

const whiteView = (score: number, turn: Color) => (turn === "w" ? score : -score);
const mateIn = (score: number) => (Math.abs(score) > MATE_SCORE ? Math.sign(score) * Math.max(1, Math.ceil((100_000 - Math.abs(score) + 1) / 2)) : null);

/**
 * Engine analysis split into small steps so it never holds the screen for long: each `step()` scores one
 * root move at the current depth, or extends the best line by one move, so the UI can yield between steps.
 * `result` holds the deepest finished depth so far.
 */
export function analysisStepper(fen: string, opts: { maxDepth?: number; lineLength?: number; stepMs?: number } = {}) {
  const maxDepth = opts.maxDepth ?? 4;
  const lineLength = opts.lineLength ?? 5;
  const stepMs = opts.stepMs ?? 120;
  const turn = turnOf(fen);
  let roots: Move[] = [];
  let result: Evaluation | null = null;
  let done = false;
  try {
    const chess = load(fen);
    roots = chess.moves({ verbose: true });
    if (!roots.length) {
      const mated = chess.inCheck();
      result = { cp: mated ? (turn === "w" ? -10_000 : 10_000) : 0, mate: mated ? 0 : null, depth: 0, best: [], bestMove: null, over: mated ? "checkmate" : "stalemate" };
      done = true;
    }
  } catch {
    done = true;
  }
  let depth = 1;
  let i = 0;
  let scores: { san: string; ref: MoveRef; fen: string; score: number }[] = [];
  /** After a depth finishes, the best line is extended one move per step until it is long enough. */
  let pv: { sans: string[]; fen: string } | null = null;

  /** The mover's score for a root move: the reply searched `d` deep, from the other side. */
  const scoreChild = (childFen: string, d: number): number => {
    const child = load(childFen);
    if (!child.moves().length) return child.inCheck() ? 100_000 : 0;
    return -(rankMoves(childFen, { depth: d, quiescence: 3, timeMs: stepMs })[0]?.score ?? 0);
  };

  const finishDepth = () => {
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const mate = mateIn(top.score);
    result = { cp: whiteView(clampCp(top.score), turn), mate: mate === null ? null : whiteView(mate, turn), depth, best: [top.san], bestMove: top.ref, over: null };
    pv = { sans: [top.san], fen: top.fen };
  };

  return {
    get result() {
      return result;
    },
    get done() {
      return done;
    },
    /** One small piece of work. Returns false once there is nothing left to do. */
    step(): boolean {
      if (done) return false;
      if (pv && result) {
        const reply = pv.sans.length < lineLength ? bestReply(pv.fen, Math.max(1, depth - pv.sans.length), stepMs) : null;
        if (reply) {
          pv = { sans: [...pv.sans, reply.san], fen: reply.fen };
          result = { ...result, best: pv.sans };
          return true;
        }
        pv = null;
        if (depth >= maxDepth || result.mate !== null) {
          done = true;
          return false;
        }
        // Next depth, previous best first.
        const order = scores.map((s) => s.san);
        roots.sort((a, b) => order.indexOf(a.san) - order.indexOf(b.san));
        depth++;
        i = 0;
        scores = [];
      }
      const m = roots[i++];
      const after = load(fen);
      after.move(m.san);
      const childFen = after.fen();
      scores.push({ san: m.san, ref: moveRef(m), fen: childFen, score: scoreChild(childFen, depth) });
      if (i >= roots.length) finishDepth();
      return true;
    },
  };
}

function bestReply(fen: string, depth: number, timeMs: number): { san: string; fen: string } | null {
  const chess = load(fen);
  if (!chess.moves().length) return null;
  const top = rankMoves(fen, { depth, quiescence: 2, timeMs })[0];
  if (!top) return null;
  chess.move(top.move.san);
  return { san: top.move.san, fen: chess.fen() };
}

/** Puts `fn` on the next turn of the event loop and returns a cancel (setTimeout in the apps). */
export type Schedule = (fn: () => void) => () => void;

/** Runs a stepper a slice at a time on `schedule`, and reports each improvement. Returns a stop function. */
export function runAnalysis(fen: string, schedule: Schedule, onUpdate: (e: Evaluation, done: boolean) => void, opts: { maxDepth?: number; sliceMs?: number } = {}): () => void {
  const stepper = analysisStepper(fen, { maxDepth: opts.maxDepth });
  const sliceMs = opts.sliceMs ?? 40;
  let stopped = false;
  let cancel = () => {};
  let last: Evaluation | null = null;
  const tick = () => {
    if (stopped) return;
    const until = Date.now() + sliceMs;
    let more = true;
    while (more && Date.now() < until) more = stepper.step();
    const r = stepper.result;
    if (r && (r !== last || !more)) {
      last = r;
      onUpdate(r, !more);
    }
    if (more) cancel = schedule(tick);
  };
  cancel = schedule(tick);
  return () => {
    stopped = true;
    cancel();
  };
}

const clampCp = (score: number) => (Math.abs(score) > MATE_SCORE ? Math.sign(score) * 10_000 : Math.round(score));

/** A short label for an evaluation: "+1.2", "−0.5", "M3", "−M2". */
export function evaluationLabel(e: Evaluation | null): string {
  if (!e) return "…";
  if (e.over === "checkmate") return "#";
  if (e.over === "stalemate") return "½";
  if (e.mate !== null) return `${e.mate < 0 ? "−" : ""}M${Math.abs(e.mate)}`;
  const v = e.cp / 100;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
}

/** The best line as move-numbered SAN from `fen` ("12. Nf3 Nc6 13. d4" or "12… Nc6 13. d4"). */
export function numberedLine(fen: string, sans: readonly string[]): string {
  const parts = fen.trim().split(/\s+/);
  let turn: Color = parts[1] === "b" ? "b" : "w";
  let n = Number(parts[5]) || 1;
  const out: string[] = [];
  sans.forEach((san, i) => {
    if (turn === "w") out.push(`${n}. ${san}`);
    else out.push(i === 0 ? `${n}… ${san}` : san);
    if (turn === "b") n++;
    turn = turn === "w" ? "b" : "w";
  });
  return out.join(" ");
}
