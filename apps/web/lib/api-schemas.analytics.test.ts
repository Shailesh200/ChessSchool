import { describe, expect, it } from "vitest";
import { analyticsBatchSchema, vitalsBatchSchema } from "@/lib/api-schemas";

describe("vitalsBatchSchema", () => {
  it("accepts a valid batch", () => {
    const parsed = vitalsBatchSchema.safeParse({
      metrics: [{ name: "LCP", value: 2100, rating: "good", pathname: "/lesson/foo" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty batches", () => {
    expect(vitalsBatchSchema.safeParse({ metrics: [] }).success).toBe(false);
  });
});

describe("analyticsBatchSchema", () => {
  it("accepts lesson_complete with props", () => {
    const parsed = analyticsBatchSchema.safeParse({
      events: [
        { name: "lesson_complete", props: { lessonId: "pre-board-intro", ratio: 1 } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown event names", () => {
    expect(
      analyticsBatchSchema.safeParse({ events: [{ name: "unknown_event" }] }).success,
    ).toBe(false);
  });
});
