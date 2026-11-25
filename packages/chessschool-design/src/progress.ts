import { isBoardColors, isThemeId, type Appearance, type BoardColorsId, type ThemeId } from "./tokens";
import { isCountry } from "./countries";
import { isCoachId, VOICE_SPEEDS, type CoachId, type VoiceSpeed } from "./coaches";
import { isLang, type Lang } from "./i18n";
import type { ProfileSlice } from "./profiles";
import { ideaRef, isReview, PRACTICE_KEEP, reviewAfter, type Review, seedIdea } from "./review";
import type { PracticeItem, RateInput } from "./api";
import { emptyQuests, hydrateQuests, trackQuests, type Quests } from "./quests";
import { lessonSkill, mergeSkills, sanitizeSkills, skillsAfter, tagSkills, themeSkills, type SkillId, type Skills } from "./skills";
import { emptyRatings, sanitizeRatingQueue, sanitizeRatings, type Ratings } from "./rating";
import { sanitizeWriteQueue, type QueuedWrite } from "./offline";
import { sanitizeCelebrated, sanitizeCelebrations, type Celebration } from "./celebrate";
import { sanitizeWeeks, type WeekMark } from "./recap";

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

/** `freezes`: spare days earned (one per 7-day stretch, at most FREEZE_MAX) that cover a missed day. */
export type Streak = { count: number; lastDay: string | null; freezes?: number };
export const FREEZE_MAX = 2;
/** Leaves `freezes` out when there are none, so stored streaks keep their old shape. */
const withFreezes = (s: { count: number; lastDay: string | null }, freezes: number): Streak => (freezes > 0 ? { ...s, freezes } : s);

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
  /** Score per chess idea (skills.ts); steers practice, never XP. Absent until the first result. */
  skills?: Skills;
  /** Lessons finished once with no miss and no hint; each adds PERFECT_BONUS XP once. Absent until the first. */
  perfect?: string[];
};

/** Extra XP for a lesson finished with no miss and no hint (once per lesson; the server allows for it). */
export const PERFECT_BONUS = 5;

export type DailyPuzzleSnapshot = { id: string; fen: string; moves: string[]; rating: number; themes: string[] };

export type PuzzleProgress = {
  rating: number;
  attempts: number;
  solved: number;
  /** Most recent puzzle ids, newest first (so the same one isn't served again soon; PUZZLE_RECENT kept). */
  recent: string[];
  sprintBest: number;
  /**
   * `seen` is daily puzzle ids already served, newest first.
   * Optional: progress saved before this field, and older API clients, omit it.
   * `servedDay`/`servedId` lock today's puzzle so it does not change once shown.
   * `served` is that puzzle's data, so it can still render if a later pack no longer contains the id.
   */
  daily: {
    lastDay: string | null;
    count: number;
    seen?: string[];
    servedDay?: string | null;
    servedId?: string | null;
    served?: DailyPuzzleSnapshot;
    /** Spare days for the daily-puzzle streak (one per 7 days in a row, at most FREEZE_MAX); a missed day uses one. */
    freezes?: number;
  };
};

/** Newest-first cap so a device cannot store an unbounded seen list. */
export const DAILY_SEEN_MAX = 365;

/** `country`: ISO code shown as a flag on leaderboards (null until picked). */
export type Profile = { name: string; who: Who | null; dailyMinutes: DailyMinutes; avatar: AvatarId; flair: FlairId | null; country?: string | null };

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
  /** Send anonymous usage events (on by default; Settings can turn it off). */
  shareUsage: boolean;
  /** The lesson coach; null until the learner picks one. */
  coach: CoachId | null;
  /** Coach voice in lessons. */
  voice: boolean;
  voiceSpeed: VoiceSpeed;
  /** App language; null follows the device. */
  lang: Lang | null;
  /** Colour-blind friendly board colours ("theme" keeps the theme's board). */
  boardColors: BoardColorsId;
  /** Atkinson Hyperlegible instead of Fredoka (Hindi keeps Baloo). */
  easyFont: boolean;
  /** Turn animations off even when the device doesn't ask for it. */
  reduceMotion: boolean;
  /** Outlines and stripes on board highlights, so they never depend on colour alone. */
  markShapes: boolean;
};

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Game setup as stored (validated by @chessschool/chess `parseSetup`). */
export type StoredSetup = {
  opponent: { kind: "bot"; bot: string } | { kind: "friend" } | { kind: "online" };
  you: "w" | "b";
  time: string;
  startFen: string;
  startName?: string;
  startId?: string;
  takebacks: boolean;
  askPromotion: boolean;
  /** Move-list colour of White ("blue" or "orange"; Black has the other), picked when the game starts. */
  whiteHue?: "blue" | "orange";
};
/** An unfinished game, so leaving the Gym never loses it. */
export type SavedGame = { setup: StoredSetup; history: string[]; startedAt: number; clock: { w: number; b: number } | null };

/** A finished game kept on this device for review (last GAME_LOG_MAX; signed in, the account keeps a copy). */
export type GameRecord = {
  id: string;
  endedAt: number;
  setup: StoredSetup;
  history: string[];
  winner: "w" | "b" | null;
  /** checkmate · resigned · timeout · stalemate · draw · repetition · material · imported */
  reason: string;
  /** Its mistakes have been counted in the skills (once per game). */
  reviewed?: boolean;
};

/** A position where the learner went wrong in their own game, replayed in practice as "find the better move". */
export type MistakePosition = { ref: string; fen: string; from: string; to: string; better: string; skill: SkillId | null };
export const MISTAKES_MAX = 20;
export const GAME_LOG_MAX = 100;
export type Arrival = "kept" | "fresh";

