/** Programmatic matrix (keep in sync with matrix.yaml). */
export const MATRIX = {
  stages: {
    novice: { rating: [300, 849], minClasses: 3 },
    elementary: { rating: [850, 1099], minClasses: 3 },
    middle: { rating: [1100, 1399], minClasses: 3 },
    high: { rating: [1400, 1749], minClasses: 3 },
    university: { rating: [1750, 2149], minClasses: 3 },
    master: { rating: [2150, 2499], minClasses: 3 },
    expert: { rating: [2500, 4000], minClasses: 3 },
  },
  concepts: [
    { id: "opening", label: "Opening Ideas" },
    { id: "trapped", label: "Win Material" },
    { id: "fork", label: "Forks" },
    { id: "pin", label: "Pins & Skewers" },
    { id: "mate", label: "Checkmates" },
    { id: "discovered", label: "Discovered Attacks" },
    { id: "endgame", label: "Endgames" },
    { id: "sacrifice", label: "Sacrifices" },
    { id: "advantage", label: "Convert Advantage" },
    { id: "pawn", label: "Pawn Play" },
    { id: "attack", label: "King Attacks" },
  ],
  launch: {
    minPuzzleLessons: 8000,
    stretchPuzzleLessons: 32000,
    tierAAuthored: 1200,
    perBucket: 800,
    minPopularity: 90,
    minPlays: 100,
  },
};
