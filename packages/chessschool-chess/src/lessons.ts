import { fileIndex, rankIndex, squareAt, START_FEN, type Square } from "./board";
import type { BotLevel } from "./bot";

export type Pose = "idle" | "wave" | "thinking" | "happy" | "proud" | "wow" | "reading" | "celebrate";

type Base = {
  title: string;
  body: string;
  fen: string;
  pose?: Pose;
  /** Squares to glow softly (teaching), e.g. where a piece can go. */
  highlight?: Square[];
  /** A king to show as attacked. */
  check?: Square;
};

export type MoveGoal = { type: "exact"; from: Square; to: Square } | { type: "capture" } | { type: "check" } | { type: "mate" } | { type: "promote" };

export type SayStep = Base & { kind: "say" };
export type TapStep = Base & { kind: "tap"; targets: Square[]; hint: string };
export type MoveStep = Base & { kind: "move"; goal: MoveGoal; hint: string; hintSquares?: Square[] };
/** A single piece visits every star; the other side never moves. */
export type StarsStep = Base & { kind: "stars"; stars: Square[]; hint: string };
export type ChoiceStep = Base & { kind: "choice"; options: { label: string; correct?: boolean }[]; hint: string };
/** A real game against Cody from `fen`; the learner is White. */
export type GameStep = Base & { kind: "game"; level: BotLevel; minMoves: number };
/**
 * A scripted sequence: `moves` alternate learner, reply, learner… (UCI). The learner always moves
 * first and last. With `mateEnds`, any checkmate is accepted as the final move.
 */
export type LineStep = Base & { kind: "line"; moves: string[]; hint: string; mateEnds?: boolean };

export type Step = SayStep | TapStep | MoveStep | StarsStep | ChoiceStep | GameStep | LineStep;
export type InteractiveStep = TapStep | MoveStep | StarsStep | ChoiceStep | LineStep;
export type Lesson = { id: string; steps: Step[] };

const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";
const solo = (piece: string, sq: Square) => {
  const rows = Array.from({ length: 8 }, () => "8");
  const r = 7 - rankIndex(sq);
  const f = fileIndex(sq);
  rows[r] = `${f ? f : ""}${piece}${7 - f ? 7 - f : ""}`;
  return `${rows.join("/")} w - - 0 1`;
};