/** `ai`: the server's switch for this account's AI features (coach, hints, AI bots, scanner); missing means allowed. */
/** `username`: the unique @handle (Phase 5; absent from older servers). */
export type Account = { id: string; email: string; name: string; provider: "password" | "google" | "apple"; ai?: boolean; username?: string | null };

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
  /** Random id for anonymous usage events only; never sent with an account or the guest id. */
  usageId: string;
  /** Practice positions to review, keyed "<lessonId>:<stepIndex>" (this device only). */
  review: Review;
  /** The next practice set, kept so practice works offline. */
  practiceNext: PracticeItem[];
  /** Endgame trainer wins per position id (mastered at ENDGAME_MASTERY). */
  endgames: Record<string, number>;
  /** The child profile in use (null = the account's own profile) and the others' parked data. */
  activeChild: string | null;
  parked: Record<string, ProfileSlice>;
  /** Optional 4-digit parent PIN that guards Settings on this device. */
  parentPin: string | null;
  /** Today's quest counters and quest days earned (this device only; see quests.ts). */
  quests: Quests;
  /** Board-vision personal best per game id. */
  vision: Record<string, number>;
  /** Playing rating and each bot's adapted strength (the API's copy wins when signed in). */
  ratings: Ratings;
  /** Rated results not yet accepted by the server, oldest first (each carries its child, if any). */
  ratingQueue: RateInput[];
  /** Other writes made offline, oldest first (see offline.ts). */
  writeQueue: QueuedWrite[];
  /** Flashcard schedule for finished lessons' key ideas ("idea:<lessonId>"). */
  ideas: Review;
  /** Positions from the learner's own games to practise ("mistake:<n>" refs in `review`). */
  mistakes: MistakePosition[];
  /** "AI explanations" per profile (MAIN_PROFILE or a child id); missing means the default (on for adults, off for children). */
  aiExplain: Record<string, boolean>;
  /** When this device agreed to the terms (the start screen); null until then. Covers the AI features too. */
  termsAt: string | null;
  /** Full-screen celebrations waiting to be shown, oldest first (celebrate.ts). */
  pendingCelebrations: Celebration[];
  /** Celebration ids already shown, so each shows once. */
  celebrated: string[];
  /** Usual play time, streak repair and the mate of the day (this learner, this device). */
  habit: Habit;
  /** The "pick your username" prompt was answered (saved or skipped) on this device (Phase 5). */
  usernameAsked?: boolean;
};

/** A streak broken by one missed day, waiting for REPAIR_LESSONS lessons before the window closes. */
export type StreakRepair = { missed: string; prev: number; lessons: number };
export const REPAIR_LESSONS = 2;
/** The repair stays open for 48 hours after the missed day ends: the next two local days. */
export const REPAIR_DAYS = 2;
/** Mate of the day on this device: each try is a row of moves (true = right, false = wrong). */
export type MateRecord = { day: string; tries: boolean[][]; solved: boolean; done: boolean };
export type Habit = {
  /** Local hour of the first activity on each recent day (newest PLAY_HOURS_MAX days). */
  playHours: Record<string, number>;
  streakRepair: StreakRepair | null;
  mate: MateRecord | null;
  /** Running totals as each recent week began, newest first (recap.ts). */
  weeks?: WeekMark[];
  /** The week (its Monday) whose recap card was closed. */
  recapSeen?: string;
};
export const PLAY_HOURS_MAX = 14;
export const emptyHabit = (): Habit => ({ playHours: {}, streakRepair: null, mate: null });

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

/** Puzzles remembered as recently seen (about a quarter of the full pack). */
export const PUZZLE_RECENT = 150;

export const REMINDER_HOURS = [8, 12, 18, 20] as const;

export function createInitialState(guestId: string): LocalState {
  return {
    version: STATE_VERSION,
    guestId,
    seenWelcome: false,
    profile: { name: "", who: null, dailyMinutes: 10, avatar: "cody", flair: null },
    prefs: { appearance: "system", sound: true, haptics: true, notifications: "unknown", reminderHour: 18, theme: "sunset", pieceSet: "toy", coords: true, legalDots: true, promotion: "ask", appIcon: "classroom", shareUsage: true, coach: null, voice: true, voiceSpeed: 1, lang: null, boardColors: "theme", easyFont: false, reduceMotion: false, markShapes: false },
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
    usageId: `u${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`,
    review: {},
    practiceNext: [],
    endgames: {},
    activeChild: null,
    parked: {},
    parentPin: null,
    quests: emptyQuests(),
    vision: {},
    ideas: {},
    mistakes: [],
    aiExplain: {},
    termsAt: null,
    ratings: emptyRatings(),
    ratingQueue: [],
    writeQueue: [],
    pendingCelebrations: [],
    celebrated: [],
    habit: emptyHabit(),
  };
}

function cleanProfile(base: Profile, raw: Partial<Profile> | undefined): Profile {
  const next = { ...base, ...(raw ?? {}) };
  return { ...next, avatar: isAvatarId(next.avatar) ? next.avatar : base.avatar, flair: isFlairId(next.flair) ? next.flair : null, country: isCountry(next.country) ? next.country : null };
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
    progress: isProgress(r.progress) ? sanitizeProgress({ ...base.progress, ...r.progress }, null) : base.progress,
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
    usageId: typeof r.usageId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(r.usageId) ? r.usageId : base.usageId,
    review: isReview(r.review) ? r.review : {},
    activeChild: typeof r.activeChild === "string" && r.parked?.main ? r.activeChild : null,
    parked: r.parked && typeof r.parked === "object" && (typeof r.activeChild !== "string" || r.parked.main) ? r.parked : {},
    parentPin: typeof r.parentPin === "string" && /^\d{4}$/.test(r.parentPin) ? r.parentPin : null,
    endgames: r.endgames && typeof r.endgames === "object" ? Object.fromEntries(Object.entries(r.endgames).filter(([, n]) => typeof n === "number")) : {},
    quests: hydrateQuests(r.quests),
    ideas: isReview(r.ideas) ? r.ideas : {},
    vision: r.vision && typeof r.vision === "object" ? Object.fromEntries(Object.entries(r.vision).filter(([, n]) => typeof n === "number")) : {},
    mistakes: Array.isArray(r.mistakes) ? r.mistakes.filter(isMistake).slice(0, MISTAKES_MAX) : [],
    aiExplain: r.aiExplain && typeof r.aiExplain === "object" ? Object.fromEntries(Object.entries(r.aiExplain).filter(([, v]) => typeof v === "boolean")) : {},
    termsAt: typeof r.termsAt === "string" ? r.termsAt : null,
    ratings: sanitizeRatings(r.ratings),
    ratingQueue: sanitizeRatingQueue(r.ratingQueue),
    writeQueue: sanitizeWriteQueue(r.writeQueue),
    pendingCelebrations: sanitizeCelebrations(r.pendingCelebrations),
    celebrated: sanitizeCelebrated(r.celebrated),
    habit: hydrateHabit(r.habit),
    practiceNext: Array.isArray(r.practiceNext) ? r.practiceNext.filter((i) => i && typeof i.ref === "string" && i.step && typeof i.step === "object").slice(0, PRACTICE_KEEP) : [],
  };
}

