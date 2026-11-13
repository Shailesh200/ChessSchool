import { isThemeId, type Appearance, type ThemeId } from "./tokens";

export const STORAGE_KEY = "chessschool.v2.state";
export const STATE_VERSION = 2;

export type Who = "me" | "child" | "class";
export type DailyMinutes = 5 | 10 | 15;
export const AVATARS = ["cody", "otto", "kira", "skye", "ash", "rex"] as const;
export type AvatarId = (typeof AVATARS)[number];
export const FLAIRS = ["learner", "puzzler", "gym", "monitor"] as const;
export type FlairId = (typeof FLAIRS)[number];
export const isAvatarId = (v: unknown): v is AvatarId => AVATARS.includes(v as AvatarId);
export const isFlairId = (v: unknown): v is FlairId => FLAIRS.includes(v as FlairId);
export type NotificationStatus = "unknown" | "granted" | "denied" | "dismissed";

export type Streak = { count: number; lastDay: string | null };

export type Progress = {
  /** nodeId -> local day (YYYY-MM-DD) it was first completed */
  completed: Record<string, string>;
  xp: number;
  streak: Streak;
  minutes: { day: string | null; value: number };
  games: { played: number; won: number };
  /** Practice sessions finished. */
  drills: number;
  puzzles: PuzzleProgress;
  /** Games and wins per bot id. */
  bots: Record<string, { played: number; won: number }>;
  /** Lessons skipped with "Where should I start?" (completed without XP). */
  placed: string[];
};

export type PuzzleProgress = {
  rating: number;
  attempts: number;
  solved: number;
  /** Most recent puzzle ids, newest first (so the same one isn't served twice). */
  recent: string[];
  sprintBest: number;
  /**
   * `seen` is daily puzzle ids already served, newest first.
   * Optional: progress saved before this field, and older API clients, omit it.
   * `servedDay`/`servedId` lock today's puzzle so it does not change once shown.
   */
  daily: { lastDay: string | null; count: number; seen?: string[]; servedDay?: string | null; servedId?: string | null };
};

/** Newest-first cap so a device cannot store an unbounded seen list. */
export const DAILY_SEEN_MAX = 365;

export type Profile = { name: string; who: Who | null; dailyMinutes: DailyMinutes; avatar: AvatarId; flair: FlairId | null };

export type Prefs = {
  appearance: Appearance;
  sound: boolean;
  haptics: boolean;
  notifications: NotificationStatus;
  /** Local hour (0–23) for the daily reminder. */
  reminderHour: number;
  theme: ThemeId;
  pieceSet: string;
  coords: boolean;
  legalDots: boolean;
  promotion: "ask" | "queen";
  appIcon: string;
};

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Game setup as stored (validated by @chessschool/chess `parseSetup`). */
export type StoredSetup = {
  opponent: { kind: "bot"; bot: string } | { kind: "friend" };
  you: "w" | "b";
  time: string;
  startFen: string;
  startName?: string;
  takebacks: boolean;
  askPromotion: boolean;
};
/** An unfinished game, so leaving the Gym never loses it. */
export type SavedGame = { setup: StoredSetup; history: string[]; startedAt: number; clock: { w: number; b: number } | null };

/** A finished game kept on this device for review (last 30). */
export type GameRecord = {
  id: string;
  endedAt: number;
  setup: StoredSetup;
  history: string[];
  winner: "w" | "b" | null;
  /** checkmate · resigned · timeout · stalemate · draw · repetition · material */
  reason: string;
};
export const GAME_LOG_MAX = 30;
export type Arrival = "kept" | "fresh";

export type Account = { id: string; email: string; name: string; provider: "password" | "google" };

export type LocalState = {
  version: typeof STATE_VERSION;
  guestId: string;
  seenWelcome: boolean;
  profile: Profile;
  prefs: Prefs;
  progress: Progress;
  account: Account | null;
  /** Set once after sign-up/login to play the "progress saved" ceremony on Today. */
  pendingCeremony: "saved" | null;
  /** Rooms the learner asked to be reminded about. */
  roomReminders: RoomId[];
  /** The first-run reminder sheet is offered once, ever. */
  notificationOffered: boolean;
  /** Last local day the app was opened; drives the "you came back" moment. */
  lastOpenDay: string | null;
  arrival: Arrival | null;
  activeGame: SavedGame | null;
  gameLog: GameRecord[];
  /** Achievement ids already celebrated. */
  badgesSeen: string[];
  /** The "Where should I start?" card was answered or dismissed. */
  placementDone: boolean;
};

