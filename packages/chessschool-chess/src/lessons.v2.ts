import { START_FEN, type Square } from "./board";
import type { Lesson } from "./lessons";

const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";
const fileSquares = (file: string) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${file}${r}` as Square);

/** Units 12–18. Kept in a second file so the first eleven units stay easy to read. */
export const LESSONS_V2: Record<string, Lesson> = {
  /* ---------------- Unit 12 · King and pawn endings ---------------- */

  squareOfPawn: {
    id: "squareOfPawn",
    steps: [
      {
        kind: "say",
        pose: "reading",
        title: "The square of the pawn.",
        body: "Draw a square from the pawn to the promotion square, as wide as it is tall. If the defending king can step into that square, it can catch the pawn. If it cannot, the pawn runs home.",
        fen: "k7/8/8/8/4P3/8/8/4K3 w - - 0 1",
        highlight: ["e4", "e8", "h8", "h4"],
      },
      { kind: "move", pose: "thinking", title: "The king is too far.", body: "Black's king is outside the square. Push the pawn.", fen: "k7/8/8/8/4P3/8/8/4K3 w - - 0 1", goal: { type: "exact", from: "e4", to: "e5" }, hint: "Straight up the e-file.", hintSquares: ["e4", "e5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "When can a lone king stop a passed pawn?",
        fen: "k7/8/8/8/4P3/8/8/4K3 w - - 0 1",
        options: [{ label: "When it can step into the pawn's square", correct: true }, { label: "Only if it stands in front of the pawn" }, { label: "Never" }],
        hint: "Imagine the square to the promotion rank.",
      },
    ],
  },

  keySquares: {
    id: "keySquares",
    steps: [
      { kind: "say", pose: "reading", title: "Key squares.", body: "For a pawn to queen safely, your king must reach certain squares in front of it. For a pawn on e5, those key squares are d7, e7 and f7.", fen: "8/4k3/8/8/4PK2/8/8/8 w - - 0 1", highlight: ["d7", "e7", "f7"] },
      { kind: "move", pose: "thinking", title: "Step toward a key square.", body: "Walk the king to f5, closer to f7.", fen: "8/4k3/8/8/4PK2/8/8/8 w - - 0 1", goal: { type: "exact", from: "f4", to: "f5" }, hint: "One step up the f-file.", hintSquares: ["f4", "f5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Why they matter.",
        body: "What happens if your king reaches a key square?",
        fen: "8/4k3/8/4P3/4K3/8/8/8 w - - 0 1",
        options: [{ label: "The pawn can be escorted through", correct: true }, { label: "The game is stalemate" }, { label: "The pawn must be given up" }],
        hint: "The king clears a path and covers the promotion square.",
      },
    ],
  },

  rookPawn: {
    id: "rookPawn",
    steps: [
      { kind: "say", pose: "reading", title: "Rook pawns are different.", body: "A pawn on the a- or h-file is easier to draw against. If the defending king reaches the promotion corner, you usually cannot budge it without stalemate.", fen: "7k/8/7P/8/8/8/8/6K1 w - - 0 1", highlight: ["h8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The corner.",
        body: "Black's king has reached the promotion corner against a rook pawn. What is the usual result?",
        fen: "7k/8/7P/8/8/8/8/6K1 w - - 0 1",
        options: [{ label: "A draw", correct: true }, { label: "White always queens" }, { label: "Black is checkmated" }],
        hint: "The king cannot be forced out without leaving it no legal move.",
      },
      { kind: "say", pose: "happy", title: "A centre pawn is different.", body: "With a centre pawn and your king in front, you can still win. Push the pawn one step.", fen: "4k3/8/3K4/4P3/8/8/8/8 w - - 0 1" },
      { kind: "move", pose: "thinking", title: "Advance the pawn.", body: "Play e6, keeping the black king boxed.", fen: "4k3/8/3K4/4P3/8/8/8/8 w - - 0 1", goal: { type: "exact", from: "e5", to: "e6" }, hint: "One step up, next to their king.", hintSquares: ["e5", "e6"] },
    ],
  },

  triangulation: {
    id: "triangulation",
    steps: [
      { kind: "say", pose: "reading", title: "Lose a move on purpose.", body: "Sometimes the opposition works against you if it is your turn. You walk your king in a little triangle — three steps that end on the same square — so that it becomes their turn instead.", fen: "8/8/8/3k4/8/3K4/3P4/8 w - - 0 1" },
      { kind: "move", pose: "thinking", title: "Start the triangle.", body: "Step to e3 or c3. You are not running away — you are waiting.", fen: "8/8/8/3k4/8/3K4/3P4/8 w - - 0 1", goal: { type: "exact", from: "d3", to: "e3" }, hint: "One step to the right.", hintSquares: ["d3", "e3"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "What is the point?",
        body: "Why would you walk in a triangle?",
        fen: "8/8/8/3k4/8/3K4/3P4/8 w - - 0 1",
        options: [{ label: "To pass the move and gain the opposition", correct: true }, { label: "To hide the king in the corner" }, { label: "To give the pawn away" }],
        hint: "You want it to be their turn when the kings face each other.",
      },
    ],
  },

  pawnBreak: {
    id: "pawnBreak",
    steps: [
      { kind: "say", pose: "wow", title: "Breakthrough.", body: "Three pawns facing three can still make a queen. The trick is to sacrifice one so another runs through.", fen: "4k3/ppp5/8/PPP5/8/8/8/4K3 w - - 0 1", highlight: ["b6"] },
      { kind: "move", pose: "thinking", title: "The break.", body: "Push the middle pawn to b6. Whatever Black takes with, a second pawn will get through.", fen: "4k3/ppp5/8/PPP5/8/8/8/4K3 w - - 0 1", goal: { type: "exact", from: "b5", to: "b6" }, hint: "The b-pawn, one step forward.", hintSquares: ["b5", "b6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Why it works.",
        body: "After b6, if Black takes with the a-pawn, what do you do?",
        fen: "4k3/1pp5/1p6/P1P5/8/8/8/4K3 w - - 0 1",
        options: [{ label: "Push c6, then the a-pawn will run", correct: true }, { label: "Take back with the a-pawn" }, { label: "Move the king away" }],
        hint: "Keep sacrificing to clear a path on the other wing.",
      },
    ],
  },

  /* ---------------- Unit 13 · Rook endings ---------------- */

  lucena: {
    id: "lucena",
    steps: [
      { kind: "say", pose: "reading", title: "The Lucena position.", body: "Your pawn is on the seventh, your king in front of it, and their king is cut off. The winning idea is a bridge: the rook checks their king away, then blocks a check so your king can come out and the pawn can queen.", fen: "1K6/1P6/2k5/8/8/8/8/2R5 w - - 0 1" },
      { kind: "move", pose: "thinking", title: "The end of the idea.", body: "The king and pawn already cover the escapes. Mate with the rook.", fen: "1k6/1P6/1K6/8/8/8/8/2R5 w - - 0 1", goal: { type: "mate" }, hint: "The rook can reach the back rank, on c8.", hintSquares: ["c1", "c8"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The bridge.",
        body: "What is the rook's job in the Lucena?",
        fen: "1K6/1P6/2k5/8/8/4R3/8/8 w - - 0 1",
        options: [{ label: "Check the king away, then block a check so your king can leave", correct: true }, { label: "Give itself up for the pawn" }, { label: "Stay on the back rank forever" }],
        hint: "The rook both attacks and shields.",
      },
    ],
  },

  philidor: {
    id: "philidor",
    steps: [
      { kind: "say", pose: "reading", title: "The Philidor defence.", body: "When you are the one defending a rook ending, put your rook on the third rank (the sixth for them) and keep it there. Their king cannot come forward. When the pawn finally reaches the third, you check from behind.", fen: "8/8/8/3p4/3k4/8/R7/3K4 w - - 0 1", highlight: ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"] },
      { kind: "move", pose: "thinking", title: "Hold the third rank.", body: "Park the rook on a3.", fen: "8/8/8/3p4/3k4/8/R7/3K4 w - - 0 1", goal: { type: "exact", from: "a2", to: "a3" }, hint: "One step up the a-file.", hintSquares: ["a2", "a3"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Then what?",
        body: "When their pawn reaches your third rank, what should the rook do?",
        fen: "8/8/8/8/3p4/3kR3/8/3K4 w - - 0 1",
        options: [{ label: "Check the king from behind, on the file", correct: true }, { label: "Take the pawn at once, even if it hangs the rook" }, { label: "Move the king in front of the pawn" }],
        hint: "The king has no pawn shield once the pawn has stepped forward.",
      },
    ],
  },

  cutOff: {
    id: "cutOff",
    steps: [
      { kind: "say", pose: "reading", title: "Cut the king off.", body: "A rook on a file or rank the enemy king cannot cross is worth a lot. The king is trapped on a short side of the board and cannot help its pawns.", fen: "4k3/8/8/8/8/8/3R4/4K3 w - - 0 1", highlight: [...fileSquares("d")] },
      { kind: "move", pose: "thinking", title: "Cut the seventh.", body: "Slide the rook to d7. The king is now stuck on the last rank as well.", fen: "4k3/8/8/8/8/8/3R4/4K3 w - - 0 1", goal: { type: "exact", from: "d2", to: "d7" }, hint: "Straight up the d-file, just in front of their king.", hintSquares: ["d2", "d7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "A king that is cut off cannot…",
        fen: "4k3/3R4/8/8/8/8/8/4K3 b - - 0 1",
        options: [{ label: "Cross the rook's file or rank", correct: true }, { label: "Move at all" }, { label: "Be checked" }],
        hint: "The rook takes a whole line away.",
      },
    ],
  },

  rookVsPawn: {
    id: "rookVsPawn",
    steps: [
      { kind: "say", pose: "reading", title: "Rook against a pawn.", body: "A rook beats a pawn if you can get behind it, or check the king away, and then take it. Don't snatch a protected pawn if the king recaptures the rook — that is a draw.", fen: "8/8/8/8/8/2k5/p7/R3K3 w - - 0 1", highlight: ["a2"] },
      { kind: "move", pose: "thinking", title: "Take the unprotected pawn.", body: "The king is on c3, two squares away. The pawn on a2 is free.", fen: "8/8/8/8/8/2k5/p7/R3K3 w - - 0 1", goal: { type: "exact", from: "a1", to: "a2" }, hint: "The rook takes on a2.", hintSquares: ["a1", "a2"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The trap.",
        body: "If the pawn is protected by the king, should you take it with the rook?",
        fen: "8/8/8/8/8/k7/p7/R3K3 w - - 0 1",
        options: [{ label: "No — the king takes back and it is a draw", correct: true }, { label: "Yes, always" }, { label: "Only on the a-file" }],
        hint: "King and rook versus a lone king is a win. King versus king is a draw.",
      },
    ],
  },

  activityRook: {
    id: "activityRook",
    steps: [
      { kind: "say", pose: "reading", title: "An active rook.", body: "In a rook ending, activity matters more than a pawn. A rook on the seventh rank attacks pawns from behind and can trap the king on the edge.", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", highlight: ["a7", "f7", "g7", "h7"] },
      { kind: "move", pose: "thinking", title: "To the seventh.", body: "Put the rook on a7.", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", goal: { type: "exact", from: "a1", to: "a7" }, hint: "Straight up the a-file, onto their second rank.", hintSquares: ["a1", "a7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Where does an active rook belong?",
        body: "Pick the best home.",
        fen: "6k1/R4ppp/8/8/8/8/5PPP/6K1 b - - 1 1",
        options: [{ label: "Behind a passed pawn, or on the seventh rank", correct: true }, { label: "On its starting square" }, { label: "In front of its own pawns, blocking them" }],
        hint: "The rook wants open lines and weak pawns to chew.",
      },
    ],
  },

  /* ---------------- Unit 14 · Intermediate tactics ---------------- */

  overload: {
    id: "overload",
    steps: [
      { kind: "say", pose: "reading", title: "Overload.", body: "A piece with two jobs cannot do both at once. Here the black rook must guard the back rank and meet a check. Give the check, and the rank falls.", fen: "r4k2/5ppp/3N4/8/Q7/8/5PPP/4R1K1 w - - 0 1", highlight: ["a8", "e8"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Two jobs, one rook.",
        body: "Check on e8. When the rook takes, your queen recaptures and mates.",
        fen: "r4k2/5ppp/3N4/8/Q7/8/5PPP/4R1K1 w - - 0 1",
        moves: ["e1e8", "a8e8", "a4e8"],
        hint: "The e-file is open. Start with the rook.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "The idea.",
        body: "A piece is overloaded when…",
        fen: "4QK2/5ppp/8/8/8/8/5PPP/4k3 b - - 0 1",
        options: [{ label: "It has to defend two things at once", correct: true }, { label: "It has no legal moves" }, { label: "It is worth more than a queen" }],
        hint: "Pull it away from one job, and the other collapses.",
      },
    ],
  },

  deflection: {
    id: "deflection",
    steps: [
      { kind: "say", pose: "reading", title: "Deflection.", body: "You pull a defender off a key square with a forcing move, then take what it left behind.", fen: "3q2k1/5ppp/8/8/Q7/8/5PPP/4R1K1 w - - 0 1", highlight: ["d8", "e8"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Pull the queen away.",
        body: "Check on e8. The queen must take, and your queen mates on e8.",
        fen: "3q2k1/5ppp/8/8/Q7/8/5PPP/4R1K1 w - - 0 1",
        moves: ["e1e8", "d8e8", "a4e8"],
        hint: "Check first, then recapture with the queen.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "Deflection means…",
        fen: EMPTY,
        options: [{ label: "Luring a defender off a square you want", correct: true }, { label: "Trading every piece" }, { label: "Moving your king to the corner" }],
        hint: "You make the guard leave its post.",
      },
    ],
  },

  interference: {
    id: "interference",
    steps: [
      { kind: "say", pose: "reading", title: "Interference.", body: "Black's bishop on b7 defends the rook on e4, along the long diagonal. Drop a piece in the middle of that line, and the rook is suddenly hanging.", fen: "6k1/1b3ppp/8/8/4r3/2NQ4/5PPP/6K1 w - - 0 1", highlight: ["b7", "d5", "e4"] },
      { kind: "move", pose: "thinking", title: "Block the diagonal.", body: "Jump the knight to d5, right between the bishop and the rook.", fen: "6k1/1b3ppp/8/8/4r3/2NQ4/5PPP/6K1 w - - 0 1", goal: { type: "exact", from: "c3", to: "d5" }, hint: "The knight on c3 can land on d5.", hintSquares: ["c3", "d5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The idea.",
        body: "Interference works by…",
        fen: "6k1/1b3ppp/8/3N4/4r3/3Q4/5PPP/6K1 b - - 1 1",
        options: [{ label: "Blocking the line between a piece and what it defends", correct: true }, { label: "Capturing the king" }, { label: "Castling through check" }],
        hint: "A piece in the way means the defence no longer arrives.",
      },
    ],
  },

  zwischenzug: {
    id: "zwischenzug",
    steps: [
      { kind: "say", pose: "reading", title: "The in-between move.", body: "Don't recapture on instinct. A check in the middle of a sequence can change everything. Here the knight is hanging — but a rook check first wins the queen.", fen: "4k3/8/2q5/8/3N4/8/5Q2/4K3 w - - 0 1", highlight: ["f7"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Check first.",
        body: "Check on f7. When the king steps aside, take the queen.",
        fen: "4k3/8/2q5/8/3N4/8/5Q2/4K3 w - - 0 1",
        moves: ["f2f7", "e8d8", "d4c6"],
        hint: "The queen checks on f7, then the knight takes on c6.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "What is a zwischenzug?",
        body: "It's a German word players still use.",
        fen: EMPTY,
        options: [{ label: "A useful move played in between, often a check", correct: true }, { label: "Resigning early" }, { label: "Moving a pawn two squares" }],
        hint: "You insert a forcing move before you recapture.",
      },
    ],
  },

  attraction: {
    id: "attraction",
    steps: [
      { kind: "say", pose: "wow", title: "Attraction.", body: "You lure a piece — often the king — onto a square where a tactic works. A queen check on g8 pulls the rook there, and the knight mates on f7.", fen: "5r1k/5Qpp/8/6N1/8/8/5PPP/6K1 w - - 0 1", highlight: ["g8", "f7"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Pull the rook in.",
        body: "Check on g8. When the rook takes, mate with the knight.",
        fen: "5r1k/5Qpp/8/6N1/8/8/5PPP/6K1 w - - 0 1",
        moves: ["f7g8", "f8g8", "g5f7"],
        hint: "The queen goes to g8, then the knight jumps to f7.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "The idea.",
        body: "Attraction means…",
        fen: EMPTY,
        options: [{ label: "Forcing a piece onto a square where it can be punished", correct: true }, { label: "Always taking the longest path" }, { label: "Moving every pawn" }],
        hint: "You invite them in, then strike.",
      },
    ],
  },

  windmill: {
    id: "windmill",
    steps: [
      { kind: "say", pose: "wow", title: "The windmill.", body: "A rook and a bishop work as a saw. The rook checks, the king hides, then the rook steps aside — a discovered check from the bishop — and swings back again, picking up pieces as it goes.", fen: "6k1/5ppp/6R1/8/8/8/1B3PPP/6K1 w - - 0 1", highlight: ["g7", "f7"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Start the saw.",
        body: "Take on g7 with check. When the king goes to the corner, take on f7 with a discovered check.",
        fen: "6k1/5ppp/6R1/8/8/8/1B3PPP/6K1 w - - 0 1",
        moves: ["g6g7", "g8h8", "g7f7"],
        hint: "The rook is already on the g-file. Take the g-pawn first.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "What makes it work?",
        body: "The discovered check comes from…",
        fen: "7k/5Rpp/8/8/8/8/1B3PPP/6K1 b - - 0 2",
        options: [{ label: "The bishop, once the rook steps off the diagonal", correct: true }, { label: "A knight jump" }, { label: "Castling" }],
        hint: "Look at the bishop on b2 and the long diagonal to h8.",
      },
    ],
  },

  /* ---------------- Unit 15 · Attacking the king ---------------- */

  greekGift: {
    id: "greekGift",
    steps: [
      { kind: "say", pose: "reading", title: "The Greek gift.", body: "A classic sacrifice: the bishop takes on h7, the knight hops to g5, and the queen comes to h5. You give a piece to rip the king's shield off.", fen: "rnbq1rk1/pppn1ppp/4p3/3pP3/3P4/3B1N2/PPP2PPP/RNBQK2R w KQ - 0 7", highlight: ["h7", "g5", "h5"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Play the sacrifice.",
        body: "Bishop takes h7, knight to g5, queen to h5.",
        fen: "rnbq1rk1/pppn1ppp/4p3/3pP3/3P4/3B1N2/PPP2PPP/RNBQK2R w KQ - 0 7",
        moves: ["d3h7", "g8h7", "f3g5", "h7g8", "d1h5"],
        hint: "Start with the bishop on d3. The h-pawn is the target.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "The point.",
        body: "Why give the bishop on h7?",
        fen: "rnbq1rk1/pppn1ppB/4p3/3pP3/3P4/5N2/PPP2PPP/RNBQK2R b KQ - 0 7",
        options: [{ label: "To draw the king out and bring queen and knight in", correct: true }, { label: "To win a pawn and stop there" }, { label: "To castle queenside" }],
        hint: "The follow-up is Ng5 and Qh5, not a quiet retreat.",
      },
    ],
  },

  oppositeCastle: {
    id: "oppositeCastle",
    steps: [
      { kind: "say", pose: "reading", title: "Opposite-side castling.", body: "When the kings live on opposite wings, the game becomes a race. You throw pawns at their king, and they throw pawns at yours. The first one to open a file usually wins.", fen: "rnbq1rk1/ppp2ppp/2n5/3pp3/3PP3/2N5/PPP2PPP/2KR1BNR w - - 0 1", highlight: ["h2", "h4", "g2", "g4"] },
      { kind: "move", pose: "thinking", title: "Start the race.", body: "Push the h-pawn two squares, toward their king.", fen: "rnbq1rk1/ppp2ppp/2n5/3pp3/3PP3/2N5/PPP2PPP/2KR1BNR w - - 0 1", goal: { type: "exact", from: "h2", to: "h4" }, hint: "The pawn in front of the h-rook.", hintSquares: ["h2", "h4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The plan.",
        body: "When the kings are on opposite sides, you should…",
        fen: "rnbq1rk1/ppp2ppp/2n5/3pp3/3PP2P/2N5/PPP2PP1/2KR1BNR b - - 0 1",
        options: [{ label: "Storm pawns at their king and not delay", correct: true }, { label: "Trade all the pawns in the centre and stop" }, { label: "Hide every piece on the back rank" }],
        hint: "It is a race, not an ending.",
      },
    ],
  },

  pawnStorm: {
    id: "pawnStorm",
    steps: [
      { kind: "say", pose: "reading", title: "The pawn storm.", body: "Pawns are the cheapest way to open a king's files. Push them toward the shield, trade, and let the rooks and queen use the open lines.", fen: "6k1/5ppp/8/8/7P/8/5PP1/5RK1 w - - 0 1", highlight: ["h5", "h7"] },
      { kind: "move", pose: "thinking", title: "Cramp the shield.", body: "Push the h-pawn one more step, to h5.", fen: "6k1/5ppp/8/8/7P/8/5PP1/5RK1 w - - 0 1", goal: { type: "exact", from: "h4", to: "h5" }, hint: "The pawn already on h4 goes to h5.", hintSquares: ["h4", "h5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Then what?",
        body: "Once a file opens in front of their king, who should use it?",
        fen: "6k1/5pp1/8/7p/8/8/5PP1/5RK1 w - - 0 1",
        options: [{ label: "Your heavy pieces: rooks and the queen", correct: true }, { label: "Only the king" }, { label: "You should close the file again" }],
        hint: "Open files belong to the big pieces.",
      },
    ],
  },

  liftRook: {
    id: "liftRook",
    steps: [
      { kind: "say", pose: "reading", title: "The rook lift.", body: "A rook does not have to stay on the back rank. You can lift it to the third rank and swing it across toward the enemy king.", fen: "r5k1/pp3ppp/2p5/8/8/8/3Q1PPP/R4RK1 w - - 0 1", highlight: ["a3", "g3"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Swing the rook over.",
        body: "Lift the rook to a3, then swing it to g3.",
        fen: "r5k1/pp3ppp/2p5/8/8/8/3Q1PPP/R4RK1 w - - 0 1",
        moves: ["a1a3", "h7h6", "a3g3"],
        hint: "Up to a3 first, then across the third rank.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Why lift?",
        body: "A rook lift is useful because…",
        fen: "r5k1/pp3ppp/2p5/8/8/6R1/3Q1PPP/5RK1 b - - 2 2",
        options: [{ label: "The rook joins the attack without waiting for an open file on the first rank", correct: true }, { label: "It hides the rook from the game" }, { label: "It is the only way to castle" }],
        hint: "The third rank is a road across the board.",
      },
    ],
  },

  battery: {
    id: "battery",
    steps: [
      { kind: "say", pose: "reading", title: "A battery.", body: "Two pieces aiming the same way — a bishop and a queen on a diagonal, or two rooks on a file — are a battery. The front piece can step aside or even be given up, and the back one still hits the target.", fen: "6k1/5ppp/8/8/8/3B4/5PPP/3Q2K1 w - - 0 1", highlight: ["c2", "d3", "h7"] },
      { kind: "move", pose: "thinking", title: "Form the battery.", body: "Put the queen on c2, behind the bishop, aiming at h7.", fen: "6k1/5ppp/8/8/8/3B4/5PPP/3Q2K1 w - - 0 1", goal: { type: "exact", from: "d1", to: "c2" }, hint: "One step left and up, onto c2.", hintSquares: ["d1", "c2"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "In a battery, if the front piece is captured or moves…",
        fen: "6k1/5ppp/8/8/8/3B4/2Q2PPP/6K1 w - - 0 1",
        options: [{ label: "The piece behind it still attacks the same target", correct: true }, { label: "The attack disappears" }, { label: "You must resign" }],
        hint: "They share one line.",
      },
    ],
  },

  /* ---------------- Unit 16 · Opening ideas ---------------- */

  queensGambit: {
    id: "queensGambit",
    steps: [
      { kind: "say", pose: "wave", title: "The Queen's Gambit.", body: "A different way to start: the d-pawn first, then c4. You offer a wing pawn so you can fight for the centre. Black does not have to take it.", fen: START_FEN, highlight: ["d4", "c4"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Play the opening.",
        body: "d4, then c4, then develop the king's knight.",
        fen: START_FEN,
        moves: ["d2d4", "d7d5", "c2c4", "e7e6", "g1f3"],
        hint: "The d-pawn first, then the c-pawn, then the knight to f3.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "The offer.",
        body: "Why does White offer the c-pawn?",
        fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 1 3",
        options: [{ label: "To trade a wing pawn for more control of the centre", correct: true }, { label: "To give Black a free queen" }, { label: "Because c4 is a check" }],
        hint: "If Black takes on c4, White can build a big centre with e4 later.",
      },
    ],
  },

  sicilianIdea: {
    id: "sicilianIdea",
    steps: [
      { kind: "say", pose: "reading", title: "The Sicilian idea.", body: "Against e4, Black can fight for the centre with a c-pawn: …c5. You will still play Nf3 and d4, and open the d-file.", fen: START_FEN, highlight: ["c5", "d4"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Meet the Sicilian.",
        body: "e4, knight to f3, then d4.",
        fen: START_FEN,
        moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4"],
        hint: "Centre pawn, knight, then the d-pawn two squares.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Black's idea.",
        body: "What does …c5 fight for?",
        fen: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3",
        options: [{ label: "The d4 square, without blocking the c-file", correct: true }, { label: "Only the a-pawn" }, { label: "A quick checkmate on move two" }],
        hint: "The c-pawn watches d4 from the side.",
      },
    ],
  },

  frenchCaro: {
    id: "frenchCaro",
    steps: [
      { kind: "say", pose: "reading", title: "A solid centre.", body: "Black can also meet e4 with …e6 (the French) or …c6 (the Caro-Kann), then …d5. The centre often locks. You push e5 and attack on a wing.", fen: START_FEN, highlight: ["e4", "e5", "d4", "d5"] },
      {
        kind: "line",
        pose: "thinking",
        title: "The Advance.",
        body: "e4, d4, and when Black plays …d5, close the centre with e5.",
        fen: START_FEN,
        moves: ["e2e4", "e7e6", "d2d4", "d7d5", "e4e5"],
        hint: "Two centre pawns, then one more step to e5.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "A locked centre.",
        body: "When the centre pawns are locked, the plan is usually to…",
        fen: "rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
        options: [{ label: "Attack on a wing, because the centre cannot open easily", correct: true }, { label: "Trade only the kings" }, { label: "Never develop the pieces" }],
        hint: "Locked pawns point to a side of the board.",
      },
    ],
  },

  developmentRace: {
    id: "developmentRace",
    steps: [
      { kind: "say", pose: "reading", title: "Don't move the same piece twice.", body: "In the opening, every tempo matters. Bring a new piece out, or castle, before you go pawn-hunting with a piece that already has a job.", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", highlight: ["g1"] },
      { kind: "move", pose: "thinking", title: "Tuck the king away.", body: "Castle short rather than starting a new adventure with the knight.", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", goal: { type: "exact", from: "e1", to: "g1" }, hint: "The king steps two squares toward the rook.", hintSquares: ["e1", "g1"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "A good habit.",
        body: "In the opening, what should you usually avoid?",
        fen: "r1bq1rk1/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b - - 5 4",
        options: [{ label: "Moving the same piece again before the others are out", correct: true }, { label: "Castling" }, { label: "Putting a knight on f3" }],
        hint: "New pieces want a job too.",
      },
    ],
  },

  openingTraps: {
    id: "openingTraps",
    steps: [
      { kind: "say", pose: "wow", title: "Look before you take.", body: "Some traps look like a free queen. Legal's mate is the famous warning: if you snatch the queen and ignore a check, you can be mated in a few moves. You will play the winning side, so you see how it works — and how to avoid it.", fen: START_FEN },
      {
        kind: "line",
        pose: "thinking",
        title: "Legal's mate.",
        body: "Play the trap. After the bishop takes your queen, the bishop check and the knight mate finish it.",
        fen: START_FEN,
        moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "d7d6", "b1c3", "c8g4", "f3e5", "g4d1", "c4f7", "e8e7", "c3d5"],
        hint: "After the knights and bishop are out, take on e5. Leave the queen if they take it, and aim at f7.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "The lesson.",
        body: "Before you take a 'free' piece in the opening, you should…",
        fen: "r2qk2r/ppp2Bpp/2np4/3Nn3/4P3/8/PPPP1PPP/R1BbK2R b KQkq - 0 7",
        options: [{ label: "Check whether you are walking into a mate or a fork", correct: true }, { label: "Always take it as fast as you can" }, { label: "Resign" }],
        hint: "Count the checks that come after the capture.",
      },
    ],
  },

  /* ---------------- Unit 17 · Positional play ---------------- */

  outpost: {
    id: "outpost",
    steps: [
      { kind: "say", pose: "reading", title: "A knight outpost.", body: "An outpost is a square in the opponent's half that a pawn cannot chase you from. A knight there is a pest for the rest of the game.", fen: "4k3/pp3p2/2p1p3/3P4/8/2N5/PP2P3/4K3 w - - 0 1", highlight: ["e4"] },
      { kind: "move", pose: "thinking", title: "Park the knight.", body: "Jump the knight to e4. The c- and e-pawns cannot kick it.", fen: "4k3/pp3p2/2p1p3/3P4/8/2N5/PP2P3/4K3 w - - 0 1", goal: { type: "exact", from: "c3", to: "e4" }, hint: "From c3, two up and one to the right.", hintSquares: ["c3", "e4"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "What makes an outpost?",
        body: "A good outpost is a square…",
        fen: "4k3/pp3p2/2p1p3/3P4/4N3/8/PP2P3/4K3 b - - 1 1",
        options: [{ label: "That enemy pawns cannot drive a piece off", correct: true }, { label: "On your own back rank" }, { label: "That only a rook can stand on" }],
        hint: "Look at whether a pawn can ever attack that square.",
      },
    ],
  },

  goodBishop: {
    id: "goodBishop",
    steps: [
      { kind: "say", pose: "reading", title: "Good bishop, bad bishop.", body: "A bishop is unhappy when its own pawns sit on the same colour and block it. It is happy when those pawns are on the other colour, leaving its diagonals open.", fen: "4k3/8/8/3p4/3P4/4P3/3B4/4K3 w - - 0 1", highlight: ["d2", "d4", "e3"] },
      { kind: "move", pose: "thinking", title: "Get it outside the chain.", body: "Slide the bishop to a5, off the blocked squares.", fen: "4k3/8/8/3p4/3P4/4P3/3B4/4K3 w - - 0 1", goal: { type: "exact", from: "d2", to: "a5" }, hint: "A long diagonal to the left, up to a5.", hintSquares: ["d2", "a5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Quick check.",
        body: "A bishop is 'bad' when…",
        fen: "4k3/8/8/b2p4/3P4/4P3/8/4K3 w - - 1 1",
        options: [{ label: "Its own pawns stand on the same colour and get in the way", correct: true }, { label: "It is worth 9 points" }, { label: "It has just been developed" }],
        hint: "The pawns and the bishop should not fight for the same squares.",
      },
    ],
  },

  spaceAdvantage: {
    id: "spaceAdvantage",
    steps: [
      { kind: "say", pose: "reading", title: "Space.", body: "Pawns that stand further up the board give your pieces more room and leave the opponent cramped. A space advantage is something you can slowly use, not a tactic you cash in one move.", fen: "4k3/ppp2ppp/8/4P3/3P4/8/PPP2PPP/4K3 w - - 0 1", highlight: ["d5", "e5"] },
      { kind: "move", pose: "thinking", title: "Take more space.", body: "Push the d-pawn to d5.", fen: "4k3/ppp2ppp/8/4P3/3P4/8/PPP2PPP/4K3 w - - 0 1", goal: { type: "exact", from: "d4", to: "d5" }, hint: "The pawn on d4 goes one step forward.", hintSquares: ["d4", "d5"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "What space does.",
        body: "A space advantage usually means…",
        fen: "4k3/ppp2ppp/8/3PP3/8/8/PPP2PPP/4K3 b - - 0 1",
        options: [{ label: "Your pieces have more room; theirs feel cramped", correct: true }, { label: "You must checkmate on the next move" }, { label: "Pawns no longer matter" }],
        hint: "Think of how freely the pieces can move.",
      },
    ],
  },

  exchanges: {
    id: "exchanges",
    steps: [
      { kind: "say", pose: "reading", title: "When to trade.", body: "If you are ahead, trading pieces (not always pawns) makes the win simpler. Here you are a rook up. Offering a queen trade is a good practical choice.", fen: "4k3/5ppp/4q3/8/8/8/5PPP/4QRK1 w - - 0 1", highlight: ["e6"] },
      { kind: "move", pose: "thinking", title: "Trade queens.", body: "Take the queen on e6. Black can recapture, and you stay a rook up in a much simpler position.", fen: "4k3/5ppp/4q3/8/8/8/5PPP/4QRK1 w - - 0 1", goal: { type: "exact", from: "e1", to: "e6" }, hint: "Straight up the e-file.", hintSquares: ["e1", "e6"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "The rule of thumb.",
        body: "When you are ahead in material, it is usually good to…",
        fen: "4k3/5ppp/4Q3/8/8/8/5PPP/5RK1 b - - 0 1",
        options: [{ label: "Trade pieces and keep the extra material", correct: true }, { label: "Avoid every trade" }, { label: "Give the extra piece back at once" }],
        hint: "Fewer pieces means fewer surprises, and your extra one is felt more.",
      },
    ],
  },

  prophylaxis: {
    id: "prophylaxis",
    steps: [
      { kind: "say", pose: "reading", title: "Stop their idea.", body: "A good move is sometimes a quiet one that stops what they wanted to do. The knight on c6 would love to jump to b4 and attack the queen. A little pawn move takes that square away.", fen: "r3k3/ppp2ppp/2n5/8/8/3Q4/PPP2PPP/R3K3 w - - 0 1", highlight: ["b4", "a3"] },
      { kind: "move", pose: "thinking", title: "Take the square away.", body: "Play a3, so the knight cannot land on b4.", fen: "r3k3/ppp2ppp/2n5/8/8/3Q4/PPP2PPP/R3K3 w - - 0 1", goal: { type: "exact", from: "a2", to: "a3" }, hint: "The a-pawn, one step.", hintSquares: ["a2", "a3"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Prophylaxis means…",
        body: "The word is used a lot in chess books.",
        fen: "r3k3/ppp2ppp/2n5/8/8/P2Q4/1PP2PPP/R3K3 b - - 0 1",
        options: [{ label: "Preventing the opponent's plan before it starts", correct: true }, { label: "Always checking" }, { label: "Trading queens on move one" }],
        hint: "Ask what they want, then see if a cheap move stops it.",
      },
    ],
  },

  /* ---------------- Unit 18 · Practical play ---------------- */

  convertExtra: {
    id: "convertExtra",
    steps: [
      { kind: "say", pose: "reading", title: "Convert an extra pawn.", body: "When you are a pawn up, the plan is usually: trade pieces, keep pawns, and use your king. Don't get so greedy that you allow a stalemate or a perpetual.", fen: "4k3/8/3KP3/8/8/8/8/8 w - - 0 1" },
      { kind: "move", pose: "thinking", title: "Push the extra pawn.", body: "Play e7, driving the king back.", fen: "4k3/8/3KP3/8/8/8/8/8 w - - 0 1", goal: { type: "exact", from: "e6", to: "e7" }, hint: "The pawn goes one step, next to their king.", hintSquares: ["e6", "e7"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "A practical rule.",
        body: "You are a pawn up in the ending. What should you usually do?",
        fen: "4k3/4P3/3K4/8/8/8/8/8 b - - 0 1",
        options: [{ label: "Trade pieces, keep pawns, and advance the extra one", correct: true }, { label: "Avoid all pawn moves" }, { label: "Give the pawn back immediately" }],
        hint: "Simplifying pieces makes the extra pawn easier to queen.",
      },
    ],
  },

  whenToDraw: {
    id: "whenToDraw",
    steps: [
      { kind: "say", pose: "reading", title: "When to take a draw.", body: "If you are losing, a draw is a good save. A perpetual check — checking the king over and over so it cannot escape — is one way. Stalemate is another.", fen: "7k/8/8/8/8/5Q2/1r6/4K3 w - - 0 1" },
      {
        kind: "line",
        pose: "thinking",
        title: "Check, and check again.",
        body: "Check on f8, then on f7. The king is bouncing between two squares. That is how a perpetual starts.",
        fen: "7k/8/8/8/8/5Q2/1r6/4K3 w - - 0 1",
        moves: ["f3f8", "h8h7", "f8f7"],
        hint: "The queen can check from f8 first.",
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "A good save.",
        body: "If you are otherwise losing, a perpetual check is…",
        fen: "7k/5Q2/8/8/8/8/1r6/4K3 b - - 2 2",
        options: [{ label: "A draw, and a good practical result", correct: true }, { label: "A win for the side being checked" }, { label: "Against the rules" }],
        hint: "The same checks can be repeated, and the game is drawn.",
      },
    ],
  },

  defence: {
    id: "defence",
    steps: [
      { kind: "say", pose: "thinking", title: "Stay calm in defence.", body: "When you are in check or under threat, first make a list: can you take the attacker, can you block, or must the king move? Don't panic and give material away.", fen: "6k1/5ppp/8/8/8/4R3/6PP/3q2K1 w - - 0 1", check: "g1" },
      { kind: "move", pose: "thinking", title: "Block the check.", body: "The queen on d1 is checking you. Interpose the rook on e1.", fen: "6k1/5ppp/8/8/8/4R3/6PP/3q2K1 w - - 0 1", check: "g1", goal: { type: "exact", from: "e3", to: "e1" }, hint: "The rook can drop onto e1, between the queen and your king.", hintSquares: ["e3", "e1"] },
      {
        kind: "choice",
        pose: "thinking",
        title: "Three ways out of check.",
        body: "When you are in check, you may…",
        fen: "6k1/5ppp/8/8/8/8/6PP/3qR1K1 b - - 1 1",
        options: [{ label: "Capture the attacker, block the line, or move the king", correct: true }, { label: "Castle out of check" }, { label: "Skip your turn" }],
        hint: "Those are the only three legal replies.",
      },
    ],
  },

  calculation: {
    id: "calculation",
    steps: [
      { kind: "say", pose: "reading", title: "Checks, captures, threats.", body: "When you calculate, start with forcing moves: checks first, then captures, then threats. A quiet-looking position can hide a check that wins at once.", fen: "6k1/4qppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", highlight: ["d8"] },
      {
        kind: "line",
        pose: "thinking",
        title: "Look at the check first.",
        body: "Check on d8. The queen can block, but then you take it and mate.",
        fen: "6k1/4qppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
        moves: ["d1d8", "e7e8", "d8e8"],
        hint: "The d-file is open, all the way to the back rank.",
        mateEnds: true,
      },
      {
        kind: "choice",
        pose: "thinking",
        title: "Where do you start?",
        body: "Every time you calculate a position, look first at…",
        fen: EMPTY,
        options: [{ label: "Checks, then captures, then threats", correct: true }, { label: "The longest pawn moves only" }, { label: "Random legal moves" }],
        hint: "Forcing moves shrink the list you have to see.",
      },
    ],
  },
};
