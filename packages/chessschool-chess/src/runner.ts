import type { Chess, Move } from "chess.js";
import { readFen, turnOf, type Color, type MoveRef, type PromotionPiece, type Square } from "./board";
import { kingInCheck, legalTargets, load, moveRef, needsPromotion, outcome, parseUci, tryMove, withTurn, type GameOutcome } from "./game";
import type { MoveGoal, Step } from "./lessons";

/* ---------------- shared board selection ---------------- */

export type BoardView = {
  fen: string;
  selected: Square | null;
  targets: Square[];
  lastMove: MoveRef | null;
  check: Square | null;
};

export type Pick =
  | { kind: "select"; selected: Square; targets: Square[] }
  | { kind: "clear" }
  | { kind: "move"; move: Move; chess: Chess }
  | { kind: "promote"; from: Square; to: Square };

/**
 * What a tap means for the side to move: pick a piece, re-pick, move, or clear. With
 * `askPromotion`, a pawn reaching the last rank returns "promote" so the UI can offer a choice.
 */
export function pick(fen: string, selected: Square | null, targets: Square[], square: Square, side: Color, askPromotion = false): Pick {
  const chess = load(fen);
  if (selected && targets.includes(square)) {
    if (askPromotion && needsPromotion(chess, selected, square)) return { kind: "promote", from: selected, to: square };
    const move = tryMove(chess, selected, square);
    if (move) return { kind: "move", move, chess };
  }
  const piece = readFen(fen).get(square);
  if (piece && piece.color === side && turnOf(fen) === side) {
    const t = legalTargets(chess, square);
    return t.length ? { kind: "select", selected: square, targets: t } : { kind: "clear" };
  }
  return { kind: "clear" };
}

/* ---------------- lesson / drill runner ---------------- */

export type Feedback = { tone: "good" | "hint"; text: string } | null;

export type RunnerState = BoardView & {
  steps: Step[];
  index: number;
  /** ready: can continue · working: waiting for the learner · finished: past the last step */
  status: "ready" | "working" | "finished";
  feedback: Feedback;
  /** Increments on every miss so the UI can replay its shake. */
  misses: number;
  showHint: boolean;
  stars: Square[];
  choice: number | null;
  botThinking: boolean;
  gameMoves: number;
  gameOver: GameOutcome;
  /** Index of the next move in a line step. */
  lineStep: number;
  /** A pawn waiting on the last rank for the learner to pick a piece. */
  promotion: MoveRef | null;
};

export type RunnerAction =
  | { type: "tap"; square: Square }
  | { type: "choose"; index: number }
  | { type: "next" }
  | { type: "hint" }
  | { type: "bot"; move: MoveRef & { promotion?: string } }
  | { type: "promote"; piece: PromotionPiece }
  | { type: "cancelPromotion" }
  | { type: "endGame" };

const PRAISE = ["Nice!", "That's it!", "Lovely.", "Exactly right.", "Well spotted!"];
/** Feedback the runner says itself, outside any lesson. Each coach records these once. */
export const SPOKEN_PHRASES = [...PRAISE, "Great first game!", "Good. Keep going.", "Checkmate! You won.", "Checkmate. Good game!", "It's a draw. Good game!"];

/** What a coach says in a lesson: every step's text and its hint. */
export function spokenLines(steps: Step[]): string[] {
  return steps.flatMap((s) => [s.body, "hint" in s ? s.hint : ""]).filter((t): t is string => Boolean(t?.trim()));
}

function stepState(steps: Step[], index: number, misses = 0): RunnerState {
  const step = steps[index];
  const base: RunnerState = {
    steps,
    index,
    fen: step?.fen ?? "8/8/8/8/8/8/8/8 w - - 0 1",
    selected: null,
    targets: [],
    lastMove: null,
    check: step?.check ?? null,
    status: !step ? "finished" : step.kind === "say" ? "ready" : "working",
    feedback: null,
    misses,
    showHint: false,
    stars: step?.kind === "stars" ? [...step.stars] : [],
    choice: null,
    botThinking: false,
    gameMoves: 0,
    gameOver: null,
    lineStep: 0,
    promotion: null,
  };
  return base;
}