export type RoomId = "play" | "practice" | "club";
export const ROOMS: readonly RoomId[] = ["play", "practice", "club"];

export const emptyProgress = (): Progress => ({
  completed: {},
  xp: 0,
  streak: { count: 0, lastDay: null },
  minutes: { day: null, value: 0 },
  games: { played: 0, won: 0 },
  drills: 0,
  puzzles: { rating: 600, attempts: 0, solved: 0, recent: [], sprintBest: 0, daily: { lastDay: null, count: 0, seen: [], servedDay: null, servedId: null } },
  bots: {},
  placed: [],
});

export const REMINDER_HOURS = [8, 12, 18, 20] as const;

export function createInitialState(guestId: string): LocalState {
  return {
    version: STATE_VERSION,
    guestId,
    seenWelcome: false,
    profile: { name: "", who: null, dailyMinutes: 10, avatar: "cody", flair: null },
    prefs: { appearance: "system", sound: true, haptics: true, notifications: "unknown", reminderHour: 18, theme: "classroom", pieceSet: "toy", coords: true, legalDots: true, promotion: "ask", appIcon: "classroom" },
    progress: emptyProgress(),
    account: null,
    pendingCeremony: null,
    roomReminders: [],
    notificationOffered: false,
    lastOpenDay: null,
    arrival: null,
    activeGame: null,
    gameLog: [],
    badgesSeen: [],
    placementDone: false,
  };
}

function cleanProfile(base: Profile, raw: Partial<Profile> | undefined): Profile {
  const next = { ...base, ...(raw ?? {}) };
  return { ...next, avatar: isAvatarId(next.avatar) ? next.avatar : base.avatar, flair: isFlairId(next.flair) ? next.flair : null };
}

/** Accepts anything read from storage and returns a valid state (never throws). */
export function hydrateState(raw: unknown, newGuestId: () => string): LocalState {
  const base = createInitialState(newGuestId());
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<LocalState>;
  if (r.version !== STATE_VERSION) return base;
  return {
    ...base,
    ...r,
    guestId: typeof r.guestId === "string" && r.guestId ? r.guestId : base.guestId,
    profile: cleanProfile(base.profile, r.profile),
    prefs: hydratePrefs(base.prefs, r.prefs),
    progress: isProgress(r.progress) ? sanitizeProgress({ ...base.progress, ...r.progress }) : base.progress,
    account: r.account ?? null,
    pendingCeremony: r.pendingCeremony ?? null,
    roomReminders: Array.isArray(r.roomReminders) ? r.roomReminders.filter((id) => ROOMS.includes(id)) : [],
    notificationOffered: r.notificationOffered === true,
    lastOpenDay: typeof r.lastOpenDay === "string" ? r.lastOpenDay : null,
    arrival: r.arrival === "kept" || r.arrival === "fresh" ? r.arrival : null,
    activeGame: toSavedGame(r.activeGame),
    gameLog: Array.isArray(r.gameLog) ? r.gameLog.filter(isGameRecord).slice(0, GAME_LOG_MAX) : [],
    badgesSeen: Array.isArray(r.badgesSeen) ? r.badgesSeen.filter((b) => typeof b === "string") : [],
    placementDone: r.placementDone === true,
  };
}

/** Piece sets ChessSchool still ships. Keep in step with `PieceSetId` in @chessschool/chess. */
const KEPT_PIECE_SETS = new Set(["toy", "clay", "pixel", "outline"]);

function hydratePrefs(base: Prefs, raw: unknown): Prefs {
  const p = { ...base, ...((raw as Partial<Prefs>) ?? {}) };
  return {
    ...p,
    theme: isThemeId(p.theme) ? p.theme : "classroom",
    pieceSet: typeof p.pieceSet === "string" && KEPT_PIECE_SETS.has(p.pieceSet) ? p.pieceSet : "toy",
    coords: p.coords !== false,
    legalDots: p.legalDots !== false,
    promotion: p.promotion === "queen" ? "queen" : "ask",
    appIcon: typeof p.appIcon === "string" ? p.appIcon : "classroom",
    reminderHour: typeof p.reminderHour === "number" && p.reminderHour >= 0 && p.reminderHour < 24 ? p.reminderHour : 18,
  };
}

