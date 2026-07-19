import { describe, expect, it } from "vitest";
import { fillDaySeries } from "@/lib/admin-analytics";

describe("fillDaySeries", () => {
  it("fills zeros for missing days", () => {
    const end = Date.UTC(2026, 6, 19); // Jul 19 2026 UTC
    const series = fillDaySeries(
      3,
      [{ day: "2026-07-19", count: 2 }],
      end,
    );
    expect(series).toEqual([
      { day: "2026-07-17", count: 0 },
      { day: "2026-07-18", count: 0 },
      { day: "2026-07-19", count: 2 },
    ]);
  });
});
