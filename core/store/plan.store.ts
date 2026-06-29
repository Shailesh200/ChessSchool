"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PlanTier = "casual" | "standard" | "serious" | "competitive" | "custom";
export type Schedule = "daily" | "weekdays" | "weekends";

export interface PlanSpec {
  tier: PlanTier;
  label: string;
  minutes: string;
  lessonsPerDay: number;
  goalXp: number;
  blurb: string;
  emoji: string;
}

export const PLAN_SPECS: Record<PlanTier, PlanSpec> = {
  casual: { tier: "casual", label: "Casual", minutes: "10–15 min", lessonsPerDay: 1, goalXp: 30, blurb: "A relaxed pace — keep the habit alive.", emoji: "🌱" },
  standard: { tier: "standard", label: "Standard", minutes: "20–30 min", lessonsPerDay: 2, goalXp: 50, blurb: "Steady, balanced improvement.", emoji: "📘" },
  serious: { tier: "serious", label: "Serious", minutes: "45–60 min", lessonsPerDay: 3, goalXp: 80, blurb: "Real, measurable progress.", emoji: "🔥" },
  competitive: { tier: "competitive", label: "Competitive", minutes: "90+ min", lessonsPerDay: 5, goalXp: 130, blurb: "Tournament-ready training load.", emoji: "🏆" },
  custom: { tier: "custom", label: "Custom", minutes: "your call", lessonsPerDay: 2, goalXp: 60, blurb: "Set your own daily target.", emoji: "⚙️" },
};

/** The shared daily routine (Warmup → Lesson → … → Reflection). */
export const ROUTINE_STEPS = [
  { id: "warmup", label: "Warmup", emoji: "🤸", href: "/playground" },
  { id: "lesson", label: "Lesson", emoji: "📖", href: "/" },
  { id: "practice", label: "Guided practice", emoji: "🎯", href: "/" },
  { id: "match", label: "Play a match", emoji: "♟️", href: "/play" },
  { id: "review", label: "Review", emoji: "🔍", href: "/review" },
  { id: "reflection", label: "Reflection", emoji: "📝", href: "/journal" },
] as const;

interface PlanState {
  tier: PlanTier;
  customGoalXp: number;
  schedule: Schedule;
  routineDay: string | null;
  routineDone: string[];
  homeworkStreak: number;
  homeworkLastDay: string | null;
  setTier: (tier: PlanTier) => void;
  setSchedule: (s: Schedule) => void;
  setCustomGoal: (xp: number) => void;
  ensureDay: (today: string) => void;
  completeStep: (id: string) => void;
  /** mark an activity done for today's homework (auto-checks the box) */
  markActivity: (id: string, today: string) => void;
  /** apply a synced homework streak (account is source of truth) */
  setHomework: (streak: number, lastDay: string | null) => void;
}

export function planGoalXp(state: { tier: PlanTier; customGoalXp: number }): number {
  return state.tier === "custom" ? state.customGoalXp : PLAN_SPECS[state.tier].goalXp;
}

function addDay(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export const usePlan = create<PlanState>()(
  persist(
    (set, get) => ({
      tier: "standard",
      customGoalXp: 60,
      schedule: "daily",
      routineDay: null,
      routineDone: [],
      homeworkStreak: 0,
      homeworkLastDay: null,
      setTier: (tier) => set({ tier }),
      setSchedule: (schedule) => set({ schedule }),
      setCustomGoal: (xp) => set({ customGoalXp: Math.max(10, Math.round(xp)) }),
      ensureDay: (today) => {
        if (get().routineDay !== today) set({ routineDay: today, routineDone: [] });
      },
      completeStep: (id) =>
        set((s) => (s.routineDone.includes(id) ? s : { routineDone: [...s.routineDone, id] })),
      markActivity: (id, today) => {
        const s = get();
        if (s.routineDay !== today) set({ routineDay: today, routineDone: [id] });
        else if (!s.routineDone.includes(id)) set({ routineDone: [...s.routineDone, id] });
        // All steps done today → bump the homework streak (once per day).
        const done = get().routineDone;
        const all = ROUTINE_STEPS.every((step) => done.includes(step.id));
        if (all && get().homeworkLastDay !== today) {
          const prev = get().homeworkLastDay;
          const yesterday = addDay(today, -1);
          set({
            homeworkStreak: prev === yesterday ? get().homeworkStreak + 1 : 1,
            homeworkLastDay: today,
          });
        }
      },
      setHomework: (streak, lastDay) =>
        set((s) => ({
          homeworkStreak: Math.max(s.homeworkStreak, streak),
          homeworkLastDay: lastDay ?? s.homeworkLastDay,
        })),
    }),
    {
      name: "chessschool.plan",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
    },
  ),
);