const isMoves = (v: unknown): v is string[] => Array.isArray(v) && v.length < 600 && v.every((m) => typeof m === "string");
function isSetup(v: unknown): v is StoredSetup {
  const s = v as StoredSetup;
  return Boolean(s && typeof s === "object" && s.opponent && (s.you === "w" || s.you === "b") && typeof s.startFen === "string");
}
function isGameRecord(v: unknown): v is GameRecord {
  const g = v as GameRecord;
  return Boolean(g && typeof g === "object" && typeof g.id === "string" && isSetup(g.setup) && isMoves(g.history));
}
/** Accepts a saved game in the current shape, or a Phase 2 one ({ you, level, history }). */
function toSavedGame(v: unknown): SavedGame | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  if (!isMoves(g.history)) return null;
  const startedAt = typeof g.startedAt === "number" ? g.startedAt : Date.now();
  if (isSetup(g.setup)) return { setup: g.setup, history: g.history, startedAt, clock: (g.clock as SavedGame["clock"]) ?? null };
  if (g.you === "w" || g.you === "b") {
    const bot = g.level === "steady" ? "rooky" : "cody";
    return { setup: { opponent: { kind: "bot", bot }, you: g.you, time: "none", startFen: START_FEN, takebacks: true, askPromotion: true }, history: g.history, startedAt, clock: null };
  }
  return null;
}

/** Clears everything about the guest on this device but keeps a fresh guest id. */
export function resetDevice(newGuestId: string): LocalState {
  return createInitialState(newGuestId);
}

/* ---------- days & streaks ---------- */

/** Milliseconds until the next local midnight (12:00 AM). */
export function msUntilLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, next.getTime() - now.getTime());
}

/** Delay for one timer until local midnight. Never 0, so a fire at 00:00:00 cannot loop. */
export function msUntilNextLocalMidnight(now: Date): number {
  return Math.max(1, msUntilLocalMidnight(now));
}

/**
 * One timeout until local midnight. The callback receives the new day key, then the timer is armed again.
 * `sync` reports the current day and re-arms, for when a background timer may have been throttled.
 */
