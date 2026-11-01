import {
  canonicalTimeZone,
  capActivityDays,
  capWeaknesses,
  isCalendarDay,
} from "@chess-school/progression";
import { z } from "zod";

/**
 * A calendar day the server can use. A malformed string is dropped as a
 * missing day, not rejected, so one bad field does not fail the whole push.
 * `lastActiveDay` is required to be present (string or null); a bad value is null.
 */
const calendarDayOrNull = z
  .string()
  .nullable()
  .transform((day) => (day !== null && isCalendarDay(day) ? day : null));
/** Optional homework day: absent or malformed is undefined, a real day or null is kept. */
const homeworkDayField = z
  .string()
  .nullable()
  .transform((day) => {
    if (day === null) return day;
    return isCalendarDay(day) ? day : undefined;
  });

/** Integer ms. Below 0 is rejected. A future stamp is clamped to now. */
const writerStamp = z
  .number()
  .int()
  .min(0)
  .transform((stamp) => Math.min(stamp, Date.now()));

/**
 * The client's IANA zone. A zone the server cannot resolve ("GMT+5",
 * "Etc/Unknown", a very long string, a non-string) is dropped, not rejected:
 * the push still succeeds and is merged as if no zone was sent, which keeps
 * the stored streak (see `mergeProgressPush`).
 */
const timeZoneField = z.unknown().transform((zone): string | undefined => {
  if (typeof zone !== "string" || zone.length > 64) return undefined;
  return canonicalTimeZone(zone) ?? undefined;
});

const ACTIVITY_DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WEAKNESS_KEY_LENGTH = 64;

/** Over the cap is cut, not rejected: an old client with a big map must still sync. */
const weaknessMap = z
  .record(z.string(), z.number())
  .transform((map) =>
    capWeaknesses(
      Object.fromEntries(
        Object.entries(map).filter(([key]) => key.length <= MAX_WEAKNESS_KEY_LENGTH),
      ),
    ),
  );
/** A key that is not `YYYY-MM-DD` is dropped, not rejected. */
const activityDayMap = z
  .record(z.string(), z.number())
  .transform((map) =>
    capActivityDays(
      Object.fromEntries(
        Object.entries(map).filter(([key]) => ACTIVITY_DAY_KEY.test(key)),
      ),
    ),
  );

export const authCredentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const authRegisterSchema = authCredentialsSchema.extend({
  name: z.string().trim().min(1).max(80),
});

const lessonRecSchema = z.object({
  mastery: z.number().min(0).max(1),
  attempts: z.number().int().min(0).max(10_000),
  lastSeen: z.number().int().min(0),
  dueAt: z.number().int().min(0),
  incorrect: z.number().int().min(0).optional(),
});

export const progressPushSchema = z.object({
  xp: z.number().int().min(0).max(10_000_000),
  streak: z.number().int().min(0).max(10_000),
  lastActiveDay: calendarDayOrNull,
  graduatedClasses: z.array(z.string().max(64)).max(200),
  lessons: z.record(z.string().max(64), lessonRecSchema),
  rating: z.number().int().min(0).max(4000).optional(),
  botWins: z.number().int().min(0).max(100_000).optional(),
  dailyGoalXp: z.number().int().min(1).max(10_000).optional(),
  unlockedAchievements: z.array(z.string().max(64)).max(200).optional(),
  schoolExamsPassed: z.array(z.string().max(64)).max(50).optional(),
  weaknesses: weaknessMap.optional(),
  activityDays: activityDayMap.optional(),
  mistakeLog: z.array(z.unknown()).max(500).optional(),
  homeworkStreak: z.number().int().min(0).max(10_000).optional(),
  homeworkLastDay: homeworkDayField.optional(),
  ratingUpdatedAt: writerStamp.optional(),
  goalUpdatedAt: writerStamp.optional(),
  tz: timeZoneField.optional(),
  recentGames: z.array(z.unknown()).max(50).optional(),
  dailyPuzzleDay: z.string().max(16).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  homeworkDone: z.record(z.string(), z.array(z.string())).optional(),
  placementDone: z.boolean().optional(),
  journalEntries: z
    .array(
      z.object({
        id: z.string().max(64),
        day: z.string().max(16),
        date: z.number().int(),
        kind: z.enum(["lesson", "match", "review", "exam", "reflection"]),
        title: z.string().max(200),
        confidence: z.number().min(1).max(5),
        note: z.string().max(2000),
        summary: z.string().max(500),
        ref: z.string().nullable(),
      }),
    )
    .max(100)
    .optional(),
});

export type ProgressPushBody = z.infer<typeof progressPushSchema>;

const vitalMetricSchema = z.object({
  name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  value: z.number().finite(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  pathname: z.string().max(256),
  connection: z.string().max(32).optional(),
  navigationType: z.string().max(32).optional(),
});

export const vitalsBatchSchema = z.object({
  metrics: z.array(vitalMetricSchema).min(1).max(12),
});

export const analyticsEventSchema = z.object({
  name: z.enum([
    "page_view",
    "lesson_complete",
    "lesson_start",
    "placement_complete",
    "game_end",
    "match_start",
    "match_end",
    "feature_open",
    "think_puzzle_result",
    "search_open",
    "signup",
    "login",
    "pwa_install",
    "onboarding_complete",
    "exam_complete",
    "class_graduate",
    "homework_complete",
    "online_game_create",
    "online_game_join",
    "bot_game_start",
    "account_delete",
    "journal_reflection",
    "search_result_open",
    "enroll_cta_click",
    "coach_character_select",
  ]),
  props: z.record(z.string(), z.unknown()).optional(),
  pathname: z.string().max(256).optional(),
  sessionId: z.string().max(64).optional(),
});

export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(40),
});

const chessSquare = z.string().regex(/^[a-h][1-8]$/);

/** Online PvP session mutations — seat token required on every action. */
export const sessionPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    seatToken: z.string().min(8).max(256),
    from: chessSquare,
    to: chessSquare,
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
  }),
  z.object({
    action: z.literal("resign"),
    seatToken: z.string().min(8).max(256),
  }),
  z.object({
    action: z.literal("timeout"),
    seatToken: z.string().min(8).max(256),
    color: z.enum(["w", "b"]).optional(),
    seat: z.enum(["w", "b"]).optional(),
  }),
]);

export type SessionPostBody = z.infer<typeof sessionPostSchema>;