const isDayKey = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Reads stored habit state; anything malformed is dropped. */
export function hydrateHabit(raw: unknown): Habit {
  const base = emptyHabit();
  if (!raw || typeof raw !== "object") return base;
  const h = raw as Partial<Habit>;
  const hours = Object.entries(h.playHours && typeof h.playHours === "object" ? h.playHours : {})
    .filter(([d, n]) => isDayKey(d) && Number.isInteger(n) && n >= 0 && n < 24)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, PLAY_HOURS_MAX);
  const r = h.streakRepair;
  const repair = r && isDayKey(r.missed) && Number.isInteger(r.prev) && r.prev > 0 && Number.isInteger(r.lessons) ? { missed: r.missed, prev: Math.min(10_000, r.prev), lessons: Math.max(0, Math.min(REPAIR_LESSONS, r.lessons)) } : null;
  const m = h.mate;
  const tries = m && Array.isArray(m.tries) ? m.tries.filter((t) => Array.isArray(t) && t.length <= 2 && t.every((x) => typeof x === "boolean")).slice(0, 3) : [];
  return {
    playHours: Object.fromEntries(hours),
    streakRepair: repair,
    mate: m && isDayKey(m.day) ? { day: m.day, tries, solved: m.solved === true, done: m.done === true } : null,
    ...(Array.isArray(h.weeks) ? { weeks: sanitizeWeeks(h.weeks) } : {}),
    ...(isDayKey(h.recapSeen) ? { recapSeen: h.recapSeen } : {}),
  };
}

/** Piece sets ChessSchool still ships. Keep in step with `PieceSetId` in @chessschool/chess. */
const KEPT_PIECE_SETS = new Set(["toy", "staunton", "flat", "chaturanga", "geometric", "bubble"]);

function hydratePrefs(base: Prefs, raw: unknown): Prefs {
  const p = { ...base, ...((raw as Partial<Prefs>) ?? {}) };
  return {
    ...p,
    // A saved state predates the Sunset default, so a missing or unknown theme stays Classroom.
    theme: isThemeId((raw as Partial<Prefs> | undefined)?.theme) ? p.theme : "classroom",
    pieceSet: typeof p.pieceSet === "string" && KEPT_PIECE_SETS.has(p.pieceSet) ? p.pieceSet : "toy",
    coords: p.coords !== false,
    legalDots: p.legalDots !== false,
    promotion: p.promotion === "queen" ? "queen" : "ask",
    appIcon: typeof p.appIcon === "string" ? p.appIcon : "classroom",
    reminderHour: typeof p.reminderHour === "number" && p.reminderHour >= 0 && p.reminderHour < 24 ? p.reminderHour : 18,
    shareUsage: p.shareUsage !== false,
    coach: isCoachId(p.coach) ? p.coach : null,
    voice: p.voice !== false,
    voiceSpeed: (VOICE_SPEEDS as readonly number[]).includes(p.voiceSpeed) ? p.voiceSpeed : 1,
    lang: isLang(p.lang) ? p.lang : null,
    boardColors: isBoardColors(p.boardColors) ? p.boardColors : "theme",
    easyFont: p.easyFont === true,
    reduceMotion: p.reduceMotion === true,
    markShapes: p.markShapes === true,
  };
}

const isMoves = (v: unknown): v is string[] => Array.isArray(v) && v.length < 600 && v.every((m) => typeof m === "string");
function isSetup(v: unknown): v is StoredSetup {
  const s = v as StoredSetup;
  return Boolean(s && typeof s === "object" && s.opponent && (s.you === "w" || s.you === "b") && typeof s.startFen === "string");
}
const SQ = /^[a-h][1-8]$/;
function isMistake(v: unknown): v is MistakePosition {
  const m = v as MistakePosition;
  return Boolean(m && typeof m.ref === "string" && typeof m.fen === "string" && SQ.test(m.from) && SQ.test(m.to) && typeof m.better === "string");
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

/** Today's activity extends the streak; missed days are covered by freezes while there are enough. */
export function streakAfterActivity(streak: Streak, today: string): Streak {
  const freezes = streak.freezes ?? 0;
  if (!streak.lastDay) return withFreezes({ count: 1, lastDay: today }, freezes);
  const gap = daysBetween(streak.lastDay, today);
  if (gap <= 0) return streak;
  const missed = gap - 1;
  if (missed > freezes) return withFreezes({ count: 1, lastDay: today }, freezes);
  const count = streak.count + 1;
  const earned = count % 7 === 0 ? 1 : 0;
  return withFreezes({ count, lastDay: today }, Math.min(FREEZE_MAX, freezes - missed + earned));
}

/** Streak to show today: alive through the day after its last activity, plus one day per freeze. */
export function visibleStreak(streak: Streak, today: string): number {
  if (!streak.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, today);
  return gap - 1 <= (streak.freezes ?? 0) ? streak.count : 0;
}

/** The day `n` days after (or before, for negative `n`) a day key. */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** A streak that today's first activity would break, when exactly one day was missed with no freeze to cover it. */
function breakingStreak(streak: Streak, today: string): StreakRepair | null {
  if (!streak.lastDay || streak.count < 2 || (streak.freezes ?? 0) > 0 || daysBetween(streak.lastDay, today) !== 2) return null;
  return { missed: shiftDay(streak.lastDay, 1), prev: streak.count, lessons: 0 };
}

/** The streak repair on offer today: finish REPAIR_LESSONS lessons to bring the old streak back. */
export function repairOffer(state: LocalState, today: string): StreakRepair | null {
  const r = state.habit.streakRepair;
  if (r) {
    const age = daysBetween(r.missed, today);
    if (age >= 1 && age <= REPAIR_DAYS) return r;
  }
  return breakingStreak(state.progress.streak, today);
}

/** Median local hour of the recent active days (at least 3), or null to keep the chosen reminder hour. */
export function usualHour(state: LocalState): number | null {
  const hours = Object.values(state.habit.playHours).sort((a, b) => a - b);
  return hours.length >= 3 ? hours[Math.floor((hours.length - 1) / 2)] : null;
}

/**
 * One activity's effect on the streak: extends it, opens or completes a repair, records the play
 * hour, and queues a milestone celebration the first time the streak reaches one.
 */
function streakStep(state: LocalState, now: Date, lesson: boolean): { streak: Streak; habit: Habit } {
  const today = dayKey(now);
  let repair = repairOffer(state, today);
  let streak = streakAfterActivity(state.progress.streak, today);
  if (repair && lesson) repair = { ...repair, lessons: repair.lessons + 1 };
  if (repair && repair.lessons >= REPAIR_LESSONS) {
    streak = withFreezes({ count: repair.prev + 1 + streak.count, lastDay: streak.lastDay }, streak.freezes ?? 0);
    repair = null;
  }
  const h = state.habit;
  const playHours = today in h.playHours ? h.playHours : Object.fromEntries([[today, now.getHours()] as const, ...Object.entries(h.playHours)].sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, PLAY_HOURS_MAX));
  return { streak, habit: { ...h, playHours, streakRepair: repair } };
}