export function watchLocalMidnight(onDay: (day: string) => void, now: () => Date = () => new Date()): { sync: () => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const arm = () => {
    if (stopped) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (stopped) return;
      onDay(dayKey(now()));
      arm();
    }, msUntilNextLocalMidnight(now()));
  };
  arm();
  return {
    sync: () => {
      if (stopped) return;
      onDay(dayKey(now()));
      arm();
    },
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

/** `H:MM:SS` remaining, for the daily-puzzle countdown. */
export function formatDailyCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function streakAfterActivity(streak: Streak, today: string): Streak {
  if (!streak.lastDay) return { count: 1, lastDay: today };
  const gap = daysBetween(streak.lastDay, today);
  if (gap <= 0) return streak;
  if (gap === 1) return { count: streak.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}

/** Streak to show today: a streak survives until the end of the day after its last activity. */
export function visibleStreak(streak: Streak, today: string): number {
  if (!streak.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, today);
  return gap <= 1 ? streak.count : 0;
}

export function minutesToday(progress: Progress, today: string): number {
  return progress.minutes.day === today ? progress.minutes.value : 0;
}

/* ---------- path ---------- */

export type UnitId = "unit1" | "unit2" | "unit3" | "unit4" | "unit5" | "unit6" | "unit7" | "unit8" | "unit9" | "unit10" | "unit11";
export type PathNodeDef = { id: string; unit: UnitId; minutes: number; xp: number; available: boolean };

/** The path. "meet" is the product tour. Later units stay open so a learner can browse ahead. */
export const PATH: readonly PathNodeDef[] = [
  { id: "meet", unit: "unit1", minutes: 2, xp: 10, available: true },
  { id: "board", unit: "unit1", minutes: 5, xp: 20, available: true },
  { id: "moves", unit: "unit1", minutes: 6, xp: 20, available: true },
  { id: "pawns", unit: "unit1", minutes: 5, xp: 20, available: true },
  { id: "check", unit: "unit1", minutes: 6, xp: 25, available: true },
  { id: "firstGame", unit: "unit1", minutes: 8, xp: 30, available: true },
  { id: "castling", unit: "unit2", minutes: 5, xp: 20, available: true },
  { id: "special", unit: "unit2", minutes: 5, xp: 20, available: true },
  { id: "values", unit: "unit2", minutes: 5, xp: 20, available: true },
  { id: "forks", unit: "unit2", minutes: 6, xp: 25, available: true },
  { id: "pins", unit: "unit2", minutes: 6, xp: 25, available: true },
  { id: "ladder", unit: "unit3", minutes: 5, xp: 25, available: true },
  { id: "queenMate", unit: "unit3", minutes: 6, xp: 30, available: true },
  { id: "centre", unit: "unit4", minutes: 5, xp: 20, available: true },
  { id: "develop", unit: "unit4", minutes: 5, xp: 20, available: true },
  { id: "italian", unit: "unit4", minutes: 6, xp: 25, available: true },
  { id: "queenOut", unit: "unit4", minutes: 5, xp: 20, available: true },
  { id: "weakSquare", unit: "unit4", minutes: 5, xp: 25, available: true },
  { id: "skewer", unit: "unit5", minutes: 5, xp: 25, available: true },
  { id: "discovery", unit: "unit5", minutes: 5, xp: 25, available: true },
  { id: "defender", unit: "unit5", minutes: 6, xp: 25, available: true },
  { id: "doubleCheck", unit: "unit5", minutes: 5, xp: 25, available: true },
  { id: "activeKing", unit: "unit6", minutes: 5, xp: 20, available: true },
  { id: "opposition", unit: "unit6", minutes: 5, xp: 25, available: true },
  { id: "passedPawn", unit: "unit6", minutes: 5, xp: 20, available: true },
  { id: "escort", unit: "unit6", minutes: 5, xp: 25, available: true },
  { id: "rookFile", unit: "unit6", minutes: 5, xp: 20, available: true },
  { id: "backRank", unit: "unit7", minutes: 5, xp: 25, available: true },
  { id: "smothered", unit: "unit7", minutes: 5, xp: 25, available: true },
  { id: "arabian", unit: "unit7", minutes: 5, xp: 25, available: true },
  { id: "bishopPair", unit: "unit7", minutes: 5, xp: 30, available: true },
  { id: "rookKing", unit: "unit7", minutes: 5, xp: 30, available: true },
  { id: "sacrifice", unit: "unit8", minutes: 5, xp: 25, available: true },
  { id: "structure", unit: "unit9", minutes: 5, xp: 25, available: true },
  { id: "plan", unit: "unit10", minutes: 5, xp: 25, available: true },
  { id: "queenEnding", unit: "unit11", minutes: 6, xp: 30, available: true },
];
export const UNITS: readonly UnitId[] = ["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7", "unit8", "unit9", "unit10", "unit11"];

export type NodeState = "done" | "current" | "locked";

export function pathStates(progress: Progress): { id: string; state: NodeState }[] {
  let currentAssigned = false;
  return PATH.map((n) => {
    if (progress.completed[n.id]) return { id: n.id, state: "done" as const };
    if (!currentAssigned) currentAssigned = true;
    return { id: n.id, state: "current" as const };
  });
}

/** The first unfinished lesson, or null once the whole path is done. */
export function nextNode(progress: Progress): PathNodeDef | null {
  const cur = pathStates(progress).find((n) => n.state === "current");
  return cur ? PATH.find((n) => n.id === cur.id)! : null;
}

export function nodeState(progress: Progress, nodeId: string): NodeState | null {
  return pathStates(progress).find((n) => n.id === nodeId)?.state ?? null;
}

export function completeNode(state: LocalState, nodeId: string, now: Date): LocalState {
  const node = PATH.find((n) => n.id === nodeId);
  if (!node) return state;
  const today = dayKey(now);
  const first = !state.progress.completed[nodeId];
  const prevMinutes = minutesToday(state.progress, today);
  return {
    ...state,
    arrival: null,
    progress: {
      ...state.progress,
      completed: first ? { ...state.progress.completed, [nodeId]: today } : state.progress.completed,
      xp: state.progress.xp + (first ? node.xp : 0),
      streak: streakAfterActivity(state.progress.streak, today),
      minutes: { day: today, value: Math.min(1440, prevMinutes + node.minutes) },
    },
  };
}

/** Practice and games count toward the streak and today's goal, but never add XP. */
function activity(state: LocalState, now: Date, minutes: number): LocalState {
  const today = dayKey(now);
  return {
    ...state,
    arrival: null,
    progress: {
      ...state.progress,
      streak: streakAfterActivity(state.progress.streak, today),
      minutes: { day: today, value: Math.min(1440, minutesToday(state.progress, today) + Math.max(1, Math.round(minutes))) },
    },
  };
}

export function recordPractice(state: LocalState, now: Date, minutes = 3): LocalState {
  const s = activity(state, now, minutes);
  return { ...s, progress: { ...s.progress, drills: s.progress.drills + 1 } };
}

/**
 * A finished game: counts toward streak and goal, updates per-bot stats (vs bots only) and keeps it
 * in the review log. Pass & play games count as practice but not as wins.
 */
export function recordGame(state: LocalState, game: GameRecord, now: Date, minutes: number): LocalState {
  const s = activity(state, now, Math.min(30, minutes));
  const bot = game.setup.opponent.kind === "bot" ? game.setup.opponent.bot : null;
  const won = Boolean(bot) && game.winner === game.setup.you;
  const g = s.progress.games;
  const b = bot ? (s.progress.bots[bot] ?? { played: 0, won: 0 }) : null;
  return {
    ...s,
    activeGame: null,
    gameLog: [game, ...s.gameLog.filter((x) => x.id !== game.id)].slice(0, GAME_LOG_MAX),
    progress: {
      ...s.progress,
      games: { played: g.played + 1, won: g.won + (won ? 1 : 0) },
      bots: bot && b ? { ...s.progress.bots, [bot]: { played: b.played + 1, won: b.won + (won ? 1 : 0) } } : s.progress.bots,
    },
  };
}

/** A puzzle attempt. Solving counts as a little practice; the new rating comes from the caller. */
export function recordPuzzle(state: LocalState, p: { id: string; solved: boolean; newRating: number; daily?: boolean }, now: Date): LocalState {
  const today = dayKey(now);
  const s = p.solved ? activity(state, now, 1) : state;
  const pz = s.progress.puzzles;
  const prevSeen = pz.daily?.seen ?? [];
  const seen = capSeen(p.daily && p.solved ? [p.id, ...prevSeen.filter((id) => id !== p.id)] : prevSeen);
  // The day is done only once the daily puzzle is solved, so a miss can be tried again.
  const daily =
    p.daily && p.solved && pz.daily.lastDay !== today
      ? { lastDay: today, count: pz.daily.lastDay && daysBetween(pz.daily.lastDay, today) === 1 ? pz.daily.count + 1 : 1, seen, servedDay: today, servedId: p.id }
      : { ...pz.daily, seen, ...(p.daily && p.solved ? { servedDay: today, servedId: p.id } : {}) };
  return {
    ...s,
    progress: {
      ...s.progress,
      puzzles: {
        ...pz,
        rating: Math.round(Math.max(100, Math.min(3000, p.newRating))),
        attempts: pz.attempts + 1,
        solved: pz.solved + (p.solved ? 1 : 0),
        recent: [p.id, ...pz.recent.filter((id) => id !== p.id)].slice(0, 50),
        daily,
      },
    },
  };
}

export function recordSprint(state: LocalState, score: number, now: Date, minutes: number): LocalState {
  const s = activity(state, now, minutes);
  const pz = s.progress.puzzles;
  return { ...s, progress: { ...s.progress, puzzles: { ...pz, sprintBest: Math.max(pz.sprintBest, score) } } };
}

export const dailyDone = (progress: Progress, today: string) => progress.puzzles.daily.lastDay === today;

/** Remember the puzzle shown for this local day so it is not served again. No-op when that id is already stored. */
export function serveDaily(state: LocalState, day: string, id: string): LocalState {
  const daily = state.progress.puzzles.daily ?? { lastDay: null, count: 0 };
  if (daily.servedDay === day && daily.servedId === id) return state;
  const seen = capSeen([id, ...(daily.seen ?? []).filter((x) => x !== id)]);
  return {
    ...state,
    progress: {
      ...state.progress,
      puzzles: { ...state.progress.puzzles, daily: { ...daily, seen, servedDay: day, servedId: id } },
    },
  };
}

/** Gym games (bots, coaches, pass & play) are for an account. Guests only see the sign-up card. */
export function canUseGym(account: { id: string } | null | undefined): boolean {
  return Boolean(account?.id);
}

/* ---------- placement ---------- */

export type Placement = "new" | "moves" | "player";
/** "Where should I start?" Skips lessons without XP; experienced players start with a higher puzzle rating. */
export function placeAt(state: LocalState, level: Placement, now: Date): LocalState {
  const skip = level === "moves" ? ["meet", "board", "moves", "pawns"] : level === "player" ? PATH.filter((n) => n.unit === "unit1").map((n) => n.id) : [];
  const today = dayKey(now);
  const completed = { ...state.progress.completed };
  const placed = new Set(state.progress.placed);
  for (const id of skip) {
    if (!completed[id]) {
      completed[id] = today;
      placed.add(id);
    }
  }
  const pz = state.progress.puzzles;
  const rating = level === "player" && pz.attempts === 0 ? 1000 : level === "moves" && pz.attempts === 0 ? 750 : pz.rating;
  return { ...state, placementDone: true, progress: { ...state.progress, completed, placed: [...placed], puzzles: { ...pz, rating } } };
}

/* ---------- return loop ---------- */

/**
 * Called when the app opens. On the first open of a new day after earlier activity, sets the
 * "you came back" moment: kept = the streak is still alive today, fresh = it lapsed.
 */
export function arrive(state: LocalState, now: Date): LocalState {
  const today = dayKey(now);
  if (state.lastOpenDay === today) return state;
  const last = state.progress.streak.lastDay;
  let arrival: Arrival | null = null;
  if (last && last < today && state.progress.streak.count > 0) arrival = daysBetween(last, today) === 1 ? "kept" : "fresh";
  return { ...state, lastOpenDay: today, arrival };
}

export function goalMet(progress: Progress, dailyMinutes: number, today: string): boolean {
  return minutesToday(progress, today) >= dailyMinutes;
}

/**
 * Local times for the next `days` reminders at the chosen hour. Today is skipped once the goal
 * is met or the hour has passed, so Cody never nags after you've practised.
 */
export function reminderPlan(state: LocalState, now: Date, days = 7): Date[] {
  const out: Date[] = [];
  const today = dayKey(now);
  for (let i = 0; i < days + 1 && out.length < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, state.prefs.reminderHour, 0, 0, 0);
    if (i === 0 && (at <= now || goalMet(state.progress, state.profile.dailyMinutes, today))) continue;
    out.push(at);
  }
  return out;
}

export function ideasLearned(progress: Progress): number {
  return Object.keys(progress.completed).length;
}

/* ---------- ranks ---------- */

export const RANKS = [
  { id: "pawn", xp: 0 },
  { id: "knight", xp: 100 },
  { id: "bishop", xp: 250 },
  { id: "rook", xp: 450 },
  { id: "queen", xp: 700 },
  { id: "king", xp: 1000 },
] as const;
export type RankId = (typeof RANKS)[number]["id"];

export function rankFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) idx = i;
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const span = next ? next.xp - rank.xp : 1;
  return {
    rank: rank.id as RankId,
    index: idx,
    level: Math.floor(xp / 50) + 1,
    next: (next?.id ?? null) as RankId | null,
    toNext: next ? next.xp - xp : 0,
    fraction: next ? Math.min(1, (xp - rank.xp) / span) : 1,
  };
}

