/**
 * Extra Pre-School lessons — absolute-beginner path (one idea per lesson).
 * Merged into LESSONS in lessons.mjs.
 */

const K = "k7/8/8/8/8/8/8/7K w - - 0 1";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** Bishop on c1 with a clear light-square diagonal to f4 (no pawns in the way). */
const BISHOP_C1 = "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1";

export const PRESCHOOL_EXTRA = [
  // ── Meet each piece (never played before) ─────────────────────────────────
  {
    id: "pre-meet-pawn",
    unit: "class-pre-meet-pieces",
    title: "Meet the Pawn",
    subtitle: "Your foot soldiers",
    emoji: "♟️",
    prerequisites: ["pre-square-e4"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "pawn-look",
        kind: "info",
        coach:
          "This is a pawn ♟. You start with eight of them on the second row. Pawns are small, but an army of pawns can win the game.",
        fen: START,
        highlight: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
        highlightRanks: [2],
      },
      {
        id: "pawn-quiz",
        kind: "quiz",
        coach: "",
        question: "How many pawns does each player start with?",
        options: [
          { label: "Eight", emoji: "8️⃣" },
          { label: "Two", emoji: "2️⃣" },
          { label: "Sixteen", emoji: "🔢" },
          { label: "One", emoji: "1️⃣" },
        ],
        correct: 0,
        explain:
          "Eight pawns each — they stand in a row in front of your bigger pieces.",
        failText: "Count the pawn row on rank 2 (White) or rank 7 (Black).",
        visual: "piece-roster",
      },
    ],
  },
  {
    id: "pre-meet-rook",
    unit: "class-pre-meet-pieces",
    title: "Meet the Rook",
    subtitle: "Castle towers",
    emoji: "♜",
    prerequisites: ["pre-meet-pawn"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "rook-look",
        kind: "info",
        coach:
          "This is a rook ♜. It looks like a castle tower. You have two rooks — one in each corner on the back row.",
        fen: START,
        highlight: ["a1", "h1"],
      },
      {
        id: "rook-quiz",
        kind: "quiz",
        coach: "",
        question: "Where do the rooks start?",
        options: [
          { label: "In the corners", emoji: "🏰" },
          { label: "In the centre", emoji: "🎯" },
          { label: "On the pawn row", emoji: "♟️" },
          { label: "Next to the king only", emoji: "♚" },
        ],
        correct: 0,
        explain: "Rooks begin on a1 and h1 for White — the corner squares.",
        failText: "Look at the four corners of the board setup.",
        visual: "piece-roster",
      },
    ],
  },
  {
    id: "pre-meet-knight",
    unit: "class-pre-meet-pieces",
    title: "Meet the Knight",
    subtitle: "The horse",
    emoji: "♞",
    prerequisites: ["pre-meet-rook"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "knight-look",
        kind: "info",
        coach:
          "This is a knight ♞ — it looks like a horse's head. Knights sit next to the rooks. They are the only pieces that jump.",
        fen: START,
        highlight: ["b1", "g1"],
      },
      {
        id: "knight-quiz",
        kind: "quiz",
        coach: "",
        question: "What animal does the knight look like?",
        options: [
          { label: "A horse", emoji: "🐴" },
          { label: "An elephant", emoji: "🐘" },
          { label: "A lion", emoji: "🦁" },
          { label: "A bird", emoji: "🐦" },
        ],
        correct: 0,
        explain: "Knights are the horse pieces — remember they jump in an L-shape.",
        failText: "The knight's shape is a horse head on the chess board.",
        visual: "piece-roster",
      },
    ],
  },
  {
    id: "pre-meet-bishop",
    unit: "class-pre-meet-pieces",
    title: "Meet the Bishop",
    subtitle: "Diagonal sliders",
    emoji: "♝",
    prerequisites: ["pre-meet-knight"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "bishop-look",
        kind: "info",
        coach:
          "This is a bishop ♝. You have two bishops — one starts on a light square and one on a dark square. They move diagonally.",
        fen: START,
        highlight: ["c1", "f1"],
      },
      {
        id: "bishop-quiz",
        kind: "quiz",
        coach: "",
        question: "How many bishops do you start with?",
        options: [
          { label: "Two", emoji: "2️⃣" },
          { label: "One", emoji: "1️⃣" },
          { label: "Four", emoji: "4️⃣" },
          { label: "Eight", emoji: "8️⃣" },
        ],
        correct: 0,
        explain: "Two bishops — one on c1 and one on f1 at the start.",
        failText: "Bishops stand beside the knights on the back row.",
        visual: "piece-roster",
      },
    ],
  },
  {
    id: "pre-meet-queen",
    unit: "class-pre-meet-pieces",
    title: "Meet the Queen",
    subtitle: "The strongest piece",
    emoji: "♛",
    prerequisites: ["pre-meet-bishop"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "queen-look",
        kind: "info",
        coach:
          "This is the queen ♛ — your most powerful piece. She starts on her own colour: the white queen on a light square (d1), the black queen on a dark square (d8).",
        fen: START,
        highlight: ["d1", "d8"],
      },
      {
        id: "queen-quiz",
        kind: "quiz",
        coach: "",
        question: "Which piece is the strongest?",
        options: [
          { label: "Queen", emoji: "♛" },
          { label: "Pawn", emoji: "♟️" },
          { label: "King", emoji: "♚" },
          { label: "Knight", emoji: "♞" },
        ],
        correct: 0,
        explain:
          "The queen can move like a rook and a bishop combined — very powerful!",
        failText: "The queen combines straight and diagonal moves.",
        visual: "royalty",
      },
    ],
  },
  {
    id: "pre-meet-king",
    unit: "class-pre-meet-pieces",
    title: "Meet the King",
    subtitle: "Protect him always",
    emoji: "♚",
    prerequisites: ["pre-meet-queen"],
    xp: 10,
    tag: "preschool",
    steps: [
      {
        id: "king-look",
        kind: "info",
        coach:
          "This is the king ♚ — the most important piece, not the strongest. If your king is trapped with no escape, you lose. The king starts beside the queen.",
        fen: START,
        highlight: ["e1", "e8"],
      },
      {
        id: "king-quiz",
        kind: "quiz",
        coach: "",
        question: "What happens if your king cannot escape an attack?",
        options: [
          { label: "You lose (checkmate)", emoji: "🏁" },
          { label: "You win", emoji: "🏆" },
          { label: "The game is a draw", emoji: "🤝" },
          { label: "You get an extra queen", emoji: "♛" },
        ],
        correct: 0,
        explain:
          "Checkmate ends the game — protect your king from the very first move.",
        failText: "When the king has no safe square, the game is over.",
        visual: "royalty",
      },
    ],
  },

  // ── Pawn moves (step by step) ─────────────────────────────────────────────
  {
    id: "pre-pawn-one-step",
    unit: "class-pre-pawn-moves",
    title: "Pawn: One Step",
    subtitle: "Forward one square",
    emoji: "♟️",
    prerequisites: ["pre-meet-king"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "one-info",
        kind: "info",
        coach:
          "A pawn moves straight forward — one square at a time. It never moves sideways or backward. Tap the arrow: from e2 to e3.",
        fen: START,
        highlight: ["e2", "e3"],
        highlightFiles: ["e"],
        arrows: [{ startSquare: "e2", endSquare: "e3", color: "#5b5bd6" }],
      },
      {
        id: "one-play",
        kind: "move",
        coach: "Move the pawn on e2 forward one square to e3.",
        fen: START,
        solution: ["e2:e3"],
        highlight: ["e2"],
        highlightFiles: ["e"],
        successText: "One step forward — that's how pawns march!",
        failText: "Push the e2 pawn to e3 (one square straight ahead).",
        tag: "preschool",
      },
    ],
  },
  {
    id: "pre-pawn-two-step",
    unit: "class-pre-pawn-moves",
    title: "Pawn: Two Steps",
    subtitle: "From the starting row",
    emoji: "♟️",
    prerequisites: ["pre-pawn-one-step"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "two-info",
        kind: "info",
        coach:
          "From its starting square a pawn may jump two squares forward — but only on its first move. After that, only one square at a time.",
        fen: START,
        highlight: ["e2", "e4"],
        arrows: [
          { startSquare: "e2", endSquare: "e3", color: "#5b5bd6" },
          { startSquare: "e2", endSquare: "e4", color: "#34d399" },
        ],
      },
      {
        id: "two-play",
        kind: "move",
        coach: "This pawn has not moved yet. Push it two squares from e2 to e4.",
        fen: START,
        solution: ["e2:e4"],
        highlight: ["e2"],
        highlightFiles: ["e"],
        highlightRanks: [2, 4],
        successText: "Two steps on the first move — a popular opening!",
        failText: "Move the e2 pawn two squares forward to e4.",
        tag: "preschool",
      },
    ],
  },
  {
    id: "pre-pawn-capture-step",
    unit: "class-pre-pawn-moves",
    title: "Pawn: Capture",
    subtitle: "Diagonal only",
    emoji: "⚔️",
    prerequisites: ["pre-pawn-two-step"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "cap-info",
        kind: "info",
        coach:
          "Pawns capture differently from how they walk. To take a piece, move one square diagonally forward onto the enemy square.",
        fen: "k7/8/8/3p4/4P3/8/8/7K w - - 0 1",
        highlight: ["e4", "d5"],
        arrows: [{ startSquare: "e4", endSquare: "d5", color: "#cf4324" }],
      },
      {
        id: "cap-play",
        kind: "move",
        coach: "Capture the black pawn on d5 with your pawn on e4.",
        fen: "k7/8/8/3p4/4P3/8/8/7K w - - 0 1",
        solution: ["e4:d5"],
        highlight: ["e4", "d5"],
        successText: "Diagonal capture — well done!",
        failText: "Move e4 diagonally to d5.",
        tag: "preschool",
      },
    ],
  },

  // ── Knight moves ──────────────────────────────────────────────────────────
  {
    id: "pre-knight-see-l",
    unit: "class-pre-knight-moves",
    title: "Knight: The L-Shape",
    subtitle: "Two then one",
    emoji: "♞",
    prerequisites: ["pre-pawn-capture-step"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "l-info",
        kind: "info",
        coach:
          "Knights move in an L: two squares one way, then one square sideways. From d4 a knight can reach eight squares — and it jumps over anything in the way.",
        fen: "k7/8/8/8/3N4/8/8/7K w - - 0 1",
        highlight: ["d4", "f5", "e6", "c6", "b5", "b3", "c2", "e2", "f3"],
        arrows: [
          { startSquare: "d4", endSquare: "f5", color: "#5b5bd6" },
          { startSquare: "d4", endSquare: "e6", color: "#34d399" },
        ],
      },
    ],
  },
  {
    id: "pre-knight-jump-empty",
    unit: "class-pre-knight-moves",
    title: "Knight: First Jump",
    subtitle: "Jump to f3",
    emoji: "♞",
    prerequisites: ["pre-knight-see-l"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "jump-play",
        kind: "move",
        coach: "Move the knight from g1 to f3 — two squares up and one to the left.",
        fen: START,
        solution: ["g1:f3"],
        highlight: ["g1", "f3"],
        successText: "Nf3 — a classic knight hop!",
        failText: "Jump the knight from g1 to f3 (L-shape).",
        tag: "preschool",
      },
    ],
  },

  // ── Rook moves ────────────────────────────────────────────────────────────
  {
    id: "pre-rook-up-file",
    unit: "class-pre-rook-moves",
    title: "Rook: Up the File",
    subtitle: "Straight line",
    emoji: "♜",
    prerequisites: ["pre-knight-jump-empty"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "file-info",
        kind: "info",
        coach:
          "Rooks slide straight along a file (column) or rank (row). They stop when they hit a piece — or capture an enemy on the way.",
        fen: "k7/8/8/8/8/8/8/3R3K w - - 0 1",
        highlight: ["d1", "d8"],
        highlightFiles: ["d"],
        arrows: [{ startSquare: "d1", endSquare: "d8", color: "#5b5bd6" }],
      },
      {
        id: "file-play",
        kind: "move",
        coach: "Slide the rook from d1 to d4 along the d-file.",
        fen: "k7/8/8/8/8/8/8/3R3K w - - 0 1",
        solution: ["d1:d4"],
        highlight: ["d1", "d4"],
        highlightFiles: ["d"],
        successText: "Straight up the file!",
        failText: "Move the rook from d1 to d4.",
        tag: "preschool",
      },
    ],
  },
  {
    id: "pre-rook-side-rank",
    unit: "class-pre-rook-moves",
    title: "Rook: Along the Rank",
    subtitle: "Left and right",
    emoji: "♜",
    prerequisites: ["pre-rook-up-file"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "rank-play",
        kind: "move",
        coach: "Slide the rook from a1 to e1 along the first rank.",
        fen: "k7/8/8/8/8/8/8/R6K w - - 0 1",
        solution: ["a1:e1"],
        highlight: ["a1", "e1"],
        highlightRanks: [1],
        successText: "Along the rank — rooks love open lines!",
        failText: "Move the rook from a1 to e1 sideways.",
        tag: "preschool",
      },
    ],
  },

  // ── Bishop moves ──────────────────────────────────────────────────────────
  {
    id: "pre-bishop-diagonal-info",
    unit: "class-pre-bishop-moves",
    title: "Bishop: Diagonals",
    subtitle: "Stay on one colour",
    emoji: "♝",
    prerequisites: ["pre-rook-side-rank"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "diag-info",
        kind: "info",
        coach:
          "Bishops slide on diagonals only. This bishop on c1 stays on light squares its whole life. It cannot hop to a dark square.",
        fen: BISHOP_C1,
        highlight: ["c1", "f4"],
        arrows: [{ startSquare: "c1", endSquare: "f4", color: "#7c5cd6" }],
      },
      {
        id: "diag-play",
        kind: "move",
        coach: "Slide the bishop from c1 to f4 along the diagonal.",
        fen: BISHOP_C1,
        solution: ["c1:f4"],
        highlight: ["c1", "f4"],
        successText: "Diagonal slide — bishops love long diagonals!",
        failText: "Move the c1 bishop to f4.",
        tag: "preschool",
      },
    ],
  },

  // ── Queen moves (one direction per lesson) ────────────────────────────────
  {
    id: "pre-queen-on-rank",
    unit: "class-pre-queen-moves",
    title: "Queen: Along a Rank",
    subtitle: "Like a rook",
    emoji: "♛",
    prerequisites: ["pre-bishop-diagonal-info"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "q-rank",
        kind: "move",
        coach:
          "The queen slides like a rook on ranks and files. Move the queen from d1 to d4.",
        fen: "k7/8/8/8/8/8/8/3Q3K w - - 0 1",
        solution: ["d1:d4"],
        highlight: ["d1", "d4"],
        successText: "Queen up the file!",
        failText: "Slide the queen from d1 to d4.",
        tag: "preschool",
      },
    ],
  },
  {
    id: "pre-queen-on-diagonal",
    unit: "class-pre-queen-moves",
    title: "Queen: On a Diagonal",
    subtitle: "Like a bishop",
    emoji: "♛",
    prerequisites: ["pre-queen-on-rank"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "q-diag",
        kind: "move",
        coach: "The queen also slides diagonally like a bishop. Move from d4 to g7.",
        fen: "k7/8/8/8/3Q4/8/8/7K w - - 0 1",
        solution: ["d4:g7"],
        highlight: ["d4", "g7"],
        successText: "Diagonal queen power!",
        failText: "Slide the queen from d4 to g7.",
        tag: "preschool",
      },
    ],
  },

  // ── King moves ────────────────────────────────────────────────────────────
  {
    id: "pre-king-one-square",
    unit: "class-pre-king-moves",
    title: "King: One Step",
    subtitle: "Any direction",
    emoji: "♚",
    prerequisites: ["pre-queen-on-diagonal"],
    xp: 15,
    tag: "preschool",
    steps: [
      {
        id: "k-info",
        kind: "info",
        coach:
          "The king moves one square in any direction — up, down, left, right, or diagonal. It is slow but must stay safe.",
        fen: "k7/8/8/8/8/8/8/4K3 w - - 0 1",
        highlight: ["e1", "d2", "e2", "f2", "d1", "f1"],
        arrows: [
          { startSquare: "e1", endSquare: "e2", color: "#5b5bd6" },
          { startSquare: "e1", endSquare: "f2", color: "#34d399" },
        ],
      },
      {
        id: "k-walk",
        kind: "move",
        coach: "Walk the king from e1 to e2 — one square forward.",
        fen: "k7/8/8/8/8/8/8/4K3 w - - 0 1",
        solution: ["e1:e2"],
        highlight: ["e1", "e2"],
        successText: "The king takes one careful step.",
        failText: "Move the king from e1 to e2.",
        tag: "preschool",
      },
    ],
  },
];
