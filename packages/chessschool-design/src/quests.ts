import type { LocalState } from "./progress";

/**
 * Daily quests: three small goals a day from a pool of QUEST_POOL templates, picked from the day and
 * the learner so no quest repeats within 7 days. Lessons, the daily puzzle and the goal come from
 * day-stamped progress; the rest from today's counters below. Finishing every quest on a day adds a
 * quest day, which unlocks cosmetic rewards. A monthly challenge earns a badge.
 * All of it lives on this device only (it never affects XP).
 */
export type Quests = {
  day: string | null;
  puzzles: number;
  practice: number;
  games: number;
  wins: number;
  days: number;
  lastDone: string | null;
  /** Today's other counters (see QuestCounter). */
  counts: Partial<Record<QuestCounter, number>>;
  /** The month ("YYYY-MM") `monthly` counts. */
  month: string | null;
  monthly: Partial<Record<MonthlyCounter, number>>;
  /** Months whose challenge was finished ("YYYY-MM"). */
  badges: string[];
};
export const emptyQuests = (): Quests => ({ day: null, puzzles: 0, practice: 0, games: 0, wins: 0, days: 0, lastDone: null, counts: {}, month: null, monthly: {}, badges: [] });

/** Counters kept at the top level since the first quests. */
type LegacyCounter = "puzzles" | "practice" | "games" | "wins";
const LEGACY: readonly LegacyCounter[] = ["puzzles", "practice", "games", "wins"];
/** What app events add to. `combo` and `sprint` keep today's best instead of a sum. */
export const QUEST_COUNTERS = [
  ...LEGACY,
  "lessons", "early", "perfect", "combo", "mate", "sprint", "reviews", "cards", "winBlack", "cleanWin", "endgame", "reviewed", "vision", "visionSec",
  "t_fork", "t_pin", "t_skewer", "t_mateIn1", "t_mateIn2", "t_discoveredAttack", "t_backRankMate", "t_hangingPiece", "t_endgame", "t_promotion",
] as const;
export type QuestCounter = (typeof QUEST_COUNTERS)[number];
const BEST: ReadonlySet<QuestCounter> = new Set(["combo", "sprint"]);

/** How a template is measured: a counter, or one of the progress-based values. */
type Measure = QuestCounter | "lessonFirst" | "daily" | "goal" | "minutes" | "visionMin";
/** `gym` quests need an account (guests cannot play games), so guests never get them. */
const TEMPLATES = {
  lesson: { m: "lessonFirst", n: 1 },
  lessons2: { m: "lessons", n: 2 },
  lessons3: { m: "lessons", n: 3 },
  early: { m: "early", n: 1 },
  perfect: { m: "perfect", n: 1 },
  perfect2: { m: "perfect", n: 2 },
  combo3: { m: "combo", n: 3 },
  combo5: { m: "combo", n: 5 },
  puzzles: { m: "puzzles", n: 3 },
  puzzles5: { m: "puzzles", n: 5 },
  puzzles10: { m: "puzzles", n: 10 },
  forks: { m: "t_fork", n: 3 },
  pins: { m: "t_pin", n: 2 },
  skewers: { m: "t_skewer", n: 2 },
  mateIn1: { m: "t_mateIn1", n: 3 },
  mateIn2: { m: "t_mateIn2", n: 1 },
  discovered: { m: "t_discoveredAttack", n: 2 },
  backRank: { m: "t_backRankMate", n: 2 },
  hanging: { m: "t_hangingPiece", n: 3 },
  endgamePuzzles: { m: "t_endgame", n: 2 },
  promotion: { m: "t_promotion", n: 1 },
  daily: { m: "daily", n: 1 },
  mate: { m: "mate", n: 1 },
  sprint5: { m: "sprint", n: 5 },
  sprint10: { m: "sprint", n: 10 },
  practice: { m: "practice", n: 1 },
  practice2: { m: "practice", n: 2 },
  reviews: { m: "reviews", n: 5 },
  cards: { m: "cards", n: 3 },
  goal: { m: "goal", n: 0 },
  minutes20: { m: "minutes", n: 20 },
  game: { m: "games", n: 1, gym: true },
  games3: { m: "games", n: 3, gym: true },
  win: { m: "wins", n: 1, gym: true },
  wins2: { m: "wins", n: 2, gym: true },
  winBlack: { m: "winBlack", n: 1, gym: true },
  cleanWin: { m: "cleanWin", n: 1, gym: true },
  endgame: { m: "endgame", n: 1, gym: true },
  review: { m: "reviewed", n: 1, gym: true },
  vision: { m: "vision", n: 2, gym: true },
  vision10: { m: "visionMin", n: 10, gym: true },
} satisfies Record<string, { m: Measure; n: number; gym?: true }>;
export type QuestId = keyof typeof TEMPLATES;
export const QUEST_POOL = Object.keys(TEMPLATES) as QuestId[];
export const QUESTS_PER_DAY = 3;