/* ---------- merge (guest -> account, device <-> server) ---------- */

function earlierDay(a: string | undefined, b: string | undefined) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Never loses progress: union of completions, max XP, the most recent streak. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const completed: Record<string, string> = {};
  for (const id of new Set([...Object.keys(a.completed), ...Object.keys(b.completed)])) {
    completed[id] = earlierDay(a.completed[id], b.completed[id])!;
  }
  const la = a.streak.lastDay ?? "";
  const lb = b.streak.lastDay ?? "";
  const streak =
    la === lb ? { count: Math.max(a.streak.count, b.streak.count), lastDay: a.streak.lastDay } : la > lb ? a.streak : b.streak;
  const da = a.minutes.day ?? "";
  const db = b.minutes.day ?? "";
  const minutes = da === db ? { day: a.minutes.day, value: Math.max(a.minutes.value, b.minutes.value) } : da > db ? a.minutes : b.minutes;
  const ga = a.games ?? { played: 0, won: 0 };
  const gb = b.games ?? { played: 0, won: 0 };
  const pa = a.puzzles ?? emptyProgress().puzzles;
  const pb = b.puzzles ?? emptyProgress().puzzles;
  const lead = pa.attempts >= pb.attempts ? pa : pb;
  const dayA = pa.daily ?? { lastDay: null, count: 0 };
  const dayB = pb.daily ?? { lastDay: null, count: 0 };
  const dA = dayA.lastDay ?? "";
  const dB = dayB.lastDay ?? "";
  const seenA = dayA.seen ?? [];
  const seenB = dayB.seen ?? [];
  const seen = capSeen([...seenA, ...seenB.filter((id) => !seenA.includes(id))]);
  const bots: Progress["bots"] = {};
  for (const id of new Set([...Object.keys(a.bots ?? {}), ...Object.keys(b.bots ?? {})])) {
    const x = a.bots?.[id] ?? { played: 0, won: 0 };
    const y = b.bots?.[id] ?? { played: 0, won: 0 };
    bots[id] = { played: Math.max(x.played, y.played), won: Math.max(x.won, y.won) };
  }
  return {
    completed,
    xp: Math.max(a.xp, b.xp),
    streak,
    minutes,
    games: { played: Math.max(ga.played, gb.played), won: Math.max(ga.won, gb.won) },
    drills: Math.max(a.drills ?? 0, b.drills ?? 0),
    puzzles: {
      rating: lead.rating,
      attempts: Math.max(pa.attempts, pb.attempts),
      solved: Math.max(pa.solved, pb.solved),
      recent: lead.recent,
      sprintBest: Math.max(pa.sprintBest, pb.sprintBest),
      daily: {
        ...(dA === dB ? { lastDay: dayA.lastDay, count: Math.max(dayA.count, dayB.count) } : dA > dB ? dayA : dayB),
        seen,
        servedDay: (dA >= dB ? dayA.servedDay : dayB.servedDay) ?? null,
        servedId: (dA >= dB ? dayA.servedId : dayB.servedId) ?? null,
      },
    },
    bots,
    placed: [...new Set([...(a.placed ?? []), ...(b.placed ?? [])])],
  };
}