export function minutesToday(progress: Progress, today: string): number {
  return progress.minutes.day === today ? progress.minutes.value : 0;
}

/* ---------- path ---------- */

export type UnitId = `unit${number}`;
export type PathNodeDef = { id: string; unit: UnitId; minutes: number; xp: number; available: boolean };

/**
 * The path this build ships, used offline and as the client default. The live course, and the
 * path the server checks progress against, come from the API database (cs_course_lessons).
 */
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
  { id: "squareOfPawn", unit: "unit12", minutes: 5, xp: 25, available: true },
  { id: "keySquares", unit: "unit12", minutes: 5, xp: 25, available: true },
  { id: "rookPawn", unit: "unit12", minutes: 5, xp: 25, available: true },
  { id: "triangulation", unit: "unit12", minutes: 5, xp: 25, available: true },
  { id: "pawnBreak", unit: "unit12", minutes: 5, xp: 25, available: true },
  { id: "lucena", unit: "unit13", minutes: 6, xp: 30, available: true },
  { id: "philidor", unit: "unit13", minutes: 6, xp: 30, available: true },
  { id: "cutOff", unit: "unit13", minutes: 5, xp: 25, available: true },
  { id: "rookVsPawn", unit: "unit13", minutes: 5, xp: 25, available: true },
  { id: "activityRook", unit: "unit13", minutes: 5, xp: 25, available: true },
  { id: "overload", unit: "unit14", minutes: 6, xp: 25, available: true },
  { id: "deflection", unit: "unit14", minutes: 6, xp: 25, available: true },
  { id: "interference", unit: "unit14", minutes: 5, xp: 25, available: true },
  { id: "zwischenzug", unit: "unit14", minutes: 6, xp: 25, available: true },
  { id: "attraction", unit: "unit14", minutes: 6, xp: 25, available: true },
  { id: "windmill", unit: "unit14", minutes: 6, xp: 25, available: true },
  { id: "greekGift", unit: "unit15", minutes: 6, xp: 30, available: true },
  { id: "oppositeCastle", unit: "unit15", minutes: 5, xp: 25, available: true },
  { id: "pawnStorm", unit: "unit15", minutes: 5, xp: 25, available: true },
  { id: "liftRook", unit: "unit15", minutes: 5, xp: 25, available: true },
  { id: "battery", unit: "unit15", minutes: 5, xp: 25, available: true },
  { id: "queensGambit", unit: "unit16", minutes: 6, xp: 25, available: true },
  { id: "sicilianIdea", unit: "unit16", minutes: 6, xp: 25, available: true },
  { id: "frenchCaro", unit: "unit16", minutes: 5, xp: 25, available: true },
  { id: "developmentRace", unit: "unit16", minutes: 5, xp: 20, available: true },
  { id: "openingTraps", unit: "unit16", minutes: 6, xp: 25, available: true },
  { id: "outpost", unit: "unit17", minutes: 5, xp: 25, available: true },
  { id: "goodBishop", unit: "unit17", minutes: 5, xp: 25, available: true },
  { id: "spaceAdvantage", unit: "unit17", minutes: 5, xp: 25, available: true },
  { id: "exchanges", unit: "unit17", minutes: 5, xp: 25, available: true },
  { id: "prophylaxis", unit: "unit17", minutes: 5, xp: 25, available: true },
  { id: "convertExtra", unit: "unit18", minutes: 5, xp: 25, available: true },
  { id: "whenToDraw", unit: "unit18", minutes: 5, xp: 25, available: true },
  { id: "defence", unit: "unit18", minutes: 5, xp: 25, available: true },
  { id: "calculation", unit: "unit18", minutes: 6, xp: 25, available: true },
];
export const UNITS: readonly UnitId[] = ["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7", "unit8", "unit9", "unit10", "unit11", "unit12", "unit13", "unit14", "unit15", "unit16", "unit17", "unit18"];

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

/** A lesson's size as GET /v1/course serves it, for lessons newer than this build. */
export type LessonMeta = { xp: number; minutes: number };

const clampInt = (n: number, max: number) => (Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);

/**
 * Marks a lesson done. Lessons this build does not ship use `meta` from the served course (the server re-checks XP).
 * `perfect` (no miss, no hint) adds PERFECT_BONUS XP the first time for that lesson.
 */
