/** Programmatic matrix (keep in sync with matrix.yaml). */
export const MATRIX = {
  stages: {
    elementary: { rating: [0, 999], minClasses: 3 },
    middle: { rating: [1000, 1349], minClasses: 3 },
    high: { rating: [1350, 1699], minClasses: 3 },
    university: { rating: [1700, 2099], minClasses: 3 },
    master: { rating: [2100, 4000], minClasses: 3 },
  },
  concepts: [
    { id: "trapped", label: "Win Material" },
    { id: "fork", label: "Forks" },
    { id: "pin", label: "Pins & Skewers" },
    { id: "mate", label: "Checkmates" },
    { id: "discovered", label: "Discovered Attacks" },
    { id: "endgame", label: "Endgames" },
    { id: "sacrifice", label: "Sacrifices" },
    { id: "advantage", label: "Convert Advantage" },
  ],
  launch: {
    minPuzzleLessons: 8000,
    stretchPuzzleLessons: 16000,
    tierAAuthored: 1200,
  },
};