export function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const v = value as Progress;
  return (
    typeof v.completed === "object" &&
    v.completed !== null &&
    typeof v.xp === "number" &&
    Number.isFinite(v.xp) &&
    v.xp >= 0 &&
    typeof v.streak === "object" &&
    v.streak !== null &&
    typeof v.streak.count === "number" &&
    typeof v.minutes === "object" &&
    v.minutes !== null &&
    (v.games === undefined || (typeof v.games === "object" && v.games !== null)) &&
    (v.drills === undefined || typeof v.drills === "number")
  );
}

/** Drops unknown node ids and clamps XP so a client cannot inflate progress. */
export function sanitizeProgress(p: Progress): Progress {
  const completed: Record<string, string> = {};
  let xpCap = 0;
  // Lessons only count in path order: a completion after a gap can't have been earned.
  for (const n of PATH) {
    const day = p.completed[n.id];
    if (!n.available || typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) break;
    completed[n.id] = day;
    xpCap += n.xp;
  }
  const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const count = (n: unknown, max = 100_000) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);
  const played = count(p.games?.played);
  return {
    completed,
    xp: Math.min(Math.max(0, Math.floor(p.xp)), xpCap),
    streak: { count: Math.max(0, Math.min(10_000, Math.floor(p.streak.count))), lastDay: day(p.streak.lastDay) },
    minutes: { day: day(p.minutes.day), value: Math.max(0, Math.min(1440, Math.floor(p.minutes.value))) },
    games: { played, won: Math.min(played, count(p.games?.won)) },
    drills: count(p.drills),
    puzzles: sanitizePuzzles(p.puzzles),
    bots: Object.fromEntries(
      Object.entries(p.bots && typeof p.bots === "object" ? p.bots : {})
        .filter(([id]) => /^[a-z]{2,12}$/.test(id))
        .slice(0, 12)
        .map(([id, v]) => {
          const pl = count(v?.played);
          return [id, { played: pl, won: Math.min(pl, count(v?.won)) }];
        }),
    ),
    placed: Array.isArray(p.placed) ? p.placed.filter((id) => typeof id === "string" && completed[id]) : [],
  };
}

