"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface LessonRecord {
  /** 0..1 mastery from spaced-repetition style scoring */
  mastery: number;
  attempts: number;
  lastSeen: number; // epoch ms
  /** next review due date (epoch ms) for spaced repetition */
  dueAt: number;
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

  awardXp: (amount: number) => void;
  setDailyGoalXp: (xp: number) => void;
  recordLesson: (id: string, correct: number, total: number) => void;
  recordWeakness: (tag: string) => void;
  unlockAchievement: (id: string) => boolean;
  registerActivity: (today: string) => void;
  graduateClass: (classId: string) => void;
  /** merge a server snapshot into local state (taking the better of each) */
  mergeSnapshot: (snap: ProgressSnapshot) => void;
}

/** The account-syncable slice of progression (server <-> client). */
export interface ProgressSnapshot {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  graduatedClasses: string[];
  lessons: Record<string, LessonRecord>;
}

export function progressSnapshot(s: ProgressionState): ProgressSnapshot {
  return {
    xp: s.xp,
    streak: s.streak,
    lastActiveDay: s.lastActiveDay,
    graduatedClasses: s.graduatedClasses,
    lessons: s.lessons,
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
};

export const useProgression = create<ProgressionState>()(
  persist(
    (set, get) => ({
      ...defaults,

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

      recordLesson: (id, correct, total) =>
        set((s) => {
          const prev = s.lessons[id];
          const score = total > 0 ? correct / total : 0;
          const mastery = prev ? prev.mastery * 0.5 + score * 0.5 : score;
          const days = mastery > 0.9 ? 14 : mastery > 0.7 ? 5 : mastery > 0.4 ? 2 : 1;
          return {
            lessons: {
              ...s.lessons,
              [id]: {
                mastery,
                attempts: (prev?.attempts ?? 0) + 1,
                lastSeen: Date.now(),
                dueAt: Date.now() + days * 24 * 3600 * 1000,
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
      mergeSnapshot: (snap) =>
        set((s) => {
          const lessons = { ...s.lessons };
          for (const [id, r] of Object.entries(snap.lessons)) {
            const cur = lessons[id];
            lessons[id] =
              !cur || r.mastery >= cur.mastery
                ? { ...r, attempts: Math.max(cur?.attempts ?? 0, r.attempts) }
                : { ...cur, attempts: Math.max(cur.attempts, r.attempts) };
          }
          return {
            xp: Math.max(s.xp, snap.xp),
            streak: Math.max(s.streak, snap.streak),
            lastActiveDay: s.lastActiveDay ?? snap.lastActiveDay,
            graduatedClasses: Array.from(new Set([...s.graduatedClasses, ...snap.graduatedClasses])),
            lessons,
          };
        }),
    }),
    {
      name: "duochess.progression",
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