/** Small deterministic hash (FNV-1a). */
function seed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/**
 * Today's quests. The learner's own shuffle of the pool is read three at a time, one window per
 * day, so 7 days in a row use 21 different templates (both pools have more than that).
 */
export function pickQuests(day: string, gym: boolean, learner = ""): QuestId[] {
  const pool = QUEST_POOL.filter((id) => gym || !("gym" in TEMPLATES[id]));
  let h = seed(`quests:${learner}`);
  for (let i = pool.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    const j = h % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const start = dayNumber(day) * QUESTS_PER_DAY;
  return Array.from({ length: QUESTS_PER_DAY }, (_, k) => pool[(((start + k) % pool.length) + pool.length) % pool.length]);
}

export type QuestStatus = { id: QuestId; value: number; target: number; done: boolean };

const counterValue = (q: Quests, c: QuestCounter) => ((LEGACY as readonly string[]).includes(c) ? q[c as LegacyCounter] : (q.counts[c] ?? 0));

export function questStatus(state: LocalState, id: QuestId, today: string): QuestStatus {
  const q = state.quests.day === today ? state.quests : emptyQuests();
  const p = state.progress;
  const t = TEMPLATES[id];
  const minutes = p.minutes.day === today ? p.minutes.value : 0;
  const firstToday = Object.entries(p.completed).filter(([lesson, day]) => day === today && !p.placed.includes(lesson)).length;
  const target = t.m === "goal" ? state.profile.dailyMinutes : t.n;
  const value =
    t.m === "lessonFirst" ? Math.max(firstToday, q.counts.lessons ?? 0)
    : t.m === "daily" ? (p.puzzles.daily.lastDay === today ? 1 : 0)
    : t.m === "goal" || t.m === "minutes" ? minutes
    : t.m === "visionMin" ? Math.floor((q.counts.visionSec ?? 0) / 60)
    : counterValue(q, t.m);
  return { id, value: Math.min(value, target), target, done: value >= target };
}

/** Whose quests these are: each child profile gets its own. */
const learnerKey = (state: LocalState) => state.activeChild ?? state.guestId;
export const todayQuests = (state: LocalState, today: string): QuestStatus[] => pickQuests(today, Boolean(state.account), learnerKey(state)).map((id) => questStatus(state, id, today));

/* ---------- monthly challenge ---------- */

export type MonthlyCounter = "lessons" | "puzzles" | "practice" | "questDays";
/** One challenge a month, in turn. Every one is open to guests. */
export const MONTHLY_CHALLENGES: readonly { id: MonthlyCounter; target: number }[] = [
  { id: "questDays", target: 15 },
  { id: "lessons", target: 12 },
  { id: "puzzles", target: 60 },
  { id: "practice", target: 10 },
];
export const monthlyChallenge = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return MONTHLY_CHALLENGES[(y * 12 + m - 1) % MONTHLY_CHALLENGES.length];
};
export type MonthlyStatus = { month: string; id: MonthlyCounter; value: number; target: number; done: boolean };
export function monthlyStatus(state: LocalState, today: string): MonthlyStatus {
  const month = today.slice(0, 7);
  const c = monthlyChallenge(month);
  const value = state.quests.month === month ? (state.quests.monthly[c.id] ?? 0) : 0;
  return { month, id: c.id, value: Math.min(value, c.target), target: c.target, done: state.quests.badges.includes(month) };
}

