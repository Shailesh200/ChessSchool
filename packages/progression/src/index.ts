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
  schoolExamsPassed?: string[];
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
export function graduateClass(s: Snap, classId: string): Snap {
  const graduated = new Set((s.graduatedClasses as string[] | undefined) ?? []);
  if (graduated.has(classId)) return s;
  graduated.add(classId);
  return { ...s, graduatedClasses: [...graduated] };
}
export function passSchoolExam(s: Snap, stage: string): Snap {
  const passed = new Set((s.schoolExamsPassed as string[] | undefined) ?? []);
  if (passed.has(stage)) return s;
  passed.add(stage);
  return { ...s, schoolExamsPassed: [...passed] };
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

/** Class graduation: mark all class lessons mastered, then graduate the class. */
export function applyClassGraduation(s: Snap, a: { classId: string; lessonIds: string[] }): Snap {
  let n = s;
  for (const id of a.lessonIds) n = recordLesson(n, id, 1, 1, 0);
  return graduateClass(n, a.classId);
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

export * from "./gameHistory";
export * from "./spacedRep";
export * from "./formatCoach";
export * from "./boardGrid";
export * from "./preschool";

/** Enrolled users with low XP see the placement CTA; guests never do. */
export const PLACEMENT_XP_CAP = 200;

export function needsPlacementTest(snap: { placementDone?: boolean; xp?: number }): boolean {
  if (snap.placementDone) return false;
  return (snap.xp ?? 0) < PLACEMENT_XP_CAP;
}

/** True when the account (or local guest) snapshot has no meaningful progress yet. */
export function accountProgressEmpty(snap: Snap & { placementDone?: boolean }): boolean {
  return (
    (snap.xp ?? 0) === 0 &&
    Object.keys(snap.lessons ?? {}).length === 0 &&
    (snap.graduatedClasses ?? []).length === 0 &&
    !snap.placementDone &&
    (snap.schoolExamsPassed ?? []).length === 0
  );
}

export function localProgressPresent(snap: Snap & { placementDone?: boolean }): boolean {
  return !accountProgressEmpty(snap);
}

/** Guest → new account: carry the better of local and server fields. */
type MergeSnap = Snap & { placementDone?: boolean };

/** Shape expected by POST /api/progress — fills defaults so partial client snapshots validate. */
export function normalizeProgressPush(snap: Snap & { placementDone?: boolean }): MergeSnap {
  const lessons = (snap.lessons ?? {}) as Record<string, LessonRec>;
  return {
    xp: Math.max(0, Math.floor(Number(snap.xp ?? 0))),
    streak: Math.max(0, Math.floor(Number(snap.streak ?? 0))),
    lastActiveDay: typeof snap.lastActiveDay === "string" ? snap.lastActiveDay : null,
    graduatedClasses: Array.isArray(snap.graduatedClasses) ? snap.graduatedClasses : [],
    lessons,
    rating: Number(snap.rating ?? 800),
    botWins: Math.max(0, Math.floor(Number(snap.botWins ?? 0))),
    dailyGoalXp: Math.max(1, Math.floor(Number(snap.dailyGoalXp ?? 50))),
    unlockedAchievements: Array.isArray(snap.unlockedAchievements) ? snap.unlockedAchievements : [],
    schoolExamsPassed: Array.isArray(snap.schoolExamsPassed) ? snap.schoolExamsPassed : [],
    weaknesses: (snap.weaknesses ?? {}) as Record<string, number>,
    activityDays: (snap.activityDays ?? {}) as Record<string, number>,
    mistakeLog: Array.isArray(snap.mistakeLog) ? snap.mistakeLog : [],
    homeworkStreak: Math.max(0, Math.floor(Number(snap.homeworkStreak ?? 0))),
    homeworkLastDay: typeof snap.homeworkLastDay === "string" ? snap.homeworkLastDay : null,
    recentGames: Array.isArray(snap.recentGames) ? snap.recentGames : [],
    dailyPuzzleDay: typeof snap.dailyPuzzleDay === "string" ? snap.dailyPuzzleDay : null,
    homeworkDone: (snap.homeworkDone ?? {}) as Record<string, string[]>,
    placementDone: Boolean(snap.placementDone),
    journalEntries: Array.isArray(snap.journalEntries) ? snap.journalEntries : [],
    settings: snap.settings as Record<string, unknown> | undefined,
  };
}

export function mergeProgressSnapshots(local: MergeSnap, server: MergeSnap): MergeSnap {
  const lessons = { ...(local.lessons ?? {}) };
  for (const [id, r] of Object.entries(server.lessons ?? {})) {
    const cur = lessons[id];
    lessons[id] =
      !cur || r.mastery >= cur.mastery
        ? { ...r, attempts: Math.max(cur?.attempts ?? 0, r.attempts) }
        : { ...cur, attempts: Math.max(cur.attempts, r.attempts) };
  }
  const mergeMap = (a: Record<string, number>, b: Record<string, number> = {}) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const mistakes = [...(server.mistakeLog ?? []), ...(local.mistakeLog ?? [])];
  const seen = new Set<string>();
  const mistakeLog = mistakes
    .filter((m) => {
      const key = `${m.fen}|${m.at}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .slice(0, 30);
  return {
    xp: Math.max(local.xp ?? 0, server.xp ?? 0),
    streak: Math.max(local.streak ?? 0, server.streak ?? 0),
    lastActiveDay: local.lastActiveDay ?? server.lastActiveDay ?? null,
    graduatedClasses: Array.from(new Set([...(local.graduatedClasses ?? []), ...(server.graduatedClasses ?? [])])),
    lessons,
    rating: Math.max(local.rating ?? 800, server.rating ?? 800),
    botWins: Math.max(local.botWins ?? 0, server.botWins ?? 0),
    dailyGoalXp: Math.max(Number(local.dailyGoalXp ?? 50), Number(server.dailyGoalXp ?? 50)),
    unlockedAchievements: Array.from(
      new Set([...(local.unlockedAchievements ?? []), ...(server.unlockedAchievements ?? [])]),
    ),
    schoolExamsPassed: Array.from(new Set([...(local.schoolExamsPassed ?? []), ...(server.schoolExamsPassed ?? [])])),
    weaknesses: mergeMap(local.weaknesses ?? {}, server.weaknesses ?? {}),
    activityDays: mergeMap(local.activityDays ?? {}, server.activityDays ?? {}),
    mistakeLog,
    dailyPuzzleDay: server.dailyPuzzleDay ?? local.dailyPuzzleDay ?? null,
    placementDone: Boolean(local.placementDone || server.placementDone),
  };
}
