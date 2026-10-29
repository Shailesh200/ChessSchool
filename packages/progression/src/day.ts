/**
 * Calendar-day keys for the learning loop (streaks, daily XP, homework, puzzles).
 *
 * Hermes in React Native 0.81 (Expo SDK 54) ships ICU, so `Intl.DateTimeFormat`
 * `timeZone` and `formatToParts` work. A slim Hermes build without timezone data
 * throws; we catch that and fall back to UTC instead of crashing.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `iso` is a real Gregorian YYYY-MM-DD (not just digits and dashes). */
export function isCalendarDay(iso: string): boolean {
  const match = ISO_DAY.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const source = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    source.getUTCFullYear() === year &&
    source.getUTCMonth() === month - 1 &&
    source.getUTCDate() === day
  );
}

export function deviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isValidTimeZone(tz)) return tz;
  } catch {
    // Intl missing, or timezone data stripped from this Hermes build.
  }
  return "UTC";
}

function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(timeZone?: string): string {
  if (timeZone === undefined) return deviceTimeZone();
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD for `date` in an IANA timezone.
 * Omit `timeZone` to use the device/browser zone. Invalid or unavailable zones use UTC.
 */
export function calendarDay(date: Date = new Date(), timeZone?: string): string {
  const zone = resolveTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) {
      return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  } catch {
    // timeZone option unsupported (slim Intl). UTC keeps the app running.
  }
  return utcDay(date);
}

/** Device-local calendar day. Same as `calendarDay`; kept so existing imports work. */
export function isoDay(date: Date = new Date(), timeZone?: string): string {
  return calendarDay(date, timeZone);
}

/**
 * Add calendar days to a YYYY-MM-DD key.
 * Anchored at UTC noon so a 23h/25h DST day cannot skip or repeat a date.
 *
 * Non-ISO or impossible dates (and a non-finite delta) are returned unchanged.
 * Callers compare the result to a stored day, so inventing "today" could
 * continue a streak by accident, and the previous `Date` parse threw RangeError.
 */
export function addDays(iso: string, delta: number): string {
  if (!isCalendarDay(iso) || !Number.isFinite(delta)) return iso;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const next = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0));
  if (Number.isNaN(next.getTime())) return iso;
  return next.toISOString().slice(0, 10);
}

/**
 * Calendar day before `date` in the given (or device) timezone.
 * An invalid Date is treated as "now" so this never throws; the result is still
 * the previous calendar day, not today.
 */
export function yesterday(date: Date = new Date(), timeZone?: string): string {
  const basis =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return addDays(calendarDay(basis, timeZone), -1);
}

/**
 * `?day=` for the daily puzzle and calculation trainer.
 * A missing value is the server UTC day. A present value must be a real
 * YYYY-MM-DD within that day ±1 (every real timezone fits). Anything else
 * is rejected so the route returns 400 — there is no silent fallback.
 */
export function resolveRequestedDay(
  raw: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const server = calendarDay(now, "UTC");
  if (raw == null) return server;
  if (!isCalendarDay(raw)) return null;
  if (raw < addDays(server, -1) || raw > addDays(server, 1)) return null;
  return raw;
}