function rays(from: Square, dirs: [number, number][], slide: boolean): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of dirs) {
    let f = fileIndex(from) + df;
    let r = rankIndex(from) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      out.push(squareAt(f, r));
      if (!slide) break;
      f += df;
      r += dr;
    }
  }
  return out;
}
const STRAIGHT: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const JUMPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const fileSquares = (file: string) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${file}${r}` as Square);
const rankSquares = (rank: number) => ["a", "b", "c", "d", "e", "f", "g", "h"].map((f) => `${f}${rank}` as Square);

export const LESSONS: Record<string, Lesson> = {
  board: {
    id: "board",
    steps: [
      { kind: "say", pose: "wave", title: "This is the board.", body: "64 squares, light and dark, like a little town. Every game happens here.", fen: EMPTY },
      {
        kind: "say",
        pose: "reading",
        title: "Files and ranks.",
        body: "Columns are files, named a to h. Rows are ranks, numbered 1 to 8. Here's the e-file and the 4th rank.",
        fen: EMPTY,
        highlight: [...fileSquares("e"), ...rankSquares(4)],
      },
      { kind: "tap", pose: "thinking", title: "Every square has a name.", body: "File first, then rank. Tap e4.", fen: EMPTY, targets: ["e4"], hint: "Find the e-file, then count up to rank 4." },
      { kind: "tap", pose: "thinking", title: "One more.", body: "Tap d5.", fen: EMPTY, targets: ["d5"], hint: "d is just left of e. Count up to 5." },
      { kind: "tap", pose: "thinking", title: "Light on the right.", body: "The square in your bottom-right corner is always light. Tap it.", fen: EMPTY, targets: ["h1"], hint: "Look at the corner nearest your right hand." },
      { kind: "say", pose: "happy", title: "Here's how a game starts.", body: "White sits at the bottom, Black at the top. Pawns stand in front; the big pieces wait behind them.", fen: START_FEN },
      { kind: "tap", pose: "thinking", title: "Find the king.", body: "The king is the tallest piece, with a little cross. Tap the white king.", fen: START_FEN, targets: ["e1"], hint: "It's in the middle of the bottom row, on e1." },
      { kind: "tap", pose: "thinking", title: "The queen loves her colour.", body: "The white queen starts on a light square, right next to her king. Tap her.", fen: START_FEN, targets: ["d1"], hint: "She wears the spiky crown, on d1." },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "How many squares are on a chessboard?",
        fen: EMPTY,
        options: [{ label: "32" }, { label: "64", correct: true }, { label: "100" }],
        hint: "8 files times 8 ranks.",
      },
    ],
  },

  moves: {
    id: "moves",
    steps: [
      { kind: "say", pose: "reading", title: "The rook goes straight.", body: "Up, down, left or right, as far as it likes, until something is in the way.", fen: solo("R", "d4"), highlight: rays("d4", STRAIGHT, true) },
      { kind: "stars", pose: "thinking", title: "Collect the stars.", body: "Tap the rook, then tap where it should go. Visit every star.", fen: solo("R", "a1"), stars: ["a5", "e5", "e8"], hint: "Straight lines only. Go up to a5 first." },
      { kind: "say", pose: "reading", title: "The bishop slides diagonally.", body: "It stays on its own colour for the whole game.", fen: solo("B", "d4"), highlight: rays("d4", DIAG, true) },
      { kind: "stars", pose: "thinking", title: "Diagonal stars.", body: "Guide the bishop to every star.", fen: solo("B", "c1"), stars: ["e3", "g5", "d8"], hint: "Corner to corner, like an X. e3 is two steps up and right." },
      { kind: "say", pose: "wow", title: "The queen does both.", body: "Straight like a rook, diagonal like a bishop. She's your strongest piece.", fen: solo("Q", "d4"), highlight: [...rays("d4", STRAIGHT, true), ...rays("d4", DIAG, true)] },
      { kind: "stars", pose: "thinking", title: "Queen's tour.", body: "Visit all three stars with the queen.", fen: solo("Q", "d1"), stars: ["d6", "h2", "b8"], hint: "Go straight up to d6, then think diagonally." },
      { kind: "say", pose: "reading", title: "The knight jumps.", body: "Two squares one way, then one to the side: an L. It's the only piece that hops over others.", fen: solo("N", "d4"), highlight: rays("d4", JUMPS, false) },
      { kind: "stars", pose: "thinking", title: "Hop, hop, hop.", body: "Jump the knight to each star.", fen: solo("N", "b1"), stars: ["c3", "e4", "g5"], hint: "From b1, two up and one right lands on c3." },
      { kind: "say", pose: "reading", title: "The king takes small steps.", body: "One square in any direction. Slow, but the most important piece you have.", fen: solo("K", "e4"), highlight: rays("e4", [...STRAIGHT, ...DIAG], false) },
      { kind: "stars", pose: "thinking", title: "Little steps.", body: "Walk the king to both stars.", fen: solo("K", "e1"), stars: ["f2", "g3"], hint: "One diagonal step at a time." },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Which piece can jump over other pieces?",
        fen: EMPTY,
        options: [{ label: "Rook" }, { label: "Knight", correct: true }, { label: "Bishop" }],
        hint: "Think of the L-shaped hop.",
      },
    ],
  },

  pawns: {
    id: "pawns",
    steps: [
      { kind: "say", pose: "reading", title: "Pawns march forward.", body: "One square at a time. On its very first move, a pawn may take two.", fen: "8/8/8/8/8/8/4P3/8 w - - 0 1", highlight: ["e3", "e4"] },
      { kind: "move", pose: "thinking", title: "A big first step.", body: "Move the pawn two squares forward.", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", goal: { type: "exact", from: "e2", to: "e4" }, hint: "Tap the pawn, then the square two above it.", hintSquares: ["e2", "e4"] },
      { kind: "say", pose: "reading", title: "Pawns capture diagonally.", body: "A pawn can't take what's in front of it. It captures one square diagonally forward.", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", highlight: ["d5"] },
      { kind: "move", pose: "thinking", title: "Your turn to capture.", body: "Take the black pawn.", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", goal: { type: "capture" }, hint: "Diagonal, up and to the left.", hintSquares: ["e4", "d5"] },
      { kind: "say", pose: "wow", title: "Small piece, big dreams.", body: "A pawn that reaches the far side becomes a queen, or any piece you like.", fen: "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", highlight: ["b8"] },
      { kind: "move", pose: "thinking", title: "Make a queen.", body: "Push the pawn to the last row.", fen: "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", goal: { type: "promote" }, hint: "One more step forward.", hintSquares: ["b7", "b8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "How do pawns capture?",
        fen: EMPTY,
        options: [{ label: "Straight ahead" }, { label: "Diagonally forward", correct: true }, { label: "Backwards" }],
        hint: "Remember the black pawn you just took.",
      },
    ],
  },

  check: {
    id: "check",
    steps: [
      { kind: "say", pose: "wow", title: "Check!", body: "When a king is attacked, it's in check. It must get out of danger on the very next move.", fen: "4k3/8/8/8/8/8/8/4R1K1 b - - 0 1", check: "e8", highlight: rays("e1", [[0, 1]], true).slice(0, 6) },
      {
        kind: "choice",
        pose: "thinking",
        title: "Spot it.",
        body: "Is the black king in check?",
        fen: "4k3/8/8/1B6/8/8/8/4K3 b - - 0 1",
        options: [{ label: "Yes", correct: true }, { label: "No" }],
        hint: "Follow the bishop's diagonal toward the king.",
      },
      { kind: "move", pose: "thinking", title: "Give check.", body: "Move your rook so it attacks the black king.", fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", goal: { type: "check" }, hint: "The king sits on the top row. Can your rook get there?", hintSquares: ["a1", "a8"] },
      { kind: "say", pose: "reading", title: "Checkmate wins the game.", body: "Checkmate means the king is in check and has no way out. Here, the pawns block their own king.", fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", check: "g8" },
      { kind: "move", pose: "thinking", title: "Checkmate in one.", body: "Find the move that traps the black king.", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", goal: { type: "mate" }, hint: "The king is stuck behind its pawns. Look at the top row.", hintSquares: ["a1", "a8"] },
      { kind: "move", pose: "thinking", title: "One more.", body: "Your queen and king work together. Checkmate!", fen: "7k/5K2/8/8/8/8/8/6Q1 w - - 0 1", goal: { type: "mate" }, hint: "Put the queen right next to the black king, where your king protects her.", hintSquares: ["g1", "g7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Check or checkmate?",
        body: "Black to move. What is this?",
        fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1",
        check: "g8",
        options: [{ label: "Check" }, { label: "Checkmate", correct: true }],
        hint: "Can the king move, block or capture?",
      },
    ],
  },

  firstGame: {
    id: "firstGame",
    steps: [
      { kind: "say", pose: "wave", title: "Time for a real game.", body: "You play White, I play Black. I'll go gently. There's no clock, so take your time.", fen: START_FEN },
      { kind: "say", pose: "reading", title: "A few good habits.", body: "Move a centre pawn, bring out knights and bishops, and keep your king safe. Have fun!", fen: START_FEN },
      { kind: "game", pose: "thinking", title: "Your first game", body: "You're White. Make your move.", fen: START_FEN, level: "cody", minMoves: 12 },
    ],
  },
};

/* ---------------- Unit 2 · Playing well ---------------- */

Object.assign(LESSONS, {
  castling: {
    id: "castling",
    steps: [
      { kind: "say", pose: "reading", title: "Castling.", body: "A special move: the king steps two squares toward a rook, and the rook hops over to its other side. It tucks your king away safely.", fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", highlight: ["g1", "f1", "c1", "d1"] },
      { kind: "move", pose: "thinking", title: "Castle short.", body: "Tap the king, then the square two to its right.", fen: "4k3/8/8/8/8/8/5PPP/4K2R w K - 0 1", goal: { type: "exact", from: "e1", to: "g1" }, hint: "The king goes to g1; the rook jumps to f1 by itself.", hintSquares: ["e1", "g1"] },
      { kind: "say", pose: "wow", title: "Three rules.", body: "You can't castle out of check, through an attacked square, or after the king or that rook has moved.", fen: "4k3/8/8/8/2b5/8/5PPP/4K2R w K - 0 1", highlight: ["f1"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Spot it.",
        body: "Can White castle short here?",
        fen: "4k3/8/8/8/2b5/8/5PPP/4K2R w K - 0 1",
        options: [{ label: "Yes" }, { label: "No", correct: true }],
        hint: "Follow the bishop's diagonal. Which square does it watch?",
      },
      { kind: "move", pose: "thinking", title: "Castle long.", body: "Now castle toward the queen's side.", fen: "4k3/8/8/8/8/8/PPP5/R3K3 w Q - 0 1", goal: { type: "exact", from: "e1", to: "c1" }, hint: "Two squares to the left: c1.", hintSquares: ["e1", "c1"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Why castle early?",
        body: "What does castling do for you?",
        fen: "4k3/8/8/8/8/8/5PPP/5RK1 w - - 0 1",
        options: [{ label: "Keeps the king safe and brings a rook out", correct: true }, { label: "Wins a pawn" }, { label: "It's required by the rules" }],
        hint: "Look where the king and rook ended up.",
      },
    ],
  },

  special: {
    id: "special",
    steps: [
      { kind: "say", pose: "reading", title: "En passant.", body: "If a pawn rushes two squares and lands beside your pawn, you may capture it as if it moved one. Only on the very next move.", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", highlight: ["d6"] },
      { kind: "move", pose: "thinking", title: "Capture en passant.", body: "Black just played d7 to d5. Take it!", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", goal: { type: "exact", from: "e5", to: "d6" }, hint: "Your pawn moves diagonally to d6, behind the black pawn.", hintSquares: ["e5", "d6"] },
      { kind: "say", pose: "wow", title: "Stalemate is a draw.", body: "If the side to move has no legal moves but is not in check, the game is a draw. Winning players must watch out for it.", fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", highlight: ["h8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "What happened?",
        body: "Black to move. What is this position?",
        fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        options: [{ label: "Checkmate" }, { label: "Stalemate, a draw", correct: true }, { label: "Black can still move" }],
        hint: "Is the black king in check right now?",
      },
      { kind: "move", pose: "thinking", title: "Win, don't draw.", body: "Give checkmate, and avoid stalemate.", fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", goal: { type: "mate" }, hint: "Check from the top row. Your king covers the escape squares.", hintSquares: ["f1", "f8"] },
    ],
  },

  values: {
    id: "values",
    steps: [
      { kind: "say", pose: "reading", title: "What pieces are worth.", body: "Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9. The king is priceless. Use these to decide trades.", fen: "8/8/8/8/8/8/8/8 w - - 0 1" },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Which is worth more?",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        options: [{ label: "A rook", correct: true }, { label: "A knight" }, { label: "They're equal" }],
        hint: "Rook 5, knight 3.",
      },
      { kind: "move", pose: "thinking", title: "Take the big one.", body: "Your knight can capture two things. Take the most valuable.", fen: "4k3/8/8/3r4/4p3/2N5/8/4K3 w - - 0 1", goal: { type: "exact", from: "c3", to: "d5" }, hint: "A rook is worth 5, a pawn only 1.", hintSquares: ["c3", "d5"] },
      { kind: "move", pose: "thinking", title: "Only safe captures.", body: "One capture loses your queen. Find the safe one.", fen: "4k3/8/2p5/3p4/6n1/8/8/3QK3 w - - 0 1", goal: { type: "exact", from: "d1", to: "g4" }, hint: "The d5 pawn is protected by c6. The knight isn't protected.", hintSquares: ["d1", "g4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Good trade?",
        body: "You give a bishop (3) to win a rook (5).",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        options: [{ label: "Yes, I gain 2", correct: true }, { label: "No, I lose 2" }],
        hint: "5 minus 3.",
      },
    ],
  },

  forks: {
    id: "forks",
    steps: [
      { kind: "say", pose: "wow", title: "The fork.", body: "One piece attacks two at once. The opponent can only save one. Knights are famous for it.", fen: "r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1", highlight: ["a8", "e8"], check: "e8" },
      { kind: "move", pose: "thinking", title: "Fork the king and rook.", body: "Jump your knight to attack both.", fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", goal: { type: "exact", from: "b5", to: "c7" }, hint: "Which square is a knight's jump from both a8 and e8?", hintSquares: ["b5", "c7"] },
      { kind: "move", pose: "thinking", title: "Pawns fork too.", body: "Push a pawn to attack two pieces.", fen: "4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1", goal: { type: "exact", from: "d3", to: "d4" }, hint: "A pawn on d4 attacks c5 and e5.", hintSquares: ["d3", "d4"] },
      { kind: "move", pose: "thinking", title: "Queen fork.", body: "Check the king and hit the knight at the same time.", fen: "6k1/8/1n6/8/8/8/8/4Q1K1 w - - 0 1", goal: { type: "exact", from: "e1", to: "e6" }, hint: "From e6 the queen sees g8 and b6.", hintSquares: ["e1", "e6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "What is a fork?",
        fen: "r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1",
        options: [{ label: "One piece attacking two at once", correct: true }, { label: "Two pieces protecting each other" }, { label: "A pawn reaching the end" }],
        hint: "Look at the knight on c7.",
      },
    ],
  },

  pins: {
    id: "pins",
    steps: [
      { kind: "say", pose: "reading", title: "The pin.", body: "A pinned piece can't move without exposing something more valuable behind it. Here the knight shields its king.", fen: "4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1", highlight: ["c6", "d7", "e8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Can it move?",
        body: "Black to move. Can the knight on c6 move?",
        fen: "4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1",
        options: [{ label: "Yes" }, { label: "No, it's pinned to the king", correct: true }],
        hint: "What would the bishop attack if the knight stepped away?",
      },
      { kind: "move", pose: "thinking", title: "Make a pin.", body: "Pin the knight to the king with your bishop.", fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", goal: { type: "exact", from: "f1", to: "b5" }, hint: "Line up bishop, knight and king on one diagonal.", hintSquares: ["f1", "b5"] },
      { kind: "move", pose: "thinking", title: "Attack the pinned piece.", body: "It can't run. Hit it with a pawn.", fen: "4k3/8/2n5/1B6/3P4/8/8/4K3 w - - 0 1", goal: { type: "exact", from: "d4", to: "d5" }, hint: "One step forward attacks c6.", hintSquares: ["d4", "d5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "A piece pinned to its king…",
        fen: "4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1",
        options: [{ label: "…can't legally move off the line", correct: true }, { label: "…is captured at once" }, { label: "…can move anywhere" }],
        hint: "Moving it would put its own king in check.",
      },
    ],
  },

  /* ---------------- Unit 3 · Checkmate patterns ---------------- */

  ladder: {
    id: "ladder",
    steps: [
      { kind: "say", pose: "reading", title: "The ladder.", body: "Two rooks take turns: one guards a row, the other checks on the next. The king is pushed up, rung by rung, to the edge.", fen: "8/8/8/3k4/R7/1R6/8/6K1 w - - 0 1", highlight: rankSquares(4) },
      {
        kind: "line",
        pose: "thinking",
        title: "Climb the ladder.",
        body: "Check, then check again with the other rook, until it's mate.",
        fen: "8/8/8/3k4/R7/1R6/8/6K1 w - - 0 1",
        moves: ["b3b5", "d5e6", "a4a6", "e6e7", "b5b7", "e7d8", "a6a8"],
        hint: "Always check on the row in front of the king with the rook that isn't guarding.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Where does the ladder push the king?",
        fen: "R2k4/1R6/8/8/8/8/8/6K1 b - - 0 1",
        check: "d8",
        options: [{ label: "To the edge of the board", correct: true }, { label: "To the centre" }, { label: "Toward your king" }],
        hint: "Look where it got stuck.",
      },
    ],
  },

  queenMate: {
    id: "queenMate",
    steps: [
      { kind: "say", pose: "reading", title: "Queen and king.", body: "The queen boxes the king in, your king walks up to help, then the queen delivers mate right next to it.", fen: "k7/8/1K6/8/8/8/8/3Q4 w - - 0 1" },
      { kind: "move", pose: "thinking", title: "Finish it.", body: "Checkmate with the queen.", fen: "k7/8/1K6/8/8/8/8/3Q4 w - - 0 1", goal: { type: "mate" }, hint: "Check along the top row. Your king covers a7 and b7.", hintSquares: ["d1", "d8"] },
      { kind: "move", pose: "wow", title: "Careful: stalemate!", body: "One tempting move is a draw. Find the mate.", fen: "k7/8/1K6/8/8/8/8/2Q5 w - - 0 1", goal: { type: "mate" }, hint: "Qc7 leaves Black no moves but no check. Check from c8 instead.", hintSquares: ["c1", "c8"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Mate in two.",
        body: "Push the king to the corner, then mate.",
        fen: "1k6/8/2K5/8/8/8/8/7Q w - - 0 1",
        moves: ["h1h7", "b8a8", "h7b7"],
        hint: "Take away the second row first.",
        mateEnds: true,
      },
    ],
  },

  /* ---------------- Unit 4 · Openings ---------------- */

  centre: {
    id: "centre",
    steps: [
      { kind: "say", pose: "reading", title: "The centre.", body: "The four squares in the middle — d4, d5, e4 and e5 — are the centre. Pieces there reach more of the board.", fen: START_FEN, highlight: ["d4", "d5", "e4", "e5"] },
      { kind: "move", pose: "thinking", title: "Open in the middle.", body: "Move a centre pawn two squares.", fen: START_FEN, goal: { type: "exact", from: "e2", to: "e4" }, hint: "The pawn in front of your king.", hintSquares: ["e2", "e4"] },
      { kind: "say", pose: "happy", title: "Black answers.", body: "A good reply also claims the centre. Now both e-pawns stand in the middle.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", highlight: ["e4", "e5"] },
      { kind: "move", pose: "thinking", title: "A second centre pawn.", body: "Bring the d-pawn up beside it.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", goal: { type: "exact", from: "d2", to: "d4" }, hint: "The pawn next to the one you already moved.", hintSquares: ["d2", "d4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Which first move fights for the centre?",
        fen: START_FEN,
        options: [{ label: "Pawn to a4" }, { label: "Pawn to e4", correct: true }, { label: "Pawn to h3" }],
        hint: "Look at the four middle squares.",
      },
    ],
  },

  develop: {
    id: "develop",
    steps: [
      { kind: "say", pose: "reading", title: "Bring the pieces out.", body: "Knights and bishops want to leave home early. Knights are happiest on f3, c3, f6 and c6, aimed at the centre.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", highlight: ["f3", "c3"] },
      { kind: "move", pose: "thinking", title: "Develop the knight.", body: "Jump the king's knight toward the centre.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", goal: { type: "exact", from: "g1", to: "f3" }, hint: "Two squares up and one toward the middle.", hintSquares: ["g1", "f3"] },
      { kind: "say", pose: "reading", title: "Then the bishop.", body: "The light-squared bishop can go to c4. From there it looks down the diagonal toward f7.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2", highlight: ["c4", "f7"] },
      { kind: "move", pose: "thinking", title: "Put the bishop out.", body: "Develop the bishop to c4.", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2", goal: { type: "exact", from: "f1", to: "c4" }, hint: "A long diagonal, two squares left of the knight.", hintSquares: ["f1", "c4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "In the opening, what should you do first?",
        fen: START_FEN,
        options: [{ label: "Move the queen all over" }, { label: "Develop knights and bishops", correct: true }, { label: "Push every pawn" }],
        hint: "The pieces on the back row want a job.",
      },
    ],
  },

  italian: {
    id: "italian",
    steps: [
      { kind: "say", pose: "wave", title: "The Italian game.", body: "A calm way to start: pawn to e4, knight to f3, bishop to c4, then castle. You will play all four.", fen: START_FEN, highlight: ["e4", "f3", "c4", "g1"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Play the opening.",
        body: "e4, Nf3, Bc4, and castle short. Black answers in the centre.",
        fen: START_FEN,
        moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"],
        hint: "Centre pawn, knight, bishop, then the king steps to g1.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "What does the bishop eye?",
        body: "Your bishop on c4 aims at one square in particular.",
        fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4",
        options: [{ label: "f7", correct: true }, { label: "a7" }, { label: "h7" }],
        hint: "Follow the diagonal from c4 toward Black's king.",
      },
    ],
  },

  queenOut: {
    id: "queenOut",
    steps: [
      { kind: "say", pose: "wow", title: "Leave the queen at home.", body: "She is your strongest piece, so beginners rush her out. The other side then gains time by attacking her.", fen: "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", highlight: ["h5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Second move.",
        body: "You played e4, and Black played e5. What next?",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        options: [{ label: "Queen to h5" }, { label: "Knight to f3", correct: true }, { label: "Queen to f3" }],
        hint: "Develop a piece. Save the queen.",
      },
      { kind: "say", pose: "reading", title: "She gets chased.", body: "The knight on f6 attacks the queen. You have to move her again, and your other pieces are still at home.", fen: "rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 3 3", highlight: ["h5", "f6"] },
      { kind: "move", pose: "thinking", title: "Tuck her back.", body: "Move the queen to e2, out of danger.", fen: "rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 3 3", goal: { type: "exact", from: "h5", to: "e2" }, hint: "Back toward your own side, on the e-file.", hintSquares: ["h5", "e2"] },
    ],
  },

  weakSquare: {
    id: "weakSquare",
    steps: [
      { kind: "say", pose: "reading", title: "f7 is tender.", body: "Before castling, f2 and f7 are defended only by the king. A bishop on c4 and a queen on h5 both look at f7.", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", highlight: ["f7", "c4", "h5"] },
      { kind: "move", pose: "thinking", title: "The scholar's mate.", body: "Take on f7 with the queen. It is mate, because the bishop protects her.", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", goal: { type: "mate" }, hint: "The queen and the bishop meet on f7.", hintSquares: ["h5", "f7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Would you count on it?",
        body: "This mate only works if f7 is left bare. A careful opponent defends it and then chases your queen.",
        fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        options: [{ label: "Develop, and watch f7", correct: true }, { label: "Always start with the queen" }, { label: "f7 is the safest square" }],
        hint: "The Italian game attacks f7 without risking the queen.",
      },
    ],
  },

  /* ---------------- Unit 5 · More tactics ---------------- */

  skewer: {
    id: "skewer",
    steps: [
      { kind: "say", pose: "wow", title: "The skewer.", body: "A rook, bishop or queen attacks a valuable piece, and a lesser piece sits behind it on the same line. The front piece must move. Then you take what was hiding.", fen: "4q3/4k3/8/8/8/8/8/4R2K w - - 0 1", highlight: ["e6", "e7", "e8"] },
      { kind: "move", pose: "thinking", title: "Skewer king and queen.", body: "Check the king so the queen behind it is lost.", fen: "4q3/4k3/8/8/8/8/8/4R2K w - - 0 1", goal: { type: "exact", from: "e1", to: "e6" }, hint: "Up the e-file, stopping just in front of the king.", hintSquares: ["e1", "e6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "How is a skewer different from a pin?",
        fen: "4q3/4k3/4R3/8/8/8/8/7K b - - 1 1",
        options: [{ label: "The more valuable piece is in front", correct: true }, { label: "The pieces are not on a line" }, { label: "Only knights can skewer" }],
        hint: "Here the king is in front and the queen is behind.",
      },
    ],
  },

  discovery: {
    id: "discovery",
    steps: [
      { kind: "say", pose: "reading", title: "A discovered attack.", body: "One piece steps aside and uncovers an attack from the piece behind it. If that attack is a check, it is a discovered check.", fen: "4k3/8/2q5/8/4B3/8/8/4R2K w - - 0 1", highlight: ["e1", "e4", "e8"] },
      { kind: "move", pose: "thinking", title: "Step aside and take.", body: "Move the bishop, uncover the rook's check, and capture the queen.", fen: "4k3/8/2q5/8/4B3/8/8/4R2K w - - 0 1", goal: { type: "exact", from: "e4", to: "c6" }, hint: "The bishop leaves the e-file and lands on the queen.", hintSquares: ["e4", "c6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Why is the queen lost?",
        fen: "4k3/8/2B5/8/8/8/8/4R2K b - - 0 1",
        check: "e8",
        options: [{ label: "The rook check means she cannot be saved", correct: true }, { label: "Bishops are worth more than queens" }, { label: "The queen was pinned" }],
        hint: "Black must answer the check from the rook.",
      },
    ],
  },

  defender: {
    id: "defender",
    steps: [
      { kind: "say", pose: "reading", title: "Remove the guard.", body: "The knight on c6 is the only piece defending the queen. Capture the guard, and the queen is loose.", fen: "4k3/4q3/2n5/1B6/8/8/8/7K w - - 0 1", highlight: ["c6", "e7"] },
      { kind: "move", pose: "thinking", title: "Take the knight.", body: "Capture the piece that guards the queen.", fen: "4k3/4q3/2n5/1B6/8/8/8/7K w - - 0 1", goal: { type: "exact", from: "b5", to: "c6" }, hint: "The bishop on b5 reaches the knight in one step.", hintSquares: ["b5", "c6"] },
      { kind: "move", pose: "thinking", title: "Now the queen.", body: "Nothing defends her. Take the queen.", fen: "4k3/4q3/8/8/8/8/8/4R2K w - - 0 1", goal: { type: "exact", from: "e1", to: "e7" }, hint: "Straight up the open file.", hintSquares: ["e1", "e7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Before you capture a guarded piece, you can…",
        fen: "4k3/4q3/2n5/1B6/8/8/8/7K w - - 0 1",
        options: [{ label: "Take away its defender first", correct: true }, { label: "Ignore the defender" }, { label: "Only capture pawns" }],
        hint: "Think about the knight you just removed.",
      },
    ],
  },

  doubleCheck: {
    id: "doubleCheck",
    steps: [
      { kind: "say", pose: "wow", title: "Double check.", body: "Sometimes the piece that steps aside also gives check, and so does the piece it uncovers. Two checks at once. The king must move. It cannot capture one attacker and block the other.", fen: "4k3/8/8/8/4B3/8/8/4R2K w - - 0 1", highlight: ["e1", "e4", "e8"] },
      { kind: "move", pose: "thinking", title: "Check with both.", body: "Move the bishop so it checks, and the rook checks too.", fen: "4k3/8/8/8/4B3/8/8/4R2K w - - 0 1", goal: { type: "exact", from: "e4", to: "g6" }, hint: "A diagonal step that still attacks the king, off the e-file.", hintSquares: ["e4", "g6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "In a double check, Black can…",
        fen: "4k3/8/6B1/8/8/8/8/4R2K b - - 1 1",
        check: "e8",
        options: [{ label: "Only move the king", correct: true }, { label: "Block both checks at once" }, { label: "Capture both pieces" }],
        hint: "One move cannot answer two different checks.",
      },
    ],
  },

  /* ---------------- Unit 6 · Endgames ---------------- */

  activeKing: {
    id: "activeKing",
    steps: [
      { kind: "say", pose: "reading", title: "The king joins in.", body: "While many pieces are on the board, the king hides. In the endgame it becomes a strong piece. Walk it toward the centre.", fen: "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1", highlight: ["d4", "e4", "f4"] },
      { kind: "move", pose: "thinking", title: "Step up.", body: "Move your king toward the centre.", fen: "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1", goal: { type: "exact", from: "e1", to: "f2" }, hint: "One square up and to the right.", hintSquares: ["e1", "f2"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "In an endgame, the king should…",
        fen: "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1",
        options: [{ label: "Join the fight", correct: true }, { label: "Hide in the corner" }, { label: "Stay on the first rank" }],
        hint: "Few pieces are left to attack it.",
      },
    ],
  },

  opposition: {
    id: "opposition",
    steps: [
      { kind: "say", pose: "reading", title: "The opposition.", body: "When the kings face each other with one square between them, the side that does not have to move has the opposition. The other king must step aside.", fen: "8/8/8/4k3/8/4K3/8/8 w - - 0 1", highlight: ["e3", "e4", "e5"] },
      { kind: "move", pose: "thinking", title: "Take the opposition.", body: "Step straight toward the black king, leaving one square between you.", fen: "8/8/8/8/4k3/8/8/4K3 w - - 0 1", goal: { type: "exact", from: "e1", to: "e2" }, hint: "One square up the e-file.", hintSquares: ["e1", "e2"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Who has it?",
        body: "The kings face each other. It is White to move.",
        fen: "8/8/8/4k3/8/4K3/8/8 w - - 0 1",
        options: [{ label: "Black", correct: true }, { label: "White" }, { label: "Neither" }],
        hint: "The side that must move does not have the opposition.",
      },
    ],
  },

  passedPawn: {
    id: "passedPawn",
    steps: [
      { kind: "say", pose: "reading", title: "A passed pawn.", body: "A passed pawn has no enemy pawn on its file, or on the files beside it, that can block it or capture it. Its job is to march and become a queen.", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", highlight: ["e2", "e4", "e8"] },
      { kind: "move", pose: "thinking", title: "Start the march.", body: "Push the passed pawn.", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", goal: { type: "exact", from: "e2", to: "e4" }, hint: "Two squares on its first move.", hintSquares: ["e2", "e4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "A passed pawn is a pawn that…",
        fen: "4k3/8/8/8/4P3/8/8/4K3 w - - 0 1",
        options: [{ label: "No enemy pawn can stop it from the side", correct: true }, { label: "Has already promoted" }, { label: "Sits on the edge of the board" }],
        hint: "Look at the e-file. Black has no pawns at all.",
      },
    ],
  },

  escort: {
    id: "escort",
    steps: [
      { kind: "say", pose: "reading", title: "Walk with the pawn.", body: "A pawn on its own can be caught. The king walks beside it and keeps the enemy king away until the pawn promotes.", fen: "6k1/8/4P3/4K3/8/8/8/8 w - - 0 1", highlight: ["e6", "e7", "e8"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Make a queen.",
        body: "Push the pawn. When the black king steps closer, promote.",
        fen: "6k1/8/4P3/4K3/8/8/8/8 w - - 0 1",
        moves: ["e6e7", "g8f7", "e7e8q"],
        hint: "One step, then the last step, and choose a queen.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Why does the king stand next to the pawn?",
        fen: "4Q3/5k2/8/4K3/8/8/8/8 b - - 0 2",
        options: [{ label: "To keep the enemy king from taking it", correct: true }, { label: "The king has to promote too" }, { label: "Kings cannot move in an endgame" }],
        hint: "Look at how close the black king got.",
      },
    ],
  },

  rookFile: {
    id: "rookFile",
    steps: [
      { kind: "say", pose: "reading", title: "Rook behind the pawn.", body: "The best square for a rook in a pawn ending is behind the passed pawn. The pawn moves up, and the rook keeps protecting it from behind.", fen: "8/8/8/4P3/8/8/k7/R5K1 w - - 0 1", highlight: ["e1", "e5", "e8"] },
      { kind: "move", pose: "thinking", title: "Get behind it.", body: "Move the rook to the file of the passed pawn, behind it.", fen: "8/8/8/4P3/8/8/k7/R5K1 w - - 0 1", goal: { type: "exact", from: "a1", to: "e1" }, hint: "Slide along the first rank to the e-file.", hintSquares: ["a1", "e1"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Where should the rook stand?",
        fen: "8/8/8/4P3/8/8/k7/4R1K1 w - - 0 1",
        options: [{ label: "Behind the passed pawn", correct: true }, { label: "In front, blocking it" }, { label: "On the edge, far away" }],
        hint: "The pawn needs a clear road, with help from behind.",
      },
    ],
  },

  /* ---------------- Unit 7 · More checkmates ---------------- */

  backRank: {
    id: "backRank",
    steps: [
      { kind: "say", pose: "reading", title: "The back rank.", body: "Pawns on f7, g7 and h7 keep the king safe from the front, and they also trap it. A rook or queen on the 8th rank is mate.", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", highlight: ["f8", "g8", "h8"] },
      { kind: "move", pose: "thinking", title: "Mate on the 8th.", body: "Checkmate with the rook.", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", goal: { type: "mate" }, hint: "The whole top row is open. Go there.", hintSquares: ["a1", "a8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Why can't the king escape?",
        body: "Black to move would be lost. What holds the king in?",
        fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1",
        check: "g8",
        options: [{ label: "Its own pawns, and the rook on the 8th", correct: true }, { label: "The king is not in check" }, { label: "A knight is attacking it" }],
        hint: "Look at f7, g7 and h7.",
      },
    ],
  },

  smothered: {
    id: "smothered",
    steps: [
      { kind: "say", pose: "wow", title: "Smothered mate.", body: "A knight can mate a king that is boxed in by its own pieces. The king has no square, and it cannot capture a knight that jumps in from two squares away.", fen: "6rk/6pp/8/6N1/8/8/8/7K w - - 0 1", highlight: ["f7", "g8", "g7", "h7"] },
      { kind: "move", pose: "thinking", title: "Jump in.", body: "Checkmate with the knight.", fen: "6rk/6pp/8/6N1/8/8/8/7K w - - 0 1", goal: { type: "mate" }, hint: "The knight attacks h8 from f7.", hintSquares: ["g5", "f7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Why is this mate only a knight's trick?",
        fen: "6rk/5Npp/8/8/8/8/8/7K b - - 1 1",
        check: "h8",
        options: [{ label: "The king is smothered by its own rook and pawns", correct: true }, { label: "The knight is protected by a pawn" }, { label: "Kings cannot be mated in the corner" }],
        hint: "g8, g7 and h7 are all filled by Black's own pieces.",
      },
    ],
  },

  arabian: {
    id: "arabian",
    steps: [
      { kind: "say", pose: "reading", title: "Rook and knight.", body: "In the corner, a rook and a knight mate together. The rook checks on the h-file. The knight covers the escape square the rook cannot.", fen: "7k/8/5N2/8/7R/8/8/6K1 w - - 0 1", highlight: ["h7", "g8", "f6"] },
      { kind: "move", pose: "thinking", title: "The Arabian mate.", body: "Checkmate with the rook.", fen: "7k/8/5N2/8/7R/8/8/6K1 w - - 0 1", goal: { type: "mate" }, hint: "Up the h-file, next to the king. The knight already watches g8.", hintSquares: ["h4", "h7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "What does the knight do in this mate?",
        fen: "7k/7R/5N2/8/8/8/8/6K1 b - - 1 1",
        check: "h8",
        options: [{ label: "Covers the square the rook does not", correct: true }, { label: "Gives the check itself" }, { label: "Nothing. The rook mates alone" }],
        hint: "Look at g8.",
      },
    ],
  },

  bishopPair: {
    id: "bishopPair",
    steps: [
      { kind: "say", pose: "reading", title: "Two bishops.", body: "Two bishops cover both colours. With your king beside them, they can drive the enemy king into a corner and mate.", fen: "k7/8/K7/8/8/8/7B/1B6 w - - 0 1", highlight: ["a8", "b7", "a7"] },
      { kind: "move", pose: "thinking", title: "Mate with the bishops.", body: "Slide the bishop from b1 to e4.", fen: "k7/8/K7/8/8/8/7B/1B6 w - - 0 1", goal: { type: "mate" }, hint: "The long diagonal from b1.", hintSquares: ["b1", "e4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Why do you need both bishops?",
        fen: "k7/8/K7/8/4B3/8/7B/8 b - - 1 1",
        check: "a8",
        options: [{ label: "Each bishop covers one colour of square", correct: true }, { label: "One bishop is enough for this mate" }, { label: "Bishops can jump" }],
        hint: "A single bishop never changes colour.",
      },
    ],
  },

  rookKing: {
    id: "rookKing",
    steps: [
      { kind: "say", pose: "reading", title: "King and rook.", body: "The rook cuts the king off along a rank or file. Your king stands beside it and covers the squares the rook cannot. Then the rook mates on the edge.", fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1", highlight: ["g7", "g8", "h7"] },
      { kind: "move", pose: "thinking", title: "Mate on the edge.", body: "Checkmate with the rook.", fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1", goal: { type: "mate" }, hint: "The top row. Your king already covers the escape squares.", hintSquares: ["a1", "a8"] },
      { kind: "move", pose: "thinking", title: "One more.", body: "Same idea, other corner.", fen: "1k6/8/1K6/8/8/8/8/7R w - - 0 1", goal: { type: "mate" }, hint: "Use the top row again.", hintSquares: ["h1", "h8"] },
    ],
  },
} satisfies Record<string, Lesson>);

/** Handmade checkmate-in-one drills that unlock with the check lesson. */
export const MATE_DRILLS: MoveStep[] = [
  { kind: "move", pose: "thinking", title: "Back-row mate.", body: "Checkmate in one.", fen: "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1", goal: { type: "mate" }, hint: "The king can't step forward past its pawns.", hintSquares: ["d1", "d8"] },
  { kind: "move", pose: "thinking", title: "Knight trap.", body: "Checkmate in one.", fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", goal: { type: "mate" }, hint: "The king is boxed in. Which square does the knight attack it from?", hintSquares: ["g5", "f7"] },
  { kind: "move", pose: "thinking", title: "Queen on the edge.", body: "Checkmate in one.", fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1", goal: { type: "mate" }, hint: "Your king guards the second row. Attack along the top.", hintSquares: ["h1", "h8"] },
  { kind: "move", pose: "thinking", title: "Rook and king.", body: "Checkmate in one.", fen: "1k6/8/1K6/8/8/8/8/7R w - - 0 1", goal: { type: "mate" }, hint: "Your king covers the escape squares. Use the rook on the top row.", hintSquares: ["h1", "h8"] },
];

export const isInteractive = (s: Step): s is InteractiveStep => s.kind === "tap" || s.kind === "move" || s.kind === "stars" || s.kind === "choice" || s.kind === "line";

/** Five practice items from what the learner has finished, shuffled. */
export function buildDrills(completed: string[], rand: () => number = Math.random, count = 5): InteractiveStep[] {
  const pool: InteractiveStep[] = [];
  for (const id of completed) for (const s of LESSONS[id]?.steps ?? []) if (isInteractive(s)) pool.push(s);
  if (completed.includes("check")) pool.push(...MATE_DRILLS);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
