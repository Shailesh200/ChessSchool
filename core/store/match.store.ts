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
  /** time control in minutes (0 = no clock) */
  timeControlMin: number;
  whiteMs: number;
  blackMs: number;
  /** launched from the homework screen — game-over returns there */
  fromHomework?: boolean;
}

interface MatchStore {
  active: ActiveMatch | null;
  start: (mode: MatchMode, targetElo: number, timeControlMin: number, fromHomework?: boolean) => void;
  sync: (patch: { fen: string; pgn: string; from?: string; to?: string }) => void;
  setClocks: (whiteMs: number, blackMs: number) => void;
  markFinished: () => void;
  clear: () => void;
}

export const useMatch = create<MatchStore>()(
  persist(
    (set) => ({
      active: null,
      start: (mode, targetElo, timeControlMin, fromHomework) =>
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
            timeControlMin,
            whiteMs: timeControlMin * 60_000,
            blackMs: timeControlMin * 60_000,
            fromHomework: fromHomework ?? false,
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
      setClocks: (whiteMs, blackMs) =>
        set((s) => (s.active ? { active: { ...s.active, whiteMs, blackMs } } : s)),
      markFinished: () =>
        set((s) => (s.active ? { active: { ...s.active, finished: true } } : s)),
      clear: () => set({ active: null }),
    }),
    {
      name: "chessschool.activematch",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      skipHydration: true,
      // v1 matches had no clock fields — default them to "no clock".
      migrate: (persisted) => {
        const s = persisted as { active?: ActiveMatch | null };
        if (s?.active && s.active.timeControlMin === undefined) {
          s.active.timeControlMin = 0;
          s.active.whiteMs = 0;
          s.active.blackMs = 0;
        }
        return s as { active: ActiveMatch | null };
      },
    },
  ),
);