export function completeNode(state: LocalState, nodeId: string, now: Date, meta?: LessonMeta, perfect = false): LocalState {
  const node = PATH.find((n) => n.id === nodeId) ?? (meta ? { xp: clampInt(meta.xp, 100), minutes: clampInt(meta.minutes, 60) } : null);
  if (!node) return state;
  const today = dayKey(now);
  const first = !state.progress.completed[nodeId];
  const prevMinutes = minutesToday(state.progress, today);
  const prevPerfect = state.progress.perfect ?? [];
  const bonus = perfect && !prevPerfect.includes(nodeId);
  const { streak, habit } = streakStep(state, now, true);
  return trackQuests({
    ...state,
    arrival: null,
    habit,
    ideas: first ? seedIdea(state.ideas, nodeId, today) : state.ideas,
    progress: {
      ...state.progress,
      completed: first ? { ...state.progress.completed, [nodeId]: today } : state.progress.completed,
      xp: state.progress.xp + (first ? node.xp : 0) + (bonus ? PERFECT_BONUS : 0),
      ...(bonus ? { perfect: [...prevPerfect, nodeId] } : {}),
      ...withSkills(first ? skillsAfter(state.progress.skills ?? {}, skillOf(nodeId), true) : state.progress.skills),
      streak,
      minutes: { day: today, value: Math.min(1440, prevMinutes + node.minutes) },
    },
  }, today, { lessons: 1, early: now.getHours() < 9 ? 1 : 0, perfect: perfect ? 1 : 0 });
}

const skillOf = (lessonId: string): SkillId[] => {
  const id = lessonSkill(lessonId);
  return id ? [id] : [];
};
/** Leaves `skills` out until there is one, so stored progress keeps its old shape. */
const withSkills = (skills: Skills | undefined): { skills?: Skills } => (skills && Object.keys(skills).length ? { skills } : {});

/** Practice and games count toward the streak and today's goal, but never add XP. */
function activity(state: LocalState, now: Date, minutes: number): LocalState {
  const today = dayKey(now);
  const { streak, habit } = streakStep(state, now, false);
  return {
    ...state,
    arrival: null,
    habit,
    progress: {
      ...state.progress,
      streak,
      minutes: { day: today, value: Math.min(1440, minutesToday(state.progress, today) + Math.max(1, Math.round(minutes))) },
    },
  };
}

export function recordPractice(state: LocalState, now: Date, minutes = 3): LocalState {
  const s = activity(state, now, minutes);
  return trackQuests({ ...s, progress: { ...s.progress, drills: s.progress.drills + 1 } }, dayKey(now), { practice: 1 });
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
  const start = game.setup.startId;
  return trackQuests({
    ...s,
    activeGame: null,
    endgames: won && start ? { ...s.endgames, [start]: (s.endgames[start] ?? 0) + 1 } : s.endgames,
    gameLog: [game, ...s.gameLog.filter((x) => x.id !== game.id)].slice(0, GAME_LOG_MAX),
    progress: {
      ...s.progress,
      games: { played: g.played + 1, won: g.won + (won ? 1 : 0) },
      bots: bot && b ? { ...s.progress.bots, [bot]: { played: b.played + 1, won: b.won + (won ? 1 : 0) } } : s.progress.bots,
    },
  }, dayKey(now), { games: 1, wins: won ? 1 : 0, winBlack: won && game.setup.you === "b" ? 1 : 0, cleanWin: won && !opponentCaptured(game) ? 1 : 0, endgame: won && start ? 1 : 0 });
}

/** Whether the other side took anything during the game (SAN captures contain "x"). */
function opponentCaptured(game: GameRecord): boolean {
  const firstIsYou = (game.setup.startFen.split(" ")[1] ?? "w") === game.setup.you;
  return game.history.some((san, i) => (i % 2 === 0) !== firstIsYou && san.includes("x"));
}

/** A puzzle attempt. Solving counts as a little practice; the new rating comes from the caller. */
export function recordPuzzle(state: LocalState, p: { id: string; solved: boolean; newRating: number; daily?: boolean; themes?: readonly string[] }, now: Date): LocalState {
  const today = dayKey(now);
  const s = p.solved ? activity(state, now, 1) : state;
  const pz = s.progress.puzzles;
  const prevSeen = pz.daily?.seen ?? [];
  const seen = capSeen(p.daily && p.solved ? [p.id, ...prevSeen.filter((id) => id !== p.id)] : prevSeen);
  // The day is done only once the daily puzzle is solved, so a miss can be tried again.
  const daily =
    p.daily && p.solved && pz.daily.lastDay !== today
      ? dailyStreakAfter({ ...pz.daily, seen, servedDay: today, servedId: p.id }, today)
      : { ...pz.daily, seen, ...(p.daily && p.solved ? { servedDay: today, servedId: p.id } : {}) };
  return trackQuests({
    ...s,
    progress: {
      ...s.progress,
      ...withSkills(skillsAfter(s.progress.skills ?? {}, themeSkills(p.themes ?? []), p.solved)),
      puzzles: {
        ...pz,
        rating: Math.round(Math.max(100, Math.min(3000, p.newRating))),
        attempts: pz.attempts + 1,
        solved: pz.solved + (p.solved ? 1 : 0),
        recent: [p.id, ...pz.recent.filter((id) => id !== p.id)].slice(0, PUZZLE_RECENT),
        daily,
      },
    },
  }, today, { puzzles: p.solved ? 1 : 0, ...(p.solved ? Object.fromEntries((p.themes ?? []).map((t) => [`t_${t}`, 1])) : {}) });
}

export function recordSprint(state: LocalState, score: number, now: Date, minutes: number): LocalState {
  const s = activity(state, now, minutes);
  const pz = s.progress.puzzles;
  return trackQuests({ ...s, progress: { ...s.progress, puzzles: { ...pz, sprintBest: Math.max(pz.sprintBest, score) } } }, dayKey(now), { puzzles: Math.max(0, Math.floor(score)), sprint: Math.max(0, Math.floor(score)) });
}

/** Best "in a row" from a lesson or practice run, for the combo quests. */
export const recordCombo = (state: LocalState, best: number, now: Date): LocalState => trackQuests(state, dayKey(now), { combo: Math.max(0, Math.floor(best)) });

/** Keeps the best board-vision score per game and counts the round (and its seconds) for today's quests. */
export function recordVision(state: LocalState, game: string, score: number, now: Date = new Date(), seconds = 30): LocalState {
  const s = score > (state.vision[game] ?? 0) ? { ...state, vision: { ...state.vision, [game]: score } } : state;
  return trackQuests(s, dayKey(now), { vision: 1, visionSec: Math.max(0, Math.round(seconds)) });
}

