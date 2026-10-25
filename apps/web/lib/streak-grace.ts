import { addDays } from "@chess-school/progression";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * One-time streak grace window.
 *
 * `start` is the first calendar day the window is open (inclusive). Set it —
 * or the `STREAK_GRACE_START` env var — to the day D2 local-time days ship.
 * The window lasts `lengthDays` calendar days, counting `start`.
 */
export const STREAK_GRACE_WINDOW = {
  start: "2026-10-25",
  lengthDays: 7,
} as const;

/** Server-owned marker. Written only by `applyOneTimeStreakGrace`. */
export type StreakGrace = { usedOn: string };

export type StreakGraceInput = {
  storedStreak: number;
  storedLastActiveDay: string | null;
  incomingStreak: number;
  incomingLastActiveDay: string | null;
  /**
   * Streak already chosen by the snapshot merge.
   * Today that is max(stored, incoming), which hides a reset (D-3).
   * D3 will switch this to the streak on the side with the newer
   * `lastActiveDay`. Grace does not trust this number when it applies:
   * it sets `storedStreak + 1`. When it does not apply, this number is
   * returned unchanged, so a later recency merge still resets.
   */
  mergedStreak: number;
  storedGrace?: StreakGrace | null;
  /** Server calendar day the window is checked against. */
  today: string;
  /** Test override. Production uses `STREAK_GRACE_START` or `STREAK_GRACE_WINDOW.start`. */
  graceStart?: string;
};

export function isRealIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  // Reject overflow dates such as 2026-02-30. `addDays` anchors at UTC noon.
  return addDays(value, 0) === value;
}

/** Override, else STREAK_GRACE_START, else the constant. An invalid override does not read the env. */
export function streakGraceStart(override?: string): string {
  if (override !== undefined) {
    const trimmed = override.trim();
    return isRealIsoDay(trimmed) ? trimmed : STREAK_GRACE_WINDOW.start;
  }
  const fromEnv = process.env.STREAK_GRACE_START?.trim();
  if (fromEnv && isRealIsoDay(fromEnv)) return fromEnv;
  return STREAK_GRACE_WINDOW.start;
}

export function isInsideStreakGraceWindow(day: string, start: string): boolean {
  if (!isRealIsoDay(day) || !isRealIsoDay(start)) return false;
  const end = addDays(start, STREAK_GRACE_WINDOW.lengthDays - 1);
  return day >= start && day <= end;
}

/** A stored flag counts as used only when the server wrote a real day. */
export function readStoredStreakGrace(value: unknown): StreakGrace | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usedOn = (value as { usedOn?: unknown }).usedOn;
  if (typeof usedOn !== "string" || !isRealIsoDay(usedOn)) return undefined;
  return { usedOn };
}

function isExactlyOneMissedDay(
  storedDay: string | null,
  incomingDay: string | null,
): boolean {
  if (!storedDay || !incomingDay) return false;
  if (!isRealIsoDay(storedDay) || !isRealIsoDay(incomingDay)) return false;
  // stored 2026-10-20 and incoming 2026-10-22 misses exactly 2026-10-21.
  return addDays(storedDay, 2) === incomingDay;
}

/**
 * Continue a streak that reset after exactly one missed calendar day.
 * At most once per user, and only while `today` is inside the grace window.
 * The returned `streakGrace` is always the server's — never a client value.
 */
export function applyOneTimeStreakGrace(input: StreakGraceInput): {
  streak: number;
  streakGrace?: StreakGrace;
} {
  const storedGrace = readStoredStreakGrace(input.storedGrace);
  const unchanged = { streak: input.mergedStreak, streakGrace: storedGrace };

  if (storedGrace) return unchanged;

  const start = streakGraceStart(input.graceStart);
  if (!isInsideStreakGraceWindow(input.today, start)) return unchanged;

  if (!isExactlyOneMissedDay(input.storedLastActiveDay, input.incomingLastActiveDay)) {
    return unchanged;
  }

  if (input.storedStreak < 1) return unchanged;
  if (input.incomingStreak > 1) return unchanged;

  return {
    streak: input.storedStreak + 1,
    streakGrace: { usedOn: input.today },
  };
}