export function startRunner(steps: Step[]): RunnerState {
  return stepState(steps, 0);
}

export function currentStep(s: RunnerState): Step | undefined {
  return s.steps[s.index];
}

export function goalMet(goal: MoveGoal, move: Move, after: Chess): boolean {
  switch (goal.type) {
    case "exact":
      return move.from === goal.from && move.to === goal.to;
    case "capture":
      return Boolean(move.captured);
    case "check":
      return after.inCheck();
    case "mate":
      return after.isCheckmate();
    case "promote":
      return Boolean(move.promotion);
  }
}

const praise = (n: number): Feedback => ({ tone: "good", text: PRAISE[n % PRAISE.length] });

export function runnerReduce(s: RunnerState, a: RunnerAction): RunnerState {
  const step = s.steps[s.index];
  if (!step) return s;

  if (a.type === "next") return s.status === "ready" ? stepState(s.steps, s.index + 1, s.misses) : s;
  if (a.type === "hint") return { ...s, showHint: true, feedback: "hint" in step ? { tone: "hint", text: step.hint } : s.feedback };

  if (a.type === "choose") {
    if (step.kind !== "choice" || s.status !== "working") return s;
    if (step.options[a.index]?.correct) return { ...s, choice: a.index, status: "ready", feedback: praise(s.index) };
    return { ...s, choice: a.index, misses: s.misses + 1, feedback: { tone: "hint", text: step.hint } };
  }

  if (a.type === "endGame") {
    if (step.kind !== "game" || s.gameMoves < step.minMoves || s.botThinking) return s;
    return { ...s, status: "ready", selected: null, targets: [], feedback: { tone: "good", text: "Great first game!" } };
  }

  if (a.type === "bot" && step.kind === "line") {
    if (!s.botThinking) return s;
    const chess = load(s.fen);
    const ref = parseUci(step.moves[s.lineStep]);
    const move = ref && tryMove(chess, ref.from, ref.to);
    if (!move) return { ...s, botThinking: false };
    return { ...s, fen: chess.fen(), lastMove: moveRef(move), check: kingInCheck(chess), botThinking: false, lineStep: s.lineStep + 1 };
  }

  if (a.type === "bot") {
    if (step.kind !== "game" || !s.botThinking) return s;
    const chess = load(s.fen);
    const move = tryMove(chess, a.move.from, a.move.to);
    if (!move) return { ...s, botThinking: false };
    const over = outcome(chess);
    return {
      ...s,
      fen: chess.fen(),
      lastMove: moveRef(move),
      check: kingInCheck(chess),
      botThinking: false,
      gameOver: over,
      status: over ? "ready" : s.status,
      feedback: over ? gameFeedback(over) : null,
    };
  }

  if (a.type === "cancelPromotion") return { ...s, promotion: null, selected: null, targets: [] };
  if (a.type === "promote") {
    if (!s.promotion) return s;
    const chess = load(s.fen);
    const move = tryMove(chess, s.promotion.from, s.promotion.to, a.piece);
    return move ? learnerMove({ ...s, promotion: null }, step, move, chess) : { ...s, promotion: null };
  }

  // tap
  if (s.status !== "working" || s.botThinking || s.promotion) return s;
  if (step.kind === "say" || step.kind === "choice") return s;

  if (step.kind === "tap") {
    if (step.targets.includes(a.square)) return { ...s, selected: a.square, status: "ready", feedback: praise(s.index) };
    return { ...s, selected: a.square, misses: s.misses + 1, feedback: { tone: "hint", text: step.hint } };
  }

  const p = pick(s.fen, s.selected, s.targets, a.square, "w", true);
  if (p.kind === "select") return { ...s, selected: p.selected, targets: p.targets, feedback: s.feedback?.tone === "good" ? null : s.feedback };
  if (p.kind === "clear") return { ...s, selected: null, targets: [] };
  if (p.kind === "promote") return { ...s, promotion: { from: p.from, to: p.to } };
  return learnerMove(s, step, p.move, p.chess);
}

