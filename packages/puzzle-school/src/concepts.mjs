/** School concept taxonomy — shared by bank, import, and stats. */

export const STAGE_BANDS = [
  { id: "novice", title: "Novice", order: 0, min: 300, max: 849 },
  { id: "elementary", title: "Elementary", order: 1, min: 850, max: 1099 },
  { id: "middle", title: "Middle School", order: 2, min: 1100, max: 1399 },
  { id: "high", title: "High School", order: 3, min: 1400, max: 1749 },
  { id: "university", title: "University", order: 4, min: 1750, max: 2149 },
  { id: "master", title: "Masters", order: 5, min: 2150, max: 2499 },
  { id: "expert", title: "Expert", order: 6, min: 2500, max: 4000 },
];

/** @param {number} rating */
export function stageForRating(rating) {
  return (
    STAGE_BANDS.find((s) => rating >= s.min && rating <= s.max) ?? STAGE_BANDS[0]
  );
}

export const CONCEPT_GROUPS = [
  {
    id: "opening",
    label: "Opening Ideas",
    emoji: "🚪",
    color: "#0d9488",
    themes: ["opening", "openingTrap"],
  },
  {
    id: "mate",
    label: "Checkmates",
    emoji: "♚",
    color: "#dc2626",
    themes: [
      "mateIn1",
      "mateIn2",
      "mateIn3",
      "mateIn4",
      "mateIn5",
      "backRankMate",
      "smotheredMate",
      "mate",
      "hookMate",
      "anastasiaMate",
      "arabianMate",
      "bodenMate",
    ],
  },
  { id: "fork", label: "Forks", emoji: "🍴", color: "#ea580c", themes: ["fork"] },
  {
    id: "pin",
    label: "Pins & Skewers",
    emoji: "📌",
    color: "#d97706",
    themes: ["pin", "skewer"],
  },
  {
    id: "discovered",
    label: "Discovered Attacks",
    emoji: "🎯",
    color: "#7c3aed",
    themes: ["discoveredAttack", "doubleCheck"],
  },
  {
    id: "sacrifice",
    label: "Sacrifices & Combinations",
    emoji: "🔥",
    color: "#db2777",
    themes: [
      "sacrifice",
      "attraction",
      "deflection",
      "clearance",
      "interference",
      "decoy",
    ],
  },
  {
    id: "trapped",
    label: "Win Material",
    emoji: "💰",
    color: "#16a34a",
    themes: ["hangingPiece", "capturingDefender", "trappedPiece", "win"],
  },
  {
    id: "endgame",
    label: "Endgames",
    emoji: "♔",
    color: "#0891b2",
    themes: [
      "endgame",
      "rookEndgame",
      "pawnEndgame",
      "queenEndgame",
      "bishopEndgame",
      "knightEndgame",
      "queenRookEndgame",
      "zugzwang",
      "promotion",
      "advancedPawn",
    ],
  },
  {
    id: "advantage",
    label: "Convert the Advantage",
    emoji: "📈",
    color: "#2563eb",
    themes: ["advantage", "crushing", "defensiveMove", "quietMove", "intermezzo"],
  },
  {
    id: "pawn",
    label: "Pawn Play",
    emoji: "♟️",
    color: "#78716c",
    themes: ["pawnStructure", "underPromotion", "advancedPawn"],
  },
  {
    id: "attack",
    label: "King Attacks",
    emoji: "⚔️",
    color: "#be123c",
    themes: [
      "kingsideAttack",
      "queensideAttack",
      "exposedKing",
      "attackingF2F7",
    ],
  },
];

/** @param {string[]} themes */
export function conceptForThemes(themes) {
  return CONCEPT_GROUPS.find((g) => g.themes.some((t) => themes.includes(t))) ?? null;
}

export const CONCEPT_TUTORIALS = {
  opening:
    "Opening puzzles reward development, quick castling, and punishing traps. Look at undefended pieces and whether a natural-looking move walks into a tactic.",
  mate: "A checkmate attacks the king so it has no legal escape. Look for forcing checks first, and watch how the enemy king's escape squares are cut off.",
  fork: "A fork is one piece attacking two targets at once. Knights are the classic forkers — aim at the king plus a queen or rook so your opponent can only save one.",
  pin: "A pin freezes a piece in front of a more valuable one. A skewer is the reverse — hit the valuable piece so it must move and you win what's behind it.",
  discovered:
    "A discovered attack moves one piece to unveil an attack from another. A discovered check is brutal: you check the king and grab material on the same move.",
  sacrifice:
    "A sacrifice gives up material for a bigger gain — a mating attack or a winning combination. Calculate the forcing line to the very end before you commit.",
  trapped:
    "Winning material starts with spotting undefended or overloaded pieces. Capture defenders, trap pieces with no squares, and never leave a piece hanging.",
  endgame:
    "Endgames are about precision: activate your king, push passed pawns, and use opposition and zugzwang. Small edges convert into wins with accurate technique.",
  advantage:
    "When you're ahead, convert cleanly: trade pieces (not pawns), improve your worst piece, and avoid counterplay. Quiet, accurate moves win won positions.",
  pawn:
    "Pawn puzzles train structure and timing: passed pawns, fixing weaknesses, and promotions. Count who can promote first before you push.",
  attack:
    "Attacking the king means opening lines and removing defenders. Look for checks, sacrifices on f7 or g7, and whether the king has nowhere to run.",
};

const TUTORIAL_FRAMES = {
  novice: "First tactics steps — ",
  elementary: "Welcome to tactics class! ",
  middle: "Middle School tactics — ",
  high: "High School study hall — ",
  university: "University seminar — ",
  master: "Masters cohort — ",
  expert: "Expert board — ",
};

/** Stage-framed tutorial copy for puzzle-semester classes. */
export function tutorialCoach(conceptId, stageId) {
  const body = CONCEPT_TUTORIALS[conceptId] ?? CONCEPT_TUTORIALS.trapped;
  const frame = TUTORIAL_FRAMES[stageId] ?? "Today's lesson: ";
  return `${frame}${body}`;
}

/** @param {string} conceptId */
export function conceptGroup(conceptId) {
  return CONCEPT_GROUPS.find((g) => g.id === conceptId) ?? null;
}
