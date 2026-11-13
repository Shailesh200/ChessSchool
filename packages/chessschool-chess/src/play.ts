import type { Chess } from "chess.js";
import { START_FEN, turnOf, type Color, type MoveRef, type Square } from "./board";
import { botInfo, isBotId, toBotId, type BotId } from "./bot";
import { kingInCheck, load, moveRef, outcome, tryMove, type GameOutcome } from "./game";
import { pick, type BoardView } from "./runner";

/* ---------------- setup ---------------- */

export type TimeControlId = "none" | "10+0" | "30+0" | "5+3" | "3+2";
export const TIME_CONTROLS: readonly { id: TimeControlId; label: string; base: number; inc: number }[] = [
  { id: "none", label: "No clock", base: 0, inc: 0 },
  { id: "10+0", label: "10 min", base: 600_000, inc: 0 },
  { id: "30+0", label: "30 min", base: 1_800_000, inc: 0 },
  { id: "5+3", label: "5 + 3", base: 300_000, inc: 3_000 },
  { id: "3+2", label: "3 + 2", base: 180_000, inc: 2_000 },
];
export const timeControl = (id: TimeControlId) => TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];

/** Practice positions you can start a game from. */
export const ENDGAME_IDS = ["kq-k", "kr-k", "krr-k", "kp-k"] as const;
export const START_POSITIONS: readonly { id: string; name: string; blurb: string; fen: string }[] = [
  { id: "kq-k", name: "Queen vs king", blurb: "Practise the basic checkmate.", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1" },
  { id: "kr-k", name: "Rook vs king", blurb: "Push the king to the edge.", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1" },
  { id: "krr-k", name: "Two rooks", blurb: "The ladder mate.", fen: "4k3/8/8/8/8/8/8/R3K2R w - - 0 1" },
  { id: "pawn-race", name: "Pawn race", blurb: "Who promotes first?", fen: "4k3/pppp4/8/8/8/8/4PPPP/4K3 w - - 0 1" },
  { id: "kp-k", name: "King and pawn", blurb: "Walk your pawn home.", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1" },
  { id: "italian", name: "Italian opening", blurb: "A classic start after four moves.", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
];

/** A random Shuffle chess (Chess960-style) start. Castling is off, since chess.js only castles from the standard squares. */
export function shuffleFen(rand: () => number = Math.random): string {
  const back: (string | null)[] = Array(8).fill(null);
  const free = () => back.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  const put = (piece: string, options: number[]) => {
    const i = options[Math.floor(rand() * options.length)];
    back[i] = piece;
  };
  put("b", [0, 2, 4, 6]);
  put("b", [1, 3, 5, 7]);
  put("q", free());
  put("n", free());
  put("n", free());
  const [a, k, c] = free();
  back[a] = "r";
  back[k] = "k";
  back[c] = "r";
  const row = back.join("");
  return `${row}/pppppppp/8/8/8/8/PPPPPPPP/${row.toUpperCase()} w - - 0 1`;
}

export type Opponent = { kind: "bot"; bot: BotId } | { kind: "friend" };
export type PlaySetup = {
  opponent: Opponent;
  /** Your side vs a bot; in pass & play, the side shown at the bottom first. */
  you: Color;
  time: TimeControlId;
  startFen: string;
  startName?: string;
  takebacks: boolean;
  askPromotion: boolean;
};

export const defaultSetup = (bot: BotId = "cody"): PlaySetup => ({
  opponent: { kind: "bot", bot },
  you: "w",
  time: "none",
  startFen: START_FEN,
  takebacks: botInfo(bot).takebacks,
  askPromotion: true,
});

/* ---------------- state ---------------- */

export type PlayOver = NonNullable<GameOutcome> | { kind: "resigned"; by: Color } | { kind: "timeout"; loser: Color };
export type Clock = { w: number; b: number; turnStartedAt: number | null };

export type PlayState = BoardView & {
  setup: PlaySetup;
  history: string[];
  botThinking: boolean;
  over: PlayOver | null;
  takebacks: number;
  /** Batches removed by take-back, newest first. One redo puts a batch back. */
  undone: string[][];
  clock: Clock | null;
  promotion: MoveRef | null;
};

export type PlayAction =
  | { type: "tap"; square: Square; now: number }
  | { type: "promote"; piece: "q" | "r" | "b" | "n"; now: number }
  | { type: "cancelPromotion" }
  | { type: "bot"; move: MoveRef & { promotion?: string }; now: number }
  | { type: "takeback"; now: number }
  | { type: "redo"; now: number }
  | { type: "resign"; now: number }
  | { type: "tick"; now: number };

const isBot = (s: PlaySetup) => s.opponent.kind === "bot";
/** Side the learner controls right now (both sides in pass & play). */
export const humanSide = (s: PlayState): Color | null => (isBot(s.setup) ? s.setup.you : turnOf(s.fen));

function replay(startFen: string, history: string[]): Chess {
  const chess = load(startFen);
  for (const san of history) chess.move(san);
  return chess;
}

export function startGame(setup: PlaySetup, now: number, history: string[] = [], clock: Clock | null = null): PlayState {
  let chess: Chess;
  let moves = history;
  try {
    chess = replay(setup.startFen, history);
  } catch {
    chess = load(setup.startFen);
    moves = [];
  }
  const tc = timeControl(setup.time);
  const last = chess.history({ verbose: true }).at(-1);
  const over = outcome(chess);
  return {
    setup,
    fen: chess.fen(),
    history: moves,
    selected: null,
    targets: [],
    lastMove: last ? moveRef(last) : null,
    check: kingInCheck(chess),
    botThinking: isBot(setup) && chess.turn() !== setup.you && !over,
    over,
    takebacks: 0,
    undone: [],
    clock: tc.base ? { w: clock?.w ?? tc.base, b: clock?.b ?? tc.base, turnStartedAt: over ? null : now } : null,
    promotion: null,
  };
}

/** Remaining time for a side at `now` (the side to move is counting down). */
export function timeLeft(s: PlayState, color: Color, now: number): number {
  if (!s.clock) return 0;
  const running = s.clock.turnStartedAt != null && turnOf(s.fen) === color && !s.over;
  return Math.max(0, s.clock[color] - (running ? now - s.clock.turnStartedAt! : 0));
}

function afterMove(s: PlayState, chess: Chess, san: string, ref: MoveRef, now: number): PlayState {
  const mover = turnOf(s.fen);
  let clock = s.clock;
  if (clock) {
    const tc = timeControl(s.setup.time);
    const spent = clock.turnStartedAt != null ? now - clock.turnStartedAt : 0;
    clock = { ...clock, [mover]: Math.max(0, clock[mover] - spent) + tc.inc, turnStartedAt: now };
  }
  const over = outcome(chess);
  return {
    ...s,
    fen: chess.fen(),
    history: [...s.history, san],
    selected: null,
    targets: [],
    lastMove: ref,
    check: kingInCheck(chess),
    botThinking: !over && isBot(s.setup) && chess.turn() !== s.setup.you,
    over,
    promotion: null,
    undone: [],
    clock: over && clock ? { ...clock, turnStartedAt: null } : clock,
  };
}

export function playReduce(s: PlayState, a: PlayAction): PlayState {
  if (s.over) return s;

  if (a.type === "tick") {
    if (!s.clock) return s;
    const side = turnOf(s.fen);
    if (timeLeft(s, side, a.now) > 0) return s;
    return { ...s, over: { kind: "timeout", loser: side }, botThinking: false, selected: null, targets: [], clock: { ...s.clock, [side]: 0, turnStartedAt: null } };
  }

  if (a.type === "resign") {
    const by = humanSide(s) ?? s.setup.you;
    const turn = turnOf(s.fen);
    const clock = s.clock ? { ...s.clock, [turn]: timeLeft(s, turn, a.now), turnStartedAt: null } : null;
    return { ...s, over: { kind: "resigned", by }, selected: null, targets: [], botThinking: false, promotion: null, clock };
  }

  if (a.type === "takeback") {
    if (!s.setup.takebacks || s.botThinking || !s.history.length) return s;
    // One ply at a time, including a bot reply. The learner cannot move on the bot's turn.
    const back = s.history.length - 1;
    const history = s.history.slice(0, back);
    const chess = replay(s.setup.startFen, history);
    const last = chess.history({ verbose: true }).at(-1);
    return {
      ...s,
      fen: chess.fen(),
      history,
      undone: [s.history.slice(back), ...s.undone],
      selected: null,
      targets: [],
      lastMove: last ? moveRef(last) : null,
      check: kingInCheck(chess),
      takebacks: s.takebacks + 1,
      promotion: null,
      botThinking: false,
      clock: s.clock ? { ...s.clock, turnStartedAt: a.now } : null,
    };
  }

  if (a.type === "redo") {
    // shortcut: redo restores the moves, not the clock, upgrade if timed games need the old time back.
    const batch = s.undone[0];
    if (!s.setup.takebacks || s.botThinking || !batch?.length) return s;
    const chess = replay(s.setup.startFen, s.history);
    const applied: string[] = [];
    for (const san of batch) {
      try {
        const move = chess.move(san);
        if (!move) break;
        applied.push(move.san);
      } catch {
        break;
      }
    }
    if (!applied.length) return s;
    const last = chess.history({ verbose: true }).at(-1)!;
    const over = outcome(chess);
    return {
      ...s,
      fen: chess.fen(),
      history: [...s.history, ...applied],
      undone: s.undone.slice(1),
      selected: null,
      targets: [],
      lastMove: moveRef(last),
      check: kingInCheck(chess),
      botThinking: false,
      over,
      promotion: null,
    };
  }

  if (a.type === "cancelPromotion") return { ...s, promotion: null, selected: null, targets: [] };

  if (a.type === "promote") {
    if (!s.promotion) return s;
    const chess = replay(s.setup.startFen, s.history);
    const move = tryMove(chess, s.promotion.from, s.promotion.to, a.piece);
    return move ? afterMove(s, chess, move.san, moveRef(move), a.now) : { ...s, promotion: null };
  }

  if (a.type === "bot") {
    if (!s.botThinking) return s;
    const chess = replay(s.setup.startFen, s.history);
    const move = tryMove(chess, a.move.from, a.move.to, (a.move.promotion as "q") ?? "q");
    return move ? afterMove(s, chess, move.san, moveRef(move), a.now) : { ...s, botThinking: false };
  }

  // tap
  const side = humanSide(s);
  if (s.botThinking || !side || s.promotion) return s;
  if (isBot(s.setup) && turnOf(s.fen) !== s.setup.you) return s;
  const p = pick(s.fen, s.selected, s.targets, a.square, side, s.setup.askPromotion);
  if (p.kind === "select") return { ...s, selected: p.selected, targets: p.targets };
  if (p.kind === "clear") return { ...s, selected: null, targets: [] };
  if (p.kind === "promote") return { ...s, promotion: { from: p.from, to: p.to } };
  // pick() works on a fresh board; replay keeps repetition history for draws.
  const chess = replay(s.setup.startFen, s.history);
  const move = tryMove(chess, p.move.from as Square, p.move.to as Square, (p.move.promotion as "q") ?? "q");
  return move ? afterMove(s, chess, move.san, moveRef(move), a.now) : s;
}

/* ---------------- results ---------------- */

export type GameResult = "win" | "loss" | "draw";
/** Winner of a finished game, or null for a draw. */
export function winnerOf(s: PlayState): Color | null | undefined {
  const o = s.over;
  if (!o) return undefined;
  if (o.kind === "checkmate") return o.winner;
  if (o.kind === "resigned") return o.by === "w" ? "b" : "w";
  if (o.kind === "timeout") return o.loser === "w" ? "b" : "w";
  return null;
}
/** Result from the learner's side (vs a bot) or White's side (pass & play). */
export function playResult(s: PlayState): GameResult | null {
  const w = winnerOf(s);
  if (w === undefined) return null;
  if (w === null) return "draw";
  return w === s.setup.you ? "win" : "loss";
}

/** Serialisable setup for storage; `parseSetup` restores it safely. */
export function parseSetup(v: unknown): PlaySetup | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const opp = r.opponent as Record<string, unknown> | undefined;
  const opponent: Opponent | null = opp?.kind === "friend" ? { kind: "friend" } : opp?.kind === "bot" ? { kind: "bot", bot: toBotId(opp.bot) } : null;
  if (!opponent || (r.you !== "w" && r.you !== "b") || typeof r.startFen !== "string") return null;
  try {
    load(r.startFen);
  } catch {
    return null;
  }
  return {
    opponent,
    you: r.you,
    time: TIME_CONTROLS.some((t) => t.id === r.time) ? (r.time as TimeControlId) : "none",
    startFen: r.startFen,
    startName: typeof r.startName === "string" ? r.startName : undefined,
    takebacks: r.takebacks === true,
    askPromotion: r.askPromotion !== false,
  };
}

export const opponentName = (setup: PlaySetup) => (setup.opponent.kind === "bot" ? botInfo(setup.opponent.bot).name : "Friend");
export { isBotId };
