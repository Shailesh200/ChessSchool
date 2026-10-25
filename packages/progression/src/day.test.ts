import { describe, expect, it } from "vitest";
import { addDays, calendarDay, isoDay, resolveRequestedDay, yesterday } from "./day";
import { advanceStreak, mergeProgressSnapshots, registerActivity } from "./index";

const IST = "Asia/Kolkata";
const NY = "America/New_York";

describe("calendarDay", () => {
  it("keeps IST 00:10, 05:29, and 05:31 on the same local day", () => {
    // 2026-07-15 local. UTC rolls at 05:30 IST, so the first two instants are still the previous UTC day.
    const at0010 = new Date("2026-07-14T18:40:00.000Z");
    const at0529 = new Date("2026-07-14T23:59:00.000Z");
    const at0531 = new Date("2026-07-15T00:01:00.000Z");

    expect(at0010.toISOString().slice(0, 10)).toBe("2026-07-14");
    expect(at0529.toISOString().slice(0, 10)).toBe("2026-07-14");
    expect(at0531.toISOString().slice(0, 10)).toBe("2026-07-15");

    expect(calendarDay(at0010, IST)).toBe("2026-07-15");
    expect(calendarDay(at0529, IST)).toBe("2026-07-15");
    expect(calendarDay(at0531, IST)).toBe("2026-07-15");
    expect(isoDay(at0529, IST)).toBe(calendarDay(at0529, IST));
  });

  it("uses the device zone when none is passed", () => {
    const instant = new Date("2026-07-15T12:00:00.000Z");
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(isoDay(instant)).toBe(calendarDay(instant, zone));
  });

  it("falls back to UTC for an invalid zone", () => {
    const at0010Ist = new Date("2026-07-14T18:40:00.000Z");
    expect(calendarDay(at0010Ist, "Not/AZone")).toBe("2026-07-14");
    expect(isoDay(at0010Ist, "Mars/Phobos")).toBe("2026-07-14");
    expect(calendarDay(at0010Ist, IST)).toBe("2026-07-15");
  });

  it("falls back to UTC when Intl cannot resolve a zone", () => {
    const original = Intl.DateTimeFormat;
    const instant = new Date("2026-07-14T18:40:00.000Z");
    Intl.DateTimeFormat = function DateTimeFormat() {
      throw new Error("Intl unavailable");
    } as unknown as typeof Intl.DateTimeFormat;
    try {
      expect(calendarDay(instant)).toBe("2026-07-14");
      expect(calendarDay(instant, IST)).toBe("2026-07-14");
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});

describe("addDays / yesterday (DST-safe)", () => {
  it("steps across a US spring-forward and fall-back without skipping a date", () => {
    // 2026-03-08 02:00 EST jumps to 03:00 EDT. 2026-11-01 02:00 EDT repeats as 01:00 EST.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-03-08", -1)).toBe("2026-03-07");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");

    // Both sides of the spring-forward gap are still March 8 locally.
    expect(calendarDay(new Date("2026-03-08T06:30:00.000Z"), NY)).toBe("2026-03-08");
    expect(calendarDay(new Date("2026-03-08T07:30:00.000Z"), NY)).toBe("2026-03-08");
    // Both 01:30 occurrences on the fall-back day are November 1.
    expect(calendarDay(new Date("2026-11-01T05:30:00.000Z"), NY)).toBe("2026-11-01");
    expect(calendarDay(new Date("2026-11-01T06:30:00.000Z"), NY)).toBe("2026-11-01");

    // 00:30 EDT on March 9. Subtracting 24h lands on March 7 local; calendar yesterday is March 8.
    const justAfter = new Date("2026-03-09T04:30:00.000Z");
    expect(yesterday(justAfter, NY)).toBe("2026-03-08");
    expect(addDays(calendarDay(justAfter, NY), -1)).toBe("2026-03-08");
  });

  it("rolls the year", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("returns non-ISO input unchanged instead of throwing", () => {
    expect(addDays("nope", 1)).toBe("nope");
    expect(addDays("2026-7-15", -1)).toBe("2026-7-15");
    expect(addDays("2026-02-31", 1)).toBe("2026-02-31");
    expect(addDays("2026-07-15", Number.NaN)).toBe("2026-07-15");
    expect(() => addDays("not-a-date", 1)).not.toThrow();
  });

  it("yesterday of an invalid date is the previous calendar day, not a throw", () => {
    const result = yesterday(new Date(Number.NaN), "UTC");
    expect(result).toBe(addDays(isoDay(new Date(), "UTC"), -1));
    expect(() => yesterday(new Date(Number.NaN), IST)).not.toThrow();
  });
});

describe("resolveRequestedDay", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("accepts a strict YYYY-MM-DD within the server UTC day ±1", () => {
    expect(resolveRequestedDay("2026-07-14", now)).toBe("2026-07-14");
    expect(resolveRequestedDay("2026-07-15", now)).toBe("2026-07-15");
    expect(resolveRequestedDay("2026-07-16", now)).toBe("2026-07-16");
  });

  it("uses the server UTC day only when ?day= is missing", () => {
    expect(resolveRequestedDay(null, now)).toBe("2026-07-15");
    expect(resolveRequestedDay(undefined, now)).toBe("2026-07-15");
  });

  it("rejects a bad format, an impossible date, and a day outside ±1", () => {
    expect(resolveRequestedDay("2026-07-13", now)).toBeNull();
    expect(resolveRequestedDay("2026-07-17", now)).toBeNull();
    expect(resolveRequestedDay("2026-07-15T00:00:00Z", now)).toBeNull();
    expect(resolveRequestedDay("2026-7-15", now)).toBeNull();
    expect(resolveRequestedDay("2026-02-30", now)).toBeNull();
    expect(resolveRequestedDay("2026-02-31", now)).toBeNull();
    expect(resolveRequestedDay("2026-07-15 ", now)).toBeNull();
    expect(resolveRequestedDay("", now)).toBeNull();
  });
});

describe("registerActivity across local midnight", () => {
  it("continues a streak when UTC is still the same day", () => {
    // 23:50 IST and 00:10 IST the next calendar day share one UTC date.
    const late = new Date("2026-07-14T18:20:00.000Z");
    const early = new Date("2026-07-14T18:40:00.000Z");
    expect(late.toISOString().slice(0, 10)).toBe(early.toISOString().slice(0, 10));

    const prev = calendarDay(late, IST);
    const next = calendarDay(early, IST);
    expect(prev).toBe("2026-07-14");
    expect(next).toBe("2026-07-15");
    expect(next).toBe(addDays(prev, 1));

    const snap = registerActivity({ streak: 4, lastActiveDay: prev }, next);
    expect(snap.streak).toBe(5);
    expect(snap.lastActiveDay).toBe("2026-07-15");
  });

  it("pulls a stored day exactly one ahead back to today", () => {
    const stored = { streak: 6, lastActiveDay: "2026-07-16" };
    const next = registerActivity(stored, "2026-07-15");
    expect(next.streak).toBe(6);
    expect(next.lastActiveDay).toBe("2026-07-15");
  });

  it("does not grant a free day when a future day is followed by a move back", () => {
    // D → 6, D+1 → 7, back to D keeps 7 and drops the stale +1 key.
    // Jumping on to D+2 must not treat that stale key as yesterday.
    let snap = registerActivity({ streak: 5, lastActiveDay: "2026-07-14" }, "2026-07-15");
    expect(snap.streak).toBe(6);
    snap = registerActivity(snap, "2026-07-16");
    expect(snap.streak).toBe(7);
    expect(snap.lastActiveDay).toBe("2026-07-16");

    const back = registerActivity(snap, "2026-07-15");
    expect(back.streak).toBe(7);
    expect(back.lastActiveDay).toBe("2026-07-15");

    const skipped = registerActivity(back, "2026-07-17");
    expect(skipped.streak).toBe(1);
    expect(skipped.lastActiveDay).toBe("2026-07-17");
  });

  it("[accepted-risk: Arc 2026-10-26] clock toggle +1/back can double count", () => {
    // 6 → 7 → 7 → 8. Moving a day ahead counts it, the pull-back keeps that
    // count, and the same day counts again when it arrives. Three real days
    // of that toggle therefore add 5, not 3.
    // Fix: credit a day only once it has arrived in the user's stored zone
    // (lane D PR D2c). This PR does not change the count.
    const day = "2026-07-15";
    let snap = registerActivity({ streak: 6, lastActiveDay: day }, "2026-07-16");
    expect(snap.streak).toBe(7);
    snap = registerActivity(snap, day);
    expect(snap.streak).toBe(7);
    expect(snap.lastActiveDay).toBe(day);
    snap = registerActivity(snap, "2026-07-16");
    expect(snap.streak).toBe(8);
    expect(snap.lastActiveDay).toBe("2026-07-16");
  });

  it("drops a stored day more than one ahead and restarts on today", () => {
    const yearAhead = registerActivity(
      { streak: 6, lastActiveDay: "2027-07-15" },
      "2026-07-15",
    );
    expect(yearAhead.streak).toBe(1);
    expect(yearAhead.lastActiveDay).toBe("2026-07-15");

    const far = registerActivity({ streak: 9, lastActiveDay: "9999-12-31" }, "2026-07-15");
    expect(far.streak).toBe(1);
    expect(far.lastActiveDay).toBe("2026-07-15");
  });

  it("leaves the snapshot untouched when today is not a calendar day", () => {
    const base = { streak: 4, lastActiveDay: "2026-07-15", xp: 10 };
    expect(registerActivity(base, "nope")).toBe(base);
    expect(registerActivity(base, "2026-02-30")).toBe(base);
    expect(advanceStreak("2026-07-15", "2026-02-31", 4)).toEqual({
      streak: 4,
      day: "2026-07-15",
    });
    const empty = { streak: 0 };
    expect(registerActivity(empty, "not-a-day")).toBe(empty);
  });

  it("does not bump the streak between 05:29 and 05:31 IST", () => {
    const at0529 = calendarDay(new Date("2026-07-14T23:59:00.000Z"), IST);
    const at0531 = calendarDay(new Date("2026-07-15T00:01:00.000Z"), IST);
    expect(at0529).toBe(at0531);
    const base = { streak: 2, lastActiveDay: at0529 };
    expect(registerActivity(base, at0531)).toBe(base);
  });
});

describe("mergeProgressSnapshots lastActiveDay clamp", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("keeps a client day inside the server UTC day ±1", () => {
    const merged = mergeProgressSnapshots(
      { lastActiveDay: "2026-07-16", streak: 4 },
      { lastActiveDay: "2026-07-14", streak: 2 },
      now,
    );
    expect(merged.lastActiveDay).toBe("2026-07-16");
  });

  it("rejects a client day more than one past the server UTC day and keeps the stored day", () => {
    const merged = mergeProgressSnapshots(
      { lastActiveDay: "2026-07-17", streak: 9 },
      { lastActiveDay: "2026-07-14", streak: 3 },
      now,
    );
    expect(merged.lastActiveDay).toBe("2026-07-14");
    expect(merged.streak).toBe(9);
  });

  it("never keeps a day more than one past the server UTC day", () => {
    const merged = mergeProgressSnapshots(
      { lastActiveDay: "9999-12-31" },
      { lastActiveDay: "2027-07-15" },
      now,
    );
    expect(merged.lastActiveDay).toBeNull();
  });
});
