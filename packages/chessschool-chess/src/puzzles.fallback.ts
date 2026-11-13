import type { PuzzlePack } from "./puzzles";

/** Original stub positions so the app can run before the API pack is seeded. */
export const FALLBACK_PACK: PuzzlePack = {
  version: "fallback-10",
  puzzles: [
    { id: "stub01", fen: "7k/6pp/8/8/8/n7/Q7/6RK b - - 0 1", moves: ["a3b1", "a2a8"], rating: 900, themes: ["mateIn1", "backRankMate"] },
    { id: "stub02", fen: "r3k3/8/8/1N6/8/p7/8/4K3 b - - 0 1", moves: ["a3a2", "b5c7"], rating: 920, themes: ["fork"] },
    { id: "stub03", fen: "r3k3/8/8/3N4/8/p7/8/4K3 b - - 0 1", moves: ["a3a2", "d5c7"], rating: 1000, themes: ["fork"] },
    { id: "stub04", fen: "r3k3/8/8/8/2N5/p7/8/4K3 b - - 0 1", moves: ["a3a2", "c4d6"], rating: 1080, themes: ["fork"] },
    { id: "stub05", fen: "4k3/8/2b5/8/8/8/4R3/4K3 b - - 0 1", moves: ["c6e4", "e2e4"], rating: 880, themes: ["pin"] },
    { id: "stub06", fen: "6k1/5ppp/8/8/8/8/6Q1/6RK b - - 0 1", moves: ["h7h6", "g2g7"], rating: 860, themes: ["mateIn1"] },
    { id: "stub07", fen: "4k3/8/8/8/8/8/p7/6QK b - - 0 1", moves: ["a2a1q", "g1a1"], rating: 940, themes: ["promotion"] },
    { id: "stub08", fen: "4k3/8/8/8/4p3/8/3P4/4K3 b - - 0 1", moves: ["e4e3", "d2e3"], rating: 990, themes: ["hangingPiece"] },
    { id: "stub09", fen: "r3k3/8/8/8/8/8/8/3Q3K b - - 0 1", moves: ["a8a4", "d1a4"], rating: 1050, themes: ["skewer"] },
    { id: "stub10", fen: "6k1/5ppp/8/8/8/8/5PPP/4R2K b - - 0 1", moves: ["h7h6", "e1e8"], rating: 840, themes: ["endgame"] },
  ],
};