/** A flashcard answer: schedules the card and counts it for today's quests. */
export const answerIdeaCard = (state: LocalState, lessonId: string, remembered: boolean, now: Date): LocalState =>
  trackQuests({ ...state, ideas: reviewAfter(state.ideas, ideaRef(lessonId), !remembered, dayKey(now)) }, dayKey(now), { cards: 1 });

/* ---------- mate of the day ---------- */

/** Tries allowed for the mate of the day; each try is a row in the share grid. */
export const MATE_TRIES = 3;
/** The mate-of-the-day result on this device, once per day. A solve also counts as a little practice. */
export function recordMateTry(state: LocalState, day: string, moves: boolean[], now: Date): LocalState {
  const prev = state.habit.mate?.day === day ? state.habit.mate : { day, tries: [], solved: false, done: false };
  if (prev.done) return state;
  const tries = [...prev.tries, moves.slice(0, 2)];
  const solved = moves.length === 2 && moves.every(Boolean);
  const done = solved || tries.length >= MATE_TRIES;
  const s: LocalState = { ...state, habit: { ...state.habit, mate: { day, tries, solved, done } } };
  return solved ? trackQuests(activity(s, now, 1), dayKey(now), { mate: 1 }) : s;
}

export const dailyDone = (progress: Progress, today: string) => progress.puzzles.daily.lastDay === today;

type Daily = PuzzleProgress["daily"];
/** Today's daily solve extends the daily streak; missed days use its freezes (earned like the main streak's). */
export function dailyStreakAfter(daily: Daily, today: string): Daily {
  const { served, ...rest } = daily;
  const next = streakAfterActivity({ count: daily.count, lastDay: daily.lastDay, freezes: daily.freezes }, today);
  const { freezes, ...base } = { ...rest, count: next.count, lastDay: next.lastDay, freezes: next.freezes ?? 0 };
  return { ...base, ...(served ? { served } : {}), ...(freezes > 0 ? { freezes } : {}) };
}

/** The daily-puzzle streak to show today (alive through tomorrow, plus a day per freeze). */
export const visibleDailyStreak = (progress: Progress, today: string) => {
  const d = progress.puzzles.daily;
  return visibleStreak({ count: d.count, lastDay: d.lastDay, freezes: d.freezes }, today);
};

/** Remember the puzzle shown for this local day so it is not served again. No-op when that id is already stored. */
export function serveDaily(state: LocalState, day: string, id: string, puzzle?: { id: string; fen: string; moves: readonly string[]; rating: number; themes: readonly string[] } | null): LocalState {
  const daily = state.progress.puzzles.daily ?? { lastDay: null, count: 0 };
  const snap = puzzle && puzzle.id === id ? validSnapshot(puzzle) : null;
  if (daily.servedDay === day && daily.servedId === id && (!snap || daily.served?.id === id)) return state;
  const seen = capSeen([id, ...(daily.seen ?? []).filter((x) => x !== id)]);
  const served = snap ?? (daily.served?.id === id ? daily.served : undefined);
  return {
    ...state,
    progress: {
      ...state.progress,
      puzzles: { ...state.progress.puzzles, daily: { ...daily, seen, servedDay: day, servedId: id, ...(served ? { served } : {}) } },
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

/**
 * Placement quiz result: every lesson before `startAt` (course order) counts as known, without XP.
 * The puzzle rating starts higher the further in the learner starts, if they haven't played puzzles.
 */
export function placeBefore(state: LocalState, order: readonly string[], startAt: string, now: Date): LocalState {
  const cut = order.indexOf(startAt);
  const skip = cut < 0 ? order : order.slice(0, cut);
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
  const share = order.length ? skip.length / order.length : 0;
  const rating = pz.attempts === 0 ? Math.round(600 + 900 * share) : pz.rating;
  return { ...state, placementDone: true, progress: { ...state.progress, completed, placed: [...placed], puzzles: { ...pz, rating } } };
}

/** Where the quiz starts the learner: the lesson of the first item they missed, or the one after the last item. */
export function placementStart(order: readonly string[], items: readonly string[], firstMiss: number | null): string | null {
  if (firstMiss !== null) return items[firstMiss] ?? null;
  const last = order.indexOf(items[items.length - 1] ?? "");
  return last >= 0 ? (order[last + 1] ?? null) : null;
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
  if (last && last < today && state.progress.streak.count > 0) arrival = visibleStreak(state.progress.streak, today) > 0 ? "kept" : "fresh";
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
  // The learner's usual play time once there are a few active days; the chosen hour until then.
  const hour = usualHour(state) ?? state.prefs.reminderHour;
  const today = dayKey(now);
  for (let i = 0; i < days + 1 && out.length < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0, 0);
    if (i === 0 && (at <= now || goalMet(state.progress, state.profile.dailyMinutes, today))) continue;
    out.push(at);
  }
  return out;
}

export function ideasLearned(progress: Progress): number {
  return Object.keys(progress.completed).length;
}

/* ---------- ranks ---------- */

/**
 * XP only comes from lessons (10-30 each, +5 for a perfect first run): the full course is about 5,200 XP
 * (6,200 with every perfect bonus). A regular learner finishes one or two lessons a day (~30-40 XP),
 * so the steps grow smoothly: Knight with the first unit (125 XP), Bishop after a few weeks, Rook in ~1-2 months,
 * Queen in ~2-3 months and King after ~4 months (about three quarters of the course).
 * Changing these never celebrates a rank down: celebrations only fire when the rank goes up.
 */
export const RANKS = [
  { id: "pawn", xp: 0 },
  { id: "knight", xp: 120 },
  { id: "bishop", xp: 500 },
  { id: "rook", xp: 1200 },
  { id: "queen", xp: 2400 },
  { id: "king", xp: 4000 },
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
    la === lb
      ? withFreezes({ count: Math.max(a.streak.count, b.streak.count), lastDay: a.streak.lastDay }, Math.max(a.streak.freezes ?? 0, b.streak.freezes ?? 0))
      : la > lb
        ? a.streak
        : b.streak;
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
        ...(dA === dB ? { lastDay: dayA.lastDay, count: Math.max(dayA.count, dayB.count) } : { lastDay: (dA > dB ? dayA : dayB).lastDay, count: (dA > dB ? dayA : dayB).count }),
        ...withDailyFreezes(dA === dB ? Math.max(dayA.freezes ?? 0, dayB.freezes ?? 0) : ((dA > dB ? dayA : dayB).freezes ?? 0)),
        seen,
        servedDay: (dA >= dB ? dayA.servedDay : dayB.servedDay) ?? null,
        servedId: (dA >= dB ? dayA.servedId : dayB.servedId) ?? null,
        ...(validSnapshot((dA >= dB ? dayA : dayB).served) ? { served: validSnapshot((dA >= dB ? dayA : dayB).served)! } : {}),
      },
    },
    bots,
    placed: [...new Set([...(a.placed ?? []), ...(b.placed ?? [])])],
    ...withSkills(mergeSkills(a.skills, b.skills)),
    ...withPerfect([...new Set([...(a.perfect ?? []), ...(b.perfect ?? [])])]),
  };
}

