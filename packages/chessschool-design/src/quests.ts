import type { LocalState } from "./progress";

/**
 * Daily quests: a few small goals picked from the date, so everyone gets the same ones that day.
 * Lessons, the daily puzzle and the goal come from day-stamped progress; the rest from today's
 * counters below. Finishing every quest on a day adds a quest day, which unlocks cosmetic rewards.
 * All of it lives on this device only (it never affects XP).
 */
export type Quests = { day: string | null; puzzles: number; practice: number; games: number; wins: number; days: number; lastDone: string | null };
export const emptyQuests = (): Quests => ({ day: null, puzzles: 0, practice: 0, games: 0, wins: 0, days: 0, lastDone: null });

export type QuestId = "lesson" | "puzzles" | "practice" | "daily" | "goal" | "game" | "win";
export type QuestCounter = "puzzles" | "practice" | "games" | "wins";
export const QUESTS_PER_DAY = 3;

/** `gym` quests need an account (guests cannot play games), so guests get them swapped out. */
const POOL: readonly { id: QuestId; gym?: true }[] = [{ id: "lesson" }, { id: "puzzles" }, { id: "practice" }, { id: "daily" }, { id: "goal" }, { id: "game", gym: true }, { id: "win", gym: true }];

/** Small deterministic hash of the day key (FNV-1a), then xorshift steps. */
function seed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}

/** Today's quests, in pool order. Same day + same `gym` gives the same list. */
export function pickQuests(day: string, gym: boolean): QuestId[] {
  const pool = POOL.filter((q) => gym || !q.gym).map((q) => q.id);
  const picked = new Set<QuestId>();
  let h = seed(day);
  while (picked.size < Math.min(QUESTS_PER_DAY, pool.length)) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    picked.add(pool[h % pool.length]);
  }
  return pool.filter((id) => picked.has(id));
}

export type QuestStatus = { id: QuestId; value: number; target: number; done: boolean };

export function questStatus(state: LocalState, id: QuestId, today: string): QuestStatus {
  const q = state.quests.day === today ? state.quests : emptyQuests();
  const p = state.progress;
  const lessons = Object.entries(p.completed).filter(([lesson, day]) => day === today && !p.placed.includes(lesson)).length;
  const minutes = p.minutes.day === today ? p.minutes.value : 0;
  const [value, target] =
    id === "lesson" ? [lessons, 1]
    : id === "puzzles" ? [q.puzzles, 3]
    : id === "practice" ? [q.practice, 1]
    : id === "daily" ? [p.puzzles.daily.lastDay === today ? 1 : 0, 1]
    : id === "goal" ? [minutes, state.profile.dailyMinutes]
    : id === "game" ? [q.games, 1]
    : [q.wins, 1];
  return { id, value: Math.min(value, target), target, done: value >= target };
}

export const todayQuests = (state: LocalState, today: string): QuestStatus[] => pickQuests(today, Boolean(state.account)).map((id) => questStatus(state, id, today));

/** Adds to today's counters, then counts the day once every quest is done. Call after any activity. */
export function trackQuests(state: LocalState, today: string, add: Partial<Record<QuestCounter, number>> = {}): LocalState {
  const prev = state.quests.day === today ? state.quests : { ...state.quests, day: today, puzzles: 0, practice: 0, games: 0, wins: 0 };
  const quests: Quests = { ...prev };
  for (const [k, n] of Object.entries(add) as [QuestCounter, number][]) quests[k] += n;
  const next = { ...state, quests };
  if (quests.lastDone !== today && todayQuests(next, today).every((s) => s.done)) {
    next.quests = { ...quests, days: quests.days + 1, lastDone: today };
  }
  return next;
}

/** Reads stored quests; anything malformed becomes zero. */
export function hydrateQuests(raw: unknown): Quests {
  const base = emptyQuests();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Quests>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(10_000, Math.floor(v))) : 0);
  const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  return { day: day(r.day), puzzles: n(r.puzzles), practice: n(r.practice), games: n(r.games), wins: n(r.wins), days: n(r.days), lastDone: day(r.lastDone) };
}

/* ---------- rewards ---------- */

export type RewardKind = "theme" | "pieces" | "icon";
/** Looks that start locked and open after N quest days. Accessibility looks (High contrast, Outline) are never here. */
export const QUEST_REWARDS: readonly { kind: RewardKind; id: string; days: number }[] = [
  { kind: "theme", id: "ocean", days: 1 },
  { kind: "pieces", id: "pixel", days: 3 },
  { kind: "icon", id: "pixel", days: 5 },
  { kind: "theme", id: "midnight", days: 7 },
];

/** Quest days a look needs, or null when it can be used now. Whatever is selected stays usable. */
export function lockedUntil(state: LocalState, kind: RewardKind, id: string): number | null {
  const reward = QUEST_REWARDS.find((r) => r.kind === kind && r.id === id);
  if (!reward || state.quests.days >= reward.days) return null;
  const inUse = kind === "theme" ? state.prefs.theme === id : kind === "pieces" ? state.prefs.pieceSet === id : state.prefs.appIcon === id;
  return inUse ? null : reward.days;
}

/** The next reward still to unlock, for the Quests card. */
export const nextReward = (state: LocalState) => QUEST_REWARDS.find((r) => state.quests.days < r.days) ?? null;