function learnerMove(s: RunnerState, step: Step, move: Move, chess: Chess): RunnerState {
  if (step.kind === "stars") {
    const fen = withTurn(chess.fen(), "w");
    const stars = s.stars.filter((sq) => sq !== move.to);
    const done = stars.length === 0;
    return { ...s, fen, stars, selected: null, targets: [], lastMove: moveRef(move), status: done ? "ready" : "working", feedback: done ? praise(s.index) : null };
  }

  if (step.kind === "line") {
    const expected = step.moves[s.lineStep];
    const last = s.lineStep === step.moves.length - 1;
    const right = sameMove(move, expected) || (last && step.mateEnds && chess.isCheckmate());
    if (!right) return { ...s, selected: null, targets: [], misses: s.misses + 1, feedback: { tone: "hint", text: step.hint } };
    const done = last;
    return {
      ...s,
      fen: chess.fen(),
      selected: null,
      targets: [],
      lastMove: moveRef(move),
      check: kingInCheck(chess),
      lineStep: s.lineStep + 1,
      botThinking: !done,
      status: done ? "ready" : "working",
      feedback: done ? praise(s.index) : { tone: "good", text: "Good. Keep going." },
    };
  }

  if (step.kind === "move") {
    if (goalMet(step.goal, move, chess)) {
      return { ...s, fen: chess.fen(), selected: null, targets: [], lastMove: moveRef(move), check: kingInCheck(chess), status: "ready", feedback: praise(s.index) };
    }
    return { ...s, selected: null, targets: [], misses: s.misses + 1, feedback: { tone: "hint", text: step.hint } };
  }

  // game
  const over = outcome(chess);
  return {
    ...s,
    fen: chess.fen(),
    selected: null,
    targets: [],
    lastMove: moveRef(move),
    check: kingInCheck(chess),
    gameMoves: s.gameMoves + 1,
    gameOver: over,
    botThinking: !over,
    status: over ? "ready" : "working",
    feedback: over ? gameFeedback(over) : null,
  };
}

/** A played move against a UCI string; the promotion piece only counts when the UCI names one. */
export function sameMove(move: { from: string; to: string; promotion?: string }, uci: string): boolean {
  if (`${move.from}${move.to}` !== uci.slice(0, 4)) return false;
  return uci.length < 5 || move.promotion === uci[4];
}

function gameFeedback(o: NonNullable<GameOutcome>): Feedback {
  if (o.kind === "checkmate") return { tone: "good", text: o.winner === "w" ? "Checkmate! You won." : "Checkmate. Good game!" };
  return { tone: "good", text: "It's a draw. Good game!" };
}

/** Which squares glow as a hint for the current step. */
export function hintSquares(s: RunnerState): Square[] {
  const step = s.steps[s.index];
  if (!step || !s.showHint) return [];
  if (step.kind === "move") return step.hintSquares ?? [];
  if (step.kind === "line") {
    // Only on the learner's turn; the next scripted move may be the opponent's reply.
    if (s.botThinking || s.lineStep % 2 === 1) return [];
    const ref = parseUci(step.moves[s.lineStep] ?? "");
    return ref ? [ref.from, ref.to] : [];
  }
  if (step.kind === "tap") return step.targets;
  return [];
}

const playable = (s: Step) => s.kind === "tap" || s.kind === "move" || s.kind === "stars" || s.kind === "choice" || s.kind === "line";

/** Practice picks from steps the API already sent, so the app does not ship the lesson book. */
export function practiceSteps(steps: Step[], rand: () => number = Math.random, count = 5): Step[] {
  const pool = steps.filter(playable);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = a;
  }
  return pool.slice(0, count);
}