const withDailyFreezes = (n: number): { freezes?: number } => (n > 0 ? { freezes: Math.min(FREEZE_MAX, n) } : {});

/** Leaves `perfect` out until there is one, so stored progress keeps its old shape. */
const withPerfect = (ids: string[]): { perfect?: string[] } => (ids.length ? { perfect: ids } : {});

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

/** One lesson of the path, as far as progress checks need it. */
export type PathStep = { id: string; xp: number; available?: boolean };

/** Upper bound on XP when there is no path to measure it against. */
const XP_CEILING = 1_000_000;

/**
 * Cleans a progress record. With a `path` (the server, from its course tables), completions only
 * count in path order and XP is capped by the lessons done, so a client cannot inflate progress.
 * With `null` (the apps), any well-formed completion is kept: the course comes from the API and
 * may hold lessons this build has never heard of, and the server re-checks every save anyway.
 */
export function sanitizeProgress(p: Progress, path: readonly PathStep[] | null): Progress {
  const completed: Record<string, string> = {};
  const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  let xpCap = path ? 0 : XP_CEILING;
  if (path) {
    // Lessons only count in path order: a completion after a gap can't have been earned.
    for (const n of path) {
      const day = p.completed[n.id];
      if (n.available === false || !isDay(day)) break;
      completed[n.id] = day;
      xpCap += n.xp;
    }
  } else {
    for (const [id, day] of Object.entries(p.completed)) if (id.length <= 64 && isDay(day)) completed[id] = day;
  }
  const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const count = (n: unknown, max = 100_000) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);
  const played = count(p.games?.played);
  // A perfect lesson must be a finished one; each adds its bonus to what the XP may reach.
  const perfect = Array.isArray(p.perfect) ? [...new Set(p.perfect.filter((id) => typeof id === "string" && completed[id]))] : [];
  if (path) xpCap += perfect.length * PERFECT_BONUS;
  return {
    completed,
    xp: Math.min(Math.max(0, Math.floor(p.xp)), xpCap),
    // Freezes are earned one per 7 days of streak, so a client can't claim more than that.
    streak: withFreezes(
      { count: Math.max(0, Math.min(10_000, Math.floor(p.streak.count))), lastDay: day(p.streak.lastDay) },
      // No tie to the streak length: freezes are also earned from invites (still never more than FREEZE_MAX).
      Math.min(FREEZE_MAX, count(p.streak.freezes)),
    ),
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
    ...withSkills(sanitizeSkills(p.skills)),
    ...withPerfect(perfect),
  };
}

const SEEN_ID = /^[A-Za-z0-9-]{3,8}$/;

