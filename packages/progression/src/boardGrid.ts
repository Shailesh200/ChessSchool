/** Chess grid helpers — files (columns a–h) and ranks (rows 1–8). */
export const CHESS_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export type ChessFile = (typeof CHESS_FILES)[number];

export function parseSquare(sq: string): { file: ChessFile; rank: number } {
  return { file: sq[0] as ChessFile, rank: Number(sq[1]) };
}

export function squaresOfFile(file: string): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${file}${r}`);
}

export function squaresOfRank(rank: number): string[] {
  return CHESS_FILES.map((f) => `${f}${rank}`);
}

type GridInput = {
  highlight?: string[];
  highlightFiles?: string[];
  highlightRanks?: number[];
  moves?: string[];
  solution?: string[];
  arrows?: { startSquare: string; endSquare: string }[];
  visualSquare?: string;
  visualSquares?: string[];
};

/** Merge explicit file/rank overlays with squares from moves, arrows, and highlights. */
export function deriveGridHighlights(step: GridInput | undefined): {
  highlight: string[];
  highlightFiles: string[];
  highlightRanks: number[];
} {
  if (!step) return { highlight: [], highlightFiles: [], highlightRanks: [] };

  const files = new Set<string>(step.highlightFiles ?? []);
  const ranks = new Set<number>(step.highlightRanks ?? []);
  const squares = new Set<string>(step.highlight ?? []);

  const addSquare = (sq: string | undefined) => {
    if (!sq || sq.length < 2) return;
    squares.add(sq);
    const { file, rank } = parseSquare(sq);
    if (CHESS_FILES.includes(file as ChessFile)) files.add(file);
    if (rank >= 1 && rank <= 8) ranks.add(rank);
  };

  for (const sq of step.visualSquares ?? []) addSquare(sq);
  addSquare(step.visualSquare);
  for (const sq of step.highlight ?? []) addSquare(sq);
  for (const m of step.moves ?? []) m.split(":").forEach(addSquare);
  for (const s of step.solution ?? []) s.split(":").forEach(addSquare);
  for (const a of step.arrows ?? []) {
    addSquare(a.startSquare);
    addSquare(a.endSquare);
  }

  return {
    highlight: [...squares],
    highlightFiles: [...files],
    highlightRanks: [...ranks].sort((a, b) => a - b),
  };
}
