import { copy } from "./copy";
import { dayKey, daysBetween, visibleStreak, type LocalState } from "./progress";

/** What a reminder at `date` should be about, assuming the learner doesn't play before then. */
export type ReminderMood =
  | { kind: "daily" }
  | { kind: "goal" }
  | { kind: "streak"; streak: number }
  | { kind: "away"; days: number }
  | { kind: "last" };

/** `last`: the final reminder of the plan, after which we stay quiet until the app is opened again. */
export function reminderMood(state: LocalState, date: Date, last = false): ReminderMood {
  const { streak } = state.progress;
  const day = dayKey(date);
  if (streak.lastDay === day) return { kind: "goal" };
  const alive = visibleStreak(streak, day);
  if (alive) return { kind: "streak", streak: alive };
  const away = streak.lastDay ? daysBetween(streak.lastDay, day) - 1 : 0;
  if (away >= 1 && last) return { kind: "last" };
  return away >= 1 ? { kind: "away", days: away } : { kind: "daily" };
}

/** Title and body for a reminder; `seed` rotates through the lines so back-to-back days differ. */
export function reminderText(mood: ReminderMood, name: string, seed: number): { title: string; body: string } {
  const r = copy.reminders;
  const lines =
    mood.kind === "streak" ? r.streak(mood.streak) : mood.kind === "away" ? r.away(mood.days) : mood.kind === "goal" ? r.goal : mood.kind === "last" ? r.last : r.daily(name.trim());
  const [title, body] = lines[Math.abs(seed) % lines.length];
  return { title, body };
}
