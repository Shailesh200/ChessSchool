import { describe, expect, it } from "vitest";
import { analyticsBatchSchema } from "./api-schemas";

describe("analytics props allowlist (DP-X-014)", () => {
  it("rejects nested props objects", () => {
    const parsed = analyticsBatchSchema.safeParse({
      events: [{ name: "lesson_complete", props: { nested: { x: 1 } } }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.events[0]?.props).toBeUndefined();
  });
});