/**
 * Adds to today's counters (and this month's), then counts the day once every quest is done and
 * gives the month's badge once its challenge is met. Call after any activity.
 */
export function trackQuests(state: LocalState, today: string, add: Partial<Record<QuestCounter, number>> = {}): LocalState {
  const prev = state.quests.day === today ? state.quests : { ...state.quests, day: today, puzzles: 0, practice: 0, games: 0, wins: 0, counts: {} };
  const month = today.slice(0, 7);
  const quests: Quests = { ...prev, counts: { ...prev.counts }, monthly: prev.month === month ? { ...prev.monthly } : {}, month };
  for (const [k, n] of Object.entries(add) as [QuestCounter, number][]) {
    if (!n || !(QUEST_COUNTERS as readonly string[]).includes(k)) continue;
    if ((LEGACY as readonly string[]).includes(k)) quests[k as LegacyCounter] += n;
    else quests.counts[k] = BEST.has(k) ? Math.max(quests.counts[k] ?? 0, n) : (quests.counts[k] ?? 0) + n;
    if (k === "lessons" || k === "puzzles" || k === "practice") quests.monthly[k] = (quests.monthly[k] ?? 0) + n;
  }
  const next = { ...state, quests };
  if (quests.lastDone !== today && todayQuests(next, today).every((s) => s.done)) {
    next.quests = { ...quests, days: quests.days + 1, lastDone: today, monthly: { ...quests.monthly, questDays: (quests.monthly.questDays ?? 0) + 1 } };
  }
  const c = monthlyChallenge(month);
  if (!next.quests.badges.includes(month) && (next.quests.monthly[c.id] ?? 0) >= c.target) next.quests = { ...next.quests, badges: [...next.quests.badges, month] };
  return next;
}

/** Reads stored quests; anything malformed becomes zero. Quests stored before the bigger pool stay valid. */
export function hydrateQuests(raw: unknown): Quests {
  const base = emptyQuests();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Quests>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(10_000, Math.floor(v))) : 0);
  const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const counts = (o: unknown, keys: readonly string[]) =>
    Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([k]) => keys.includes(k)).map(([k, v]) => [k, n(v)]));
  return {
    day: day(r.day),
    puzzles: n(r.puzzles),
    practice: n(r.practice),
    games: n(r.games),
    wins: n(r.wins),
    days: n(r.days),
    lastDone: day(r.lastDone),
    counts: counts(r.counts, QUEST_COUNTERS.filter((k) => !(LEGACY as readonly string[]).includes(k))),
    month: typeof r.month === "string" && /^\d{4}-\d{2}$/.test(r.month) ? r.month : null,
    monthly: counts(r.monthly, ["lessons", "puzzles", "practice", "questDays"]),
    badges: Array.isArray(r.badges) ? r.badges.filter((b) => typeof b === "string" && /^\d{4}-\d{2}$/.test(b)).slice(-120) : [],
  };
}

/* ---------- rewards ---------- */

export type RewardKind = "theme" | "pieces" | "icon";
/** Looks that start locked and open after N quest days. Accessibility looks (High contrast) are never here; app icons have their own goals (appIcons.ts). */
export const QUEST_REWARDS: readonly { kind: RewardKind; id: string; days: number }[] = [
  { kind: "theme", id: "ocean", days: 1 },
  { kind: "pieces", id: "fantasy", days: 3 },
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
