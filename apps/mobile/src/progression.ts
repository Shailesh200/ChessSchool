import { checkLessonAchievements, checkMatchAchievements } from "@chess-school/core";

// Pure progression reducers — ported 1:1 from web (core/store/progression.store.ts)
// so the app computes XP/streak/mastery/mistakes/ELO/achievements identically.
// They operate on the `/api/progress` snapshot (minus the `user` field).

type LessonRec = { mastery: number; attempts: number; lastSeen: number; dueAt: number; incorrect?: number };
export type Mistake = { fen: string; played: string; best: string; tag: string; at: number };
export type Snap = {
  xp?: number;
  streak?: number;
  lastActiveDay?: string | null;
  rating?: number;
  botWins?: number;
  graduatedClasses?: string[];
  unlockedAchievements?: string[];
  weaknesses?: Record<string, number>;
  activityDays?: Record<string, number>;
  mistakeLog?: Mistake[];
  lessons?: Record<string, LessonRec>;
  [k: string]: unknown;
};

export const isoDay = (d = new Date()): string => d.toISOString().slice(0, 10);
const addDays = (iso: string, delta: number): string => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
export const todayXpOf = (s: Snap): number => (s.activityDays ?? {})[isoDay()] ?? 0;

export function awardXp(s: Snap, amount: number): Snap {
  const today = isoDay();
  return { ...s, xp: (s.xp ?? 0) + amount, activityDays: { ...(s.activityDays ?? {}), [today]: ((s.activityDays ?? {})[today] ?? 0) + amount } };
}
export function recordLesson(s: Snap, id: string, correct: number, total: number, incorrect = 0): Snap {
  const prev = (s.lessons ?? {})[id];
  const score = total > 0 ? correct / total : 0;
  const mastery = prev ? prev.mastery * 0.5 + score * 0.5 : score;
  const days = mastery > 0.9 ? 14 : mastery > 0.7 ? 5 : mastery > 0.4 ? 2 : 1;
  const bestIncorrect = prev?.incorrect === undefined ? incorrect : Math.min(prev.incorrect, incorrect);
  return { ...s, lessons: { ...(s.lessons ?? {}), [id]: { mastery, attempts: (prev?.attempts ?? 0) + 1, lastSeen: Date.now(), dueAt: Date.now() + days * 86400000, incorrect: bestIncorrect } } };
}
export function registerActivity(s: Snap, today = isoDay()): Snap {
  if (s.lastActiveDay === today) return s;
  const streak = s.lastActiveDay === addDays(today, -1) ? (s.streak ?? 0) + 1 : 1;
  return { ...s, streak, lastActiveDay: today };
}
export function logMistake(s: Snap, m: Mistake): Snap {
  return { ...s, mistakeLog: [m, ...(s.mistakeLog ?? [])].slice(0, 30) };
}
export function recordWeakness(s: Snap, tag?: string): Snap {
  if (!tag) return s;
  return { ...s, weaknesses: { ...(s.weaknesses ?? {}), [tag]: ((s.weaknesses ?? {})[tag] ?? 0) + 1 } };
}
export function updateRating(s: Snap, botElo: number, score: number): Snap {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (botElo - (s.rating ?? 800)) / 400));
  const rating = Math.max(100, Math.round((s.rating ?? 800) + K * (score - expected)));
  return { ...s, rating, botWins: (s.botWins ?? 0) + (score === 1 ? 1 : 0) };
}
function unlock(s: Snap, ids: string[]): Snap {
  const cur = new Set(s.unlockedAchievements ?? []);
  let changed = false;
  for (const id of ids) if (!cur.has(id)) { cur.add(id); changed = true; }
  return changed ? { ...s, unlockedAchievements: [...cur] } : s;
}

/** Lesson complete → mastery + XP + streak + achievements + logged mistakes. */
export function applyLessonComplete(s: Snap, a: { lessonId: string; correct: number; total: number; mistakes: number; xp: number; logs?: Mistake[] }): Snap {
  let n = recordLesson(s, a.lessonId, a.correct, a.total, a.mistakes);
  n = awardXp(n, a.xp);
  n = registerActivity(n);
  for (const m of a.logs ?? []) { n = logMistake(n, m); n = recordWeakness(n, m.tag); }
  const mastered = Object.values(n.lessons ?? {}).filter((l) => l.mastery >= 0.9).length;
  const perfect = a.mistakes === 0 && a.total > 0;
  n = unlock(n, checkLessonAchievements(a.lessonId, { mastered, perfect, xp: n.xp, streak: n.streak }));
  return n;
}

/** Bot match end → ELO + XP (on win) + streak + achievements. */
export function applyMatchEnd(s: Snap, a: { botElo: number; result: "win" | "loss" | "draw" }): Snap {
  const score = a.result === "win" ? 1 : a.result === "draw" ? 0.5 : 0;
  let n = updateRating(s, a.botElo, score);
  if (a.result === "win") n = awardXp(n, 40);
  n = registerActivity(n);
  n = unlock(n, checkMatchAchievements({ won: a.result === "win", wins: n.botWins ?? 0, botElo: a.botElo, rating: n.rating ?? 800 }));
  return n;
}