const SEEN_ID = /^[A-Za-z0-9]{3,8}$/;

/** Keep the newest valid ids. Missing, junk, and oversized lists all become a bounded array. */
function capSeen(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !SEEN_ID.test(id) || have.has(id)) continue;
    have.add(id);
    out.push(id);
    if (out.length >= DAILY_SEEN_MAX) break;
  }
  return out;
}

function sanitizePuzzles(raw: unknown): PuzzleProgress {
  const base = emptyProgress().puzzles;
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Partial<PuzzleProgress>;
  const n = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const attempts = n(p.attempts, 1_000_000);
  return {
    rating: typeof p.rating === "number" && Number.isFinite(p.rating) ? Math.max(100, Math.min(3000, Math.round(p.rating))) : base.rating,
    attempts,
    solved: Math.min(attempts, n(p.solved, 1_000_000)),
    recent: Array.isArray(p.recent) ? p.recent.filter((id) => typeof id === "string" && /^[A-Za-z0-9]{3,8}$/.test(id)).slice(0, 50) : [],
    sprintBest: n(p.sprintBest, 500),
    daily: {
      lastDay: day(p.daily?.lastDay),
      count: n(p.daily?.count, 10_000),
      seen: capSeen(Array.isArray(p.daily?.seen) ? p.daily.seen : []),
      servedDay: day(p.daily?.servedDay),
      servedId: typeof p.daily?.servedId === "string" && /^[A-Za-z0-9]{3,8}$/.test(p.daily.servedId) ? p.daily.servedId : null,
    },
  };
}

