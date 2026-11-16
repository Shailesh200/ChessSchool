import { describe, expect, it } from "vitest";
import { closesIn, firstName, formLeagues, indiaDay, LEAGUE_SIZE, leagueWeek, nextWeek, settleLeague, weekClosesAt, zoneFor } from "./leagues";

const ist = (local: string) => Date.parse(`${local}+05:30`);

describe("league weeks (India time)", () => {
  it("runs Monday 00:00 to Sunday 23:59:59 in India, whatever the UTC date", () => {
    expect(leagueWeek(ist("2026-11-16T00:00:00"))).toBe("2026-11-16");
    expect(leagueWeek(ist("2026-11-15T23:59:59"))).toBe("2026-11-09");
    expect(leagueWeek(ist("2026-11-22T23:59:59"))).toBe("2026-11-16");
    // 20:00 UTC on Sunday is already Monday 01:30 in India.
    expect(leagueWeek(Date.parse("2026-11-22T20:00:00Z"))).toBe("2026-11-23");
    expect(indiaDay(Date.parse("2026-11-22T18:29:59Z"))).toBe("2026-11-22");
    expect(indiaDay(Date.parse("2026-11-22T18:30:00Z"))).toBe("2026-11-23");
  });

  it("closes at the next Monday midnight in India and counts down to it", () => {
    expect(weekClosesAt("2026-11-16")).toBe(ist("2026-11-23T00:00:00"));
    expect(nextWeek("2026-12-28")).toBe("2027-01-04");
    expect(closesIn("2026-11-16", ist("2026-11-21T20:30:00"))).toEqual({ days: 1, hours: 3, minutes: 30 });
    expect(closesIn("2026-11-16", ist("2026-11-23T00:00:01"))).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});

describe("league zones", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(2, "0")}`, xp: 1000 - i * 10, updatedAt: i }));

  it("moves the top 7 up and the bottom 5 down in a full league", () => {
    const out = settleLeague(rows(30), 2);
    expect(out.filter((r) => r.zone === "up").map((r) => r.userId)).toEqual(["u00", "u01", "u02", "u03", "u04", "u05", "u06"]);
    expect(out.filter((r) => r.zone === "down").map((r) => r.userId)).toEqual(["u25", "u26", "u27", "u28", "u29"]);
    expect(out.find((r) => r.userId === "u00")?.tier).toBe(3);
    expect(out.find((r) => r.userId === "u29")?.tier).toBe(1);
  });

  it("has no relegation in Pawn, no promotion in King, and no overlap in a small league", () => {
    expect(settleLeague(rows(30), 0).some((r) => r.zone === "down")).toBe(false);
    expect(settleLeague(rows(30), 5).some((r) => r.zone === "up")).toBe(false);
    const small = settleLeague(rows(9), 3);
    expect(small.filter((r) => r.zone === "up")).toHaveLength(7);
    expect(small.filter((r) => r.zone === "down").map((r) => r.userId)).toEqual(["u07", "u08"]);
    expect(zoneFor(0, 1, 2, 0)).toBe("stay");
  });

  it("breaks ties by who got there first", () => {
    const out = settleLeague([{ userId: "b", xp: 50, updatedAt: 2 }, { userId: "a", xp: 50, updatedAt: 5 }], 0);
    expect(out.map((r) => r.userId)).toEqual(["b", "a"]);
  });

  it("forms leagues of 30 per tier in join order", () => {
    const players = Array.from({ length: 65 }, (_, i) => ({ userId: `p${i}`, tier: i < 5 ? 1 : 0, joinedAt: 1000 - i }));
    const out = formLeagues(players);
    expect(out.filter((r) => r.tier === 0 && r.group === 1)).toHaveLength(LEAGUE_SIZE);
    expect(out.filter((r) => r.tier === 0 && r.group === 3)).toHaveLength(0);
    expect(out.filter((r) => r.tier === 0 && r.group === 2)).toHaveLength(30);
    expect(out.find((r) => r.userId === "p64")?.group).toBe(1);
    expect(out.filter((r) => r.tier === 1)).toHaveLength(5);
  });

  it("shows only a first name", () => {
    expect(firstName("  Asha  Gupta ")).toBe("Asha");
    expect(firstName("")).toBe("");
  });
});
