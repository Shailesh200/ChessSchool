"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { mergeProgressSnapshots } from "@chess-school/progression";

export interface MistakeEntry {
  fen: string;
  played: string; // "from:to"
  best: string; // "from:to"
  tag: string;
  at: number;
}

export interface LessonRecord {
  /** 0..1 mastery from spaced-repetition style scoring */
  mastery: number;
  attempts: number;
  lastSeen: number; // epoch ms
  /** next review due date (epoch ms) for spaced repetition */
  dueAt: number;
  /** wrong moves in the best run (for report-card scoring); undefined on old data */
  incorrect?: number;
}

export interface ProgressionState {
  xp: number;
  streak: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  dailyGoalXp: number;
  todayXp: number;
  todayKey: string | null;
  unlockedAchievements: string[];
  lessons: Record<string, LessonRecord>;
  /** weakness tag -> error count, fuels personalized review */
  weaknesses: Record<string, number>;
  /** classes the student has graduated from (class ids) */
  graduatedClasses: string[];
  /** YYYY-MM-DD -> XP earned that day, for the streak heatmap */
  activityDays: Record<string, number>;
  /** the player's live ELO rating, updated after each bot game */
  rating: number;
  /** total bot wins (for achievements) */
  botWins: number;
  /** stage ids whose school exam has been passed (unlocks the next school) */
  schoolExamsPassed: string[];
  /** recent mistakes (position + played + best) for the Mistake DNA detail */
  mistakeLog: MistakeEntry[];
  /** ISO day when the daily puzzle was last completed */
  dailyPuzzleDay: string | null;
  /** sign-up placement test completed (enrolled users only) */
  placementDone: boolean;

  reset: () => void;
  logMistake: (m: MistakeEntry) => void;
  /** apply an ELO update after a bot game: score = 1 win / 0.5 draw / 0 loss */
  updateRating: (botElo: number, score: number) => void;
  passSchoolExam: (stage: string) => void;
  awardXp: (amount: number) => void;
  setDailyGoalXp: (xp: number) => void;
  recordLesson: (id: string, correct: number, total: number, incorrect?: number) => void;
  recordWeakness: (tag: string) => void;
  unlockAchievement: (id: string) => boolean;
  registerActivity: (today: string) => void;
  graduateClass: (classId: string) => void;
  markDailyPuzzleDone: () => void;
  markPlacementDone: () => void;
  /** merge a server snapshot into local state (taking the better of each) — guest→account carry-up */
  mergeSnapshot: (snap: ProgressSnapshot) => void;
  /** replace local state with the server snapshot — the account is the source of truth */
  hydrateSnapshot: (snap: ProgressSnapshot) => void;
}

/** The account-syncable slice of progression (server <-> client). */
export interface ProgressSnapshot {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  graduatedClasses: string[];
  lessons: Record<string, LessonRecord>;
  // Extended sync (everything that used to be device-local):
  rating: number;
  botWins: number;
  dailyGoalXp: number;
  unlockedAchievements: string[];
  schoolExamsPassed: string[];
  weaknesses: Record<string, number>;
  activityDays: Record<string, number>;
  mistakeLog: MistakeEntry[];
  dailyPuzzleDay: string | null;
  placementDone?: boolean;
}

export function progressSnapshot(s: ProgressionState): ProgressSnapshot {
  return {
    xp: s.xp,
    streak: s.streak,
    lastActiveDay: s.lastActiveDay,
    graduatedClasses: s.graduatedClasses,
    lessons: s.lessons,
    rating: s.rating,
    botWins: s.botWins,
    dailyGoalXp: s.dailyGoalXp,
    unlockedAchievements: s.unlockedAchievements,
    schoolExamsPassed: s.schoolExamsPassed,
    weaknesses: s.weaknesses,
    activityDays: s.activityDays,
    mistakeLog: s.mistakeLog,
    dailyPuzzleDay: s.dailyPuzzleDay,
    placementDone: s.placementDone,
  };
}

export function levelForXp(xp: number): number {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return level;
}

export function xpProgress(xp: number): { into: number; need: number } {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return { into: xp - acc, need };
}

const defaults = {
  xp: 0,
  streak: 0,
  lastActiveDay: null as string | null,
  dailyGoalXp: 50,
  todayXp: 0,
  todayKey: null as string | null,
  unlockedAchievements: [] as string[],
  lessons: {} as Record<string, LessonRecord>,
  weaknesses: {} as Record<string, number>,
  graduatedClasses: [] as string[],
  activityDays: {} as Record<string, number>,
  rating: 800,
  botWins: 0,
  schoolExamsPassed: [] as string[],
  mistakeLog: [] as MistakeEntry[],
  dailyPuzzleDay: null as string | null,
  placementDone: false,
};

