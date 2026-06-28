"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MatchMode = "bot" | "pass";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface ActiveMatch {
  id: string;
  mode: MatchMode;
  /** full PGN — source of truth for restore + replay */
  pgn: string;
  fen: string;
  targetElo: number;
  createdAt: number;
  lastFrom: string | null;
  lastTo: string | null;
  /** set once the game ends; until then the match is "in progress" */
  finished: boolean;
}

interface MatchStore {
  active: ActiveMatch | null;
  start: (mode: MatchMode, targetElo: number) => void;
  sync: (patch: { fen: string; pgn: string; from?: string; to?: string }) => void;
  markFinished: () => void;
  clear: () => void;
}

export const useMatch = create<MatchStore>()(
  persist(
    (set) => ({
      active: null,
      start: (mode, targetElo) =>
        set({
          active: {
            id: `g${Date.now()}`,
            mode,
            pgn: "",
            fen: START_FEN,
            targetElo,
            createdAt: Date.now(),
            lastFrom: null,
            lastTo: null,
            finished: false,
          },
        }),
      sync: (patch) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  fen: patch.fen,
                  pgn: patch.pgn,
                  lastFrom: patch.from ?? s.active.lastFrom,
                  lastTo: patch.to ?? s.active.lastTo,
                },
              }
            : s,
        ),
      markFinished: () =>
        set((s) => (s.active ? { active: { ...s.active, finished: true } } : s)),
      clear: () => set({ active: null }),
    }),
    {
      name: "chessschool.activematch",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
    },
  ),
);