/* ---------- achievements ---------- */

export type BadgeId =
  | "firstLesson"
  | "unit1"
  | "unit2"
  | "unit3"
  | "unit4"
  | "unit5"
  | "unit6"
  | "unit7"
  | "unit8"
  | "unit9"
  | "unit10"
  | "unit11"
  | "streak3"
  | "streak7"
  | "firstGame"
  | "firstWin"
  | "beatBishop"
  | "puzzles10"
  | "puzzles50"
  | "rating1000"
  | "daily5"
  | "practice5";

const unitDone = (p: Progress, unit: UnitId) => PATH.filter((n) => n.unit === unit).every((n) => p.completed[n.id]);

export const BADGES: readonly { id: BadgeId; earned: (p: Progress) => boolean }[] = [
  { id: "firstLesson", earned: (p) => PATH.some((n) => n.id !== "meet" && p.completed[n.id] && !p.placed.includes(n.id)) },
  { id: "unit1", earned: (p) => unitDone(p, "unit1") },
  { id: "unit2", earned: (p) => unitDone(p, "unit2") },
  { id: "unit3", earned: (p) => unitDone(p, "unit3") },
  { id: "unit4", earned: (p) => unitDone(p, "unit4") },
  { id: "unit5", earned: (p) => unitDone(p, "unit5") },
  { id: "unit6", earned: (p) => unitDone(p, "unit6") },
  { id: "unit7", earned: (p) => unitDone(p, "unit7") },
  { id: "unit8", earned: (p) => unitDone(p, "unit8") },
  { id: "unit9", earned: (p) => unitDone(p, "unit9") },
  { id: "unit10", earned: (p) => unitDone(p, "unit10") },
  { id: "unit11", earned: (p) => unitDone(p, "unit11") },
  { id: "streak3", earned: (p) => p.streak.count >= 3 },
  { id: "streak7", earned: (p) => p.streak.count >= 7 },
  { id: "firstGame", earned: (p) => p.games.played >= 1 },
  { id: "firstWin", earned: (p) => p.games.won >= 1 },
  { id: "beatBishop", earned: (p) => ["bishop", "ivy", "atlas"].some((b) => (p.bots[b]?.won ?? 0) > 0) },
  { id: "puzzles10", earned: (p) => p.puzzles.solved >= 10 },
  { id: "puzzles50", earned: (p) => p.puzzles.solved >= 50 },
  { id: "rating1000", earned: (p) => p.puzzles.rating >= 1000 && p.puzzles.attempts >= 10 },
  { id: "daily5", earned: (p) => p.puzzles.daily.count >= 5 },
  { id: "practice5", earned: (p) => p.drills >= 5 },
];

export const earnedBadges = (p: Progress): BadgeId[] => BADGES.filter((b) => b.earned(p)).map((b) => b.id);
/** Earned but not yet celebrated. */
export const newBadges = (s: LocalState): BadgeId[] => earnedBadges(s.progress).filter((id) => !s.badgesSeen.includes(id));
