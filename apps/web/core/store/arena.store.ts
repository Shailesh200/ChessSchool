"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  arenaXpBonus,
  createArenaRun,
  isArenaComplete,
  nextArenaOpponent,
  playerArenaPlacement,
  type ArenaBot,
  type ArenaRun,
  type ArenaRunRecord,
} from "@/features/play/arena";
import { useProgression } from "@/core/store/progression.store";

export type { ArenaRunRecord };

interface ArenaStore {
  active: ArenaRun | null;
  start: (bandElo: number) => void;
  recordResult: (opponentId: string, playerScore: number, gameId: string) => void;
  nextOpponent: () => ArenaBot | null;
  completeIfDone: () => ArenaRunRecord | null;
  abandon: () => void;
}

export const useArena = create<ArenaStore>()(
  persist(
    (set, get) => ({
      active: null,
      start: (bandElo) => set({ active: createArenaRun(bandElo) }),
      recordResult: (opponentId, playerScore, gameId) =>
        set((s) => {
          if (!s.active) return s;
          if (s.active.results.some((r) => r.opponentId === opponentId)) return s;
          return {
            active: {
              ...s.active,
              results: [
                ...s.active.results,
                { opponentId, playerScore, gameId, at: Date.now() },
              ],
            },
          };
        }),
      nextOpponent: () => {
        const run = get().active;
        return run ? nextArenaOpponent(run) : null;
      },
      completeIfDone: () => {
        const run = get().active;
        if (!run || !isArenaComplete(run) || run.completedAt) return null;
        const xp = arenaXpBonus(run);
        const record: ArenaRunRecord = {
          id: run.id,
          bandElo: run.bandElo,
          playerPoints: run.results.reduce((s, r) => s + r.playerScore, 0),
          placement: playerArenaPlacement(run),
          xpEarned: xp,
          completedAt: Date.now(),
        };
        useProgression.getState().completeArenaRun(record);
        useProgression.getState().awardXp(xp);
        set({
          active: {
            ...run,
            completedAt: record.completedAt,
            xpAwarded: xp,
          },
        });
        return record;
      },
      abandon: () => set({ active: null }),
    }),
    {
      name: "chessschool.arena",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
    },
  ),
);