function validSnapshot(raw: unknown): DailyPuzzleSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as DailyPuzzleSnapshot;
  if (typeof p.id !== "string" || !SEEN_ID.test(p.id)) return null;
  if (typeof p.fen !== "string" || !p.fen || p.fen.length > 120) return null;
  if (!Array.isArray(p.moves) || p.moves.length < 2 || p.moves.length > 40 || p.moves.some((m) => typeof m !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) return null;
  if (typeof p.rating !== "number" || !Number.isFinite(p.rating)) return null;
  if (!Array.isArray(p.themes) || p.themes.length > 12 || p.themes.some((t) => typeof t !== "string" || !/^[a-zA-Z][a-zA-Z0-9]{1,31}$/.test(t))) return null;
  return { id: p.id, fen: p.fen, moves: [...p.moves], rating: p.rating, themes: [...p.themes] };
}

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
  const served = validSnapshot(p.daily?.served);
  return {
    rating: typeof p.rating === "number" && Number.isFinite(p.rating) ? Math.max(100, Math.min(3000, Math.round(p.rating))) : base.rating,
    attempts,
    solved: Math.min(attempts, n(p.solved, 1_000_000)),
    recent: Array.isArray(p.recent) ? p.recent.filter((id) => typeof id === "string" && SEEN_ID.test(id)).slice(0, PUZZLE_RECENT) : [],
    sprintBest: n(p.sprintBest, 500),
    daily: {
      lastDay: day(p.daily?.lastDay),
      count: n(p.daily?.count, 10_000),
      seen: capSeen(Array.isArray(p.daily?.seen) ? p.daily.seen : []),
      servedDay: day(p.daily?.servedDay),
      servedId: typeof p.daily?.servedId === "string" && SEEN_ID.test(p.daily.servedId) ? p.daily.servedId : null,
      ...(served && served.id === (typeof p.daily?.servedId === "string" ? p.daily.servedId : "") ? { served } : {}),
      ...withDailyFreezes(n(p.daily?.freezes, FREEZE_MAX)),
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
  | "unit12"
  | "unit13"
  | "unit14"
  | "unit15"
  | "unit16"
  | "unit17"
  | "unit18"
  | "streak3"
  | "streak7"
  | "firstGame"
  | "firstWin"
  | "beatBishop"
  | "puzzles10"
  | "puzzles50"
  | "rating1000"
  | "daily5"
  | "practice5"
  | "bestWin"
  | "highWin";

const unitDone = (p: Progress, unit: UnitId) => PATH.filter((n) => n.unit === unit).every((n) => p.completed[n.id]);

/** Beat a bot rated this much above you for "Best win", and one rated at least HIGH_WIN for "Highest-rated victory". */
export const BEST_WIN_GAP = 100;
export const HIGH_WIN = 1000;

/** `r` (the playing rating) is optional so progress-only callers keep working; rating badges need it. */
export const BADGES: readonly { id: BadgeId; earned: (p: Progress, r?: Ratings) => boolean }[] = [
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
  { id: "unit12", earned: (p) => unitDone(p, "unit12") },
  { id: "unit13", earned: (p) => unitDone(p, "unit13") },
  { id: "unit14", earned: (p) => unitDone(p, "unit14") },
  { id: "unit15", earned: (p) => unitDone(p, "unit15") },
  { id: "unit16", earned: (p) => unitDone(p, "unit16") },
  { id: "unit17", earned: (p) => unitDone(p, "unit17") },
  { id: "unit18", earned: (p) => unitDone(p, "unit18") },
  { id: "streak3", earned: (p) => p.streak.count >= 3 },
  { id: "streak7", earned: (p) => p.streak.count >= 7 },
  { id: "firstGame", earned: (p) => p.games.played >= 1 },
  { id: "firstWin", earned: (p) => p.games.won >= 1 },
  { id: "beatBishop", earned: (p) => ["bishop", "ivy", "atlas", "raja", "cody"].some((b) => (p.bots[b]?.won ?? 0) > 0) },
  { id: "puzzles10", earned: (p) => p.puzzles.solved >= 10 },
  { id: "puzzles50", earned: (p) => p.puzzles.solved >= 50 },
  { id: "rating1000", earned: (p) => p.puzzles.rating >= 1000 && p.puzzles.attempts >= 10 },
  { id: "daily5", earned: (p) => p.puzzles.daily.count >= 5 },
  { id: "practice5", earned: (p) => p.drills >= 5 },
  { id: "bestWin", earned: (_, r) => (r?.upset ?? 0) >= BEST_WIN_GAP },
  { id: "highWin", earned: (_, r) => (r?.bestWin ?? 0) >= HIGH_WIN },
];

export const earnedBadges = (p: Progress, r?: Ratings): BadgeId[] => BADGES.filter((b) => b.earned(p, r)).map((b) => b.id);
/** Earned but not yet celebrated. */
export const newBadges = (s: LocalState): BadgeId[] => earnedBadges(s.progress, s.ratings).filter((id) => !s.badgesSeen.includes(id));

/** Wins in the endgame trainer needed to call a position mastered. */
export const ENDGAME_MASTERY = 3;

/* ---------- skills from practice and the learner's own games ---------- */

/** A practice answer: schedules the review and moves the skill it trains ("<lessonId>:<step>" or a mistake ref). */
export function answerPractice(state: LocalState, ref: string, missed: boolean, today: string): LocalState {
  const mistake = state.mistakes.find((m) => m.ref === ref);
  const ids = mistake ? (mistake.skill ? [mistake.skill] : []) : skillOf(ref.split(":")[0] ?? "");
  return trackQuests({ ...state, review: reviewAfter(state.review, ref, missed, today), progress: { ...state.progress, ...withSkills(skillsAfter(state.progress.skills ?? {}, ids, !missed)) } }, today, { reviews: 1 });
}

/**
 * A reviewed game, counted once: each of the learner's mistakes (with its detector tags) lowers
 * those skills, and the positions join practice from tomorrow.
 */
export function recordReviewedGame(state: LocalState, gameId: string, mistakes: { fen: string; from: string; to: string; better: string; tags: readonly string[] }[], today: string): LocalState {
  const game = state.gameLog.find((g) => g.id === gameId);
  if (!game || game.reviewed) return state;
  let skills = state.progress.skills ?? {};
  let review = state.review;
  const added: MistakePosition[] = [];
  for (const m of mistakes) {
    const ids = tagSkills(m.tags);
    skills = skillsAfter(skills, ids, false);
    if (state.mistakes.some((x) => x.fen === m.fen) || added.some((x) => x.fen === m.fen)) continue;
    const ref = `mistake:${gameId.slice(-12)}:${added.length}`;
    added.push({ ref, fen: m.fen, from: m.from, to: m.to, better: m.better, skill: ids[0] ?? null });
    review = reviewAfter(review, ref, true, today);
  }
  const kept = [...added, ...state.mistakes].slice(0, MISTAKES_MAX);
  const keptRefs = new Set(kept.map((m) => m.ref));
  const dropped = new Set([...added, ...state.mistakes].filter((m) => !keptRefs.has(m.ref)).map((m) => m.ref));
  return trackQuests({
    ...state,
    gameLog: state.gameLog.map((g) => (g.id === gameId ? { ...g, reviewed: true } : g)),
    mistakes: kept,
    review: Object.fromEntries(Object.entries(review).filter(([ref]) => !dropped.has(ref))),
    progress: { ...state.progress, ...withSkills(skills) },
  }, today, { reviewed: 1 });
}

/** A scanned position kept in the review log with no moves yet. */
export const scannedRecord = (fen: string, at: number): GameRecord => ({
  id: `scan:${at}`,
  endedAt: at,
  setup: { opponent: { kind: "friend" }, you: fen.split(" ")[1] === "b" ? "b" : "w", time: "none", startFen: fen, takebacks: false, askPromotion: true },
  history: [],
  winner: null,
  reason: "scanned",
});

/** Adds a game that was not played here (a scanned position) to the review log; it does not count as a game played. */
export function importGame(state: LocalState, game: GameRecord): LocalState {
  return { ...state, gameLog: [game, ...state.gameLog.filter((x) => x.id !== game.id)].slice(0, GAME_LOG_MAX) };
}

/* ---------- premium AI ---------- */

/**
 * AI features (coach explanations, hint reasons, AI bot moves, the board scanner) are a premium entitlement:
 * the one place to gate them later. For now every signed-in learner has it, unless the server switched AI off
 * for the account. Without it, screens show the basic engine analysis.
 */
export const hasPremiumAi = (s: LocalState) => Boolean(s.account) && s.account?.ai !== false && aiCoachOn(s);
/** The learner's own "AI coach" switch in Settings (on unless turned off). */
export const aiCoachOn = (s: LocalState) => s.aiExplain.main !== false;
export const setAiCoach = (s: LocalState, on: boolean): LocalState => ({ ...s, aiExplain: { ...s.aiExplain, main: on } });
export const agreeTerms = (s: LocalState, at: string): LocalState => (s.termsAt ? s : { ...s, termsAt: at });
