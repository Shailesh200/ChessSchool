/**
 * Single source of truth for Pre-School class ids and lesson order.
 * Consumed by school.mjs, seed prerequisites, and curriculum order checks.
 * Keep packages/progression/src/preschool.ts in sync (validated by curriculum:order).
 */
export const PRESCHOOL_CLASS_IDS = [
  "class-pre-board",
  "class-pre-meet-pieces",
  "class-pre-pawn-moves",
  "class-pre-knight-moves",
  "class-pre-rook-moves",
  "class-pre-bishop-moves",
  "class-pre-queen-moves",
  "class-pre-king-moves",
  "class-pre-capture",
  "class-pre-special",
  "class-pre-endings",
  "class-pre-material",
  "class-pre-game",
  "class-pre-language",
];

/** @type {Record<string, { title: string, emoji: string, blurb: string, difficulty: number }>} */
export const PRESCHOOL_CLASS_META = {
  "class-pre-board": {
    title: "The Chess Board",
    emoji: "🗺️",
    blurb: "Squares, setup & coordinates",
    difficulty: 1,
  },
  "class-pre-meet-pieces": {
    title: "Meet the Pieces",
    emoji: "♟️",
    blurb: "One lesson per piece — what they look like",
    difficulty: 1,
  },
  "class-pre-pawn-moves": {
    title: "How Pawns Move",
    emoji: "♟️",
    blurb: "One step, two steps & capture",
    difficulty: 1,
  },
  "class-pre-knight-moves": {
    title: "How Knights Move",
    emoji: "♞",
    blurb: "The L-shape jump",
    difficulty: 1,
  },
  "class-pre-rook-moves": {
    title: "How Rooks Move",
    emoji: "♜",
    blurb: "Straight lines on files & ranks",
    difficulty: 1,
  },
  "class-pre-bishop-moves": {
    title: "How Bishops Move",
    emoji: "♝",
    blurb: "Diagonal slides",
    difficulty: 1,
  },
  "class-pre-queen-moves": {
    title: "How the Queen Moves",
    emoji: "♛",
    blurb: "Rook + bishop combined",
    difficulty: 1,
  },
  "class-pre-king-moves": {
    title: "How the King Moves",
    emoji: "♚",
    blurb: "One square at a time",
    difficulty: 1,
  },
  "class-pre-capture": {
    title: "Capture & Blocking",
    emoji: "⚔️",
    blurb: "Taking pieces & blocked paths",
    difficulty: 1,
  },
  "class-pre-special": {
    title: "Special Moves",
    emoji: "✨",
    blurb: "Promotion, castling & en passant",
    difficulty: 1,
  },
  "class-pre-endings": {
    title: "How Games End",
    emoji: "🏁",
    blurb: "Check, checkmate, stalemate & draws",
    difficulty: 1,
  },
  "class-pre-material": {
    title: "Piece Values",
    emoji: "💎",
    blurb: "Counting material on the board",
    difficulty: 1,
  },
  "class-pre-game": {
    title: "Playing a Game",
    emoji: "🎮",
    blurb: "Goals, resigning & clocks",
    difficulty: 1,
  },
  "class-pre-language": {
    title: "Chess Language",
    emoji: "📝",
    blurb: "Read squares & write moves like Qd5",
    difficulty: 1,
  },
};

/** @type {Record<string, string[]>} */
export const PRESCHOOL_CLASS_LESSONS = {
  "class-pre-board": ["pre-board-intro", "pre-board-setup", "pre-square-d5", "pre-square-e4"],
  "class-pre-meet-pieces": [
    "pre-meet-pawn",
    "pre-meet-rook",
    "pre-meet-knight",
    "pre-meet-bishop",
    "pre-meet-queen",
    "pre-meet-king",
  ],
  "class-pre-pawn-moves": [
    "pre-pawn-one-step",
    "pre-pawn-two-step",
    "pre-pawn-capture-step",
    "pre-pawn-quiz",
  ],
  "class-pre-knight-moves": [
    "pre-knight-see-l",
    "pre-knight-jump-empty",
    "pre-knight-basics",
    "pre-knight-quiz",
  ],
  "class-pre-rook-moves": [
    "pre-rook-up-file",
    "pre-rook-side-rank",
    "pre-rook-basics",
    "pre-rook-quiz",
  ],
  "class-pre-bishop-moves": ["pre-bishop-diagonal-info", "pre-bishop-basics", "pre-bishop-quiz"],
  "class-pre-queen-moves": [
    "pre-queen-on-rank",
    "pre-queen-on-diagonal",
    "pre-queen-moves",
    "pre-queen-slide-quiz",
  ],
  "class-pre-king-moves": ["pre-king-one-square", "pre-king-moves", "pre-king-quiz"],
  "class-pre-capture": ["pre-capture-intro", "pre-rules-blocking"],
  "class-pre-special": [
    "pre-rules-promotion",
    "pre-rules-promotion-quiz",
    "pre-moves-promotion",
    "pre-rules-castling",
    "pre-rules-castling-quiz",
    "pre-moves-castling",
    "pre-rules-en-passant",
    "pre-rules-en-passant-quiz",
    "pre-moves-en-passant",
  ],
  "class-pre-endings": [
    "pre-rules-check-intro",
    "pre-rules-check-quiz",
    "pre-rules-escape-intro",
    "pre-moves-escape-check",
    "pre-rules-checkmate-intro",
    "pre-rules-checkmate-quiz",
    "pre-rules-stalemate",
    "pre-rules-draw",
  ],
  "class-pre-material": ["pre-material-intro", "pre-material-quiz"],
  "class-pre-game": ["pre-game-goal", "pre-game-clocks"],
  "class-pre-language": [
    "pre-notation-files",
    "pre-notation-e-file",
    "pre-notation-ranks",
    "pre-notation-d6",
    "pre-notation-piece-letters",
    "pre-notation-pawn-e4",
    "pre-notation-pawn-capture",
    "pre-notation-watch",
    "pre-notation-read-d6",
    "pre-notation-practice",
  ],
};

export const PRESCHOOL_LESSON_ORDER = PRESCHOOL_CLASS_IDS.flatMap(
  (id) => PRESCHOOL_CLASS_LESSONS[id] ?? [],
);

export function buildPreschoolClasses() {
  return PRESCHOOL_CLASS_IDS.map((id) => ({
    id,
    ...PRESCHOOL_CLASS_META[id],
    lessonIds: PRESCHOOL_CLASS_LESSONS[id],
  }));
}