export const useProgression = create<ProgressionState>()(
  persist(
    (set, get) => ({
      ...defaults,

      // Wipe all personal progress (used on logout so the next user/guest starts clean).
      reset: () => set({ ...defaults }),

      updateRating: (botElo, score) =>
        set((s) => {
          const K = 32;
          const expected = 1 / (1 + Math.pow(10, (botElo - s.rating) / 400));
          const rating = Math.max(100, Math.round(s.rating + K * (score - expected)));
          return { rating, botWins: s.botWins + (score === 1 ? 1 : 0) };
        }),

      passSchoolExam: (stage) =>
        set((s) =>
          s.schoolExamsPassed.includes(stage) ? s : { schoolExamsPassed: [...s.schoolExamsPassed, stage] },
        ),

      logMistake: (m) => set((s) => ({ mistakeLog: [m, ...s.mistakeLog].slice(0, 30) })),

      awardXp: (amount) =>
        set((s) => {
          const today = isoDay();
          const sameDay = s.todayKey === today;
          return {
            xp: s.xp + amount,
            todayXp: (sameDay ? s.todayXp : 0) + amount,
            todayKey: today,
            activityDays: { ...s.activityDays, [today]: (s.activityDays[today] ?? 0) + amount },
          };
        }),

      setDailyGoalXp: (xp) => set({ dailyGoalXp: Math.max(10, Math.round(xp)) }),

      recordLesson: (id, correct, total, incorrect = 0) =>
        set((s) => {
          const prev = s.lessons[id];
          const score = total > 0 ? correct / total : 0;
          const mastery = prev ? prev.mastery * 0.5 + score * 0.5 : score;
          const days = mastery > 0.9 ? 14 : mastery > 0.7 ? 5 : mastery > 0.4 ? 2 : 1;
          // Keep the best (fewest mistakes) run for scoring.
          const bestIncorrect = prev?.incorrect === undefined ? incorrect : Math.min(prev.incorrect, incorrect);
          return {
            lessons: {
              ...s.lessons,
              [id]: {
                mastery,
                attempts: (prev?.attempts ?? 0) + 1,
                lastSeen: Date.now(),
                dueAt: Date.now() + days * 24 * 3600 * 1000,
                incorrect: bestIncorrect,
              },
            },
          };
        }),

      recordWeakness: (tag) =>
        set((s) => ({
          weaknesses: { ...s.weaknesses, [tag]: (s.weaknesses[tag] ?? 0) + 1 },
        })),

      unlockAchievement: (id) => {
        const has = get().unlockedAchievements.includes(id);
        if (has) return false;
        set((s) => ({ unlockedAchievements: [...s.unlockedAchievements, id] }));
        return true;
      },

      registerActivity: (today) =>
        set((s) => {
          if (s.lastActiveDay === today) return s;
          const yesterday = addDays(today, -1);
          const streak = s.lastActiveDay === yesterday ? s.streak + 1 : 1;
          return { streak, lastActiveDay: today, todayKey: today, todayXp: 0 };
        }),

      graduateClass: (classId) =>
        set((s) =>
          s.graduatedClasses.includes(classId)
            ? s
            : { graduatedClasses: [...s.graduatedClasses, classId] },
        ),

      markDailyPuzzleDone: () => set({ dailyPuzzleDay: isoDay() }),

      markPlacementDone: () => set({ placementDone: true }),

      mergeSnapshot: (snap) =>
        set((s) => {
          const merged = progressSnapshot(s);
          const next = mergeProgressSnapshots(
            { ...merged, placementDone: s.placementDone },
            { ...snap, placementDone: snap.placementDone },
          );
          return { ...next, placementDone: Boolean(next.placementDone || s.placementDone || snap.placementDone) };
        }),

      // Account is the source of truth: overwrite local with the server snapshot.
      hydrateSnapshot: (snap) =>
        set(() => ({
          xp: snap.xp,
          streak: snap.streak,
          lastActiveDay: snap.lastActiveDay,
          graduatedClasses: snap.graduatedClasses ?? [],
          lessons: snap.lessons ?? {},
          rating: snap.rating ?? 800,
          botWins: snap.botWins ?? 0,
          dailyGoalXp: snap.dailyGoalXp ?? 50,
          unlockedAchievements: snap.unlockedAchievements ?? [],
          schoolExamsPassed: snap.schoolExamsPassed ?? [],
          weaknesses: snap.weaknesses ?? {},
          activityDays: snap.activityDays ?? {},
          mistakeLog: snap.mistakeLog ?? [],
          dailyPuzzleDay: snap.dailyPuzzleDay ?? null,
          placementDone: Boolean(snap.placementDone),
        })),
    }),
    {
      name: "chessschool.progression",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      skipHydration: true,
      // v1 -> v2: the heart/lives system was removed. Drop hearts fields and
      // seed the new graduatedClasses array. All XP/streak/mastery is preserved.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ProgressionState> &
          Record<string, unknown>;
        if (version < 2) {
          delete state.hearts;
          delete state.maxHearts;
          delete state.heartsUpdatedAt;
          if (!Array.isArray(state.graduatedClasses)) state.graduatedClasses = [];
        }
        return state as ProgressionState;
      },
    },
  ),
);

export function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
