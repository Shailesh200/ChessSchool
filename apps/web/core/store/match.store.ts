"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EndReason } from "@/core/db/db";
import type { Color } from "@/core/types/chess";

export type MatchMode = "bot" | "pass" | "shadow";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface ShadowMeta {
  sourceGameId: string;
  shadowPgn: string;
  playerColor: Color;
  opponentName: string;
  flipped?: boolean;
}

export interface MatchStartOpts {
  fromHomework?: boolean;
  thinkingMode?: boolean;
  shadow?: ShadowMeta;
}

/** Persisted game-over UI — survives tab switches and refresh. */
export interface MatchEndSnapshot {
  text: string;
  win: boolean;
  ratingDelta: number;
  newRating: number;
  reason: EndReason;
  mateReviewPending: boolean;
}

export interface ActiveMatch {
  id: string;
  mode: MatchMode;
  pgn: string;
  fen: string;
  targetElo: number;
  createdAt: number;
  lastFrom: string | null;
  lastTo: string | null;
  finished: boolean;
  timeControlMin: number;
  whiteMs: number;
  blackMs: number;
  thinkingMode?: boolean;
  shadow?: ShadowMeta;
  fromHomework?: boolean;
  endSnapshot: MatchEndSnapshot | null;
}

interface MatchStore {
  active: ActiveMatch | null;
  start: (
    mode: MatchMode,
    targetElo: number,
    timeControlMin: number,
    opts?: MatchStartOpts,
  ) => void;
  sync: (patch: { fen: string; pgn: string; from?: string; to?: string }) => void;
  setClocks: (whiteMs: number, blackMs: number) => void;
  markFinished: () => void;
  setEndSnapshot: (snapshot: MatchEndSnapshot) => void;
  dismissMateReview: () => void;
  clear: () => void;
}

export const useMatch = create<MatchStore>()(
  persist(
    (set) => ({
      active: null,
      start: (mode, targetElo, timeControlMin, opts) =>
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
            thinkingMode: opts?.thinkingMode ?? false,
            shadow: opts?.shadow,
            fromHomework: opts?.fromHomework ?? false,
            endSnapshot: null,
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
      setEndSnapshot: (snapshot) =>
        set((s) =>
          s.active
            ? { active: { ...s.active, finished: true, endSnapshot: snapshot } }
            : s,
        ),
      dismissMateReview: () =>
        set((s) =>
          s.active?.endSnapshot
            ? {
                active: {
                  ...s.active,
                  endSnapshot: {
                    ...s.active.endSnapshot,
                    mateReviewPending: false,
                  },
                },
              }
            : s,
        ),
      clear: () => set({ active: null }),
    }),
    {
      name: "chessschool.activematch",
      storage: createJSONStorage(() => localStorage),
      version: 5,
      skipHydration: true,
      migrate: (persisted) => {
        const s = persisted as { active?: ActiveMatch | null };
        if (s?.active && s.active.timeControlMin === undefined) {
          s.active.timeControlMin = 0;
          s.active.whiteMs = 0;
          s.active.blackMs = 0;
        }
        if (s?.active && s.active.endSnapshot === undefined) {
          s.active.endSnapshot = null;
        }
        if (s?.active && s.active.thinkingMode === undefined) {
          s.active.thinkingMode = false;
        }
        return s as { active: ActiveMatch | null };
      },
    },
  ),
);
