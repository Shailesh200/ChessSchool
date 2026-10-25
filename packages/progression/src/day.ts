/**
 * Calendar-day keys for the learning loop (streaks, daily XP, homework, puzzles).
 *
 * Hermes in React Native 0.81 (Expo SDK 54) ships ICU, so `Intl.DateTimeFormat`
 * `timeZone` and `formatToParts` work. A slim Hermes build without timezone data
 * throws; we catch that and fall back to UTC instead of crashing.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

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
 */
export function addDays(iso: string, delta: number): string {
  const match = ISO_DAY.exec(iso);
  if (!match) {
    const fallback = new Date(`${iso}T12:00:00Z`);
    fallback.setUTCDate(fallback.getUTCDate() + delta);
    return fallback.toISOString().slice(0, 10);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}

/** Calendar day before `date` in the given (or device) timezone. */
export function yesterday(date: Date = new Date(), timeZone?: string): string {
  return addDays(calendarDay(date, timeZone), -1);
}

/**
 * True when `stored` is already `today`, or a later real calendar day.
 * A stored day ahead of the local day is timezone skew, not a missed day,
 * so streak logic treats it as the same day instead of a gap.
 */
export function dayAlreadyCovers(
  stored: string | null | undefined,
  today: string,
): boolean {
  if (!stored) return false;
  if (stored === today) return true;
  if (!ISO_DAY.test(stored) || !ISO_DAY.test(today)) return false;
  if (addDays(stored, 0) !== stored || addDays(today, 0) !== today) return false;
  return stored > today;
}
