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

  it("accepts new funnel event names", () => {
    for (const name of [
      "onboarding_complete",
      "exam_complete",
      "class_graduate",
      "homework_complete",
      "bot_game_start",
      "search_result_open",
      "enroll_cta_click",
      "coach_character_select",
      "journal_reflection",
      "page_view",
    ] as const) {
      expect(
        analyticsBatchSchema.safeParse({ events: [{ name }] }).success,
        name,
      ).toBe(true);
    }
  });

  it("accepts page_view with route props", () => {
    const parsed = analyticsBatchSchema.safeParse({
      events: [
        {
          name: "page_view",
          pathname: "/lesson/pawn-power",
          props: { route: "/lesson/:id", referrer: "direct", authed: false },
        },
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
