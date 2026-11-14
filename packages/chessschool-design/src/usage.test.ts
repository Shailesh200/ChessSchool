import { describe, expect, it } from "vitest";
import { createUsage, type UsageBatch } from "./usage";

const setup = (over: { enabled?: () => boolean; fail?: boolean } = {}) => {
  const sent: UsageBatch[] = [];
  const usage = createUsage({
    send: async (b) => {
      if (over.fail) throw new Error("offline");
      sent.push(b);
    },
    install: () => "inst",
    platform: "web",
    appVersion: "1.0.0",
    enabled: over.enabled ?? (() => true),
    delayMs: 60_000,
    now: () => 5,
  });
  return { usage, sent };
};

describe("usage queue", () => {
  it("sends queued events as one batch with the install id", async () => {
    const { usage, sent } = setup();
    usage.track("lesson_start", { lesson: "meet" });
    usage.track("lesson_quit", { lesson: "meet", step: 2 });
    await usage.flush();
    expect(sent).toEqual([{ install: "inst", platform: "web", appVersion: "1.0.0", events: [{ name: "lesson_start", at: 5, lesson: "meet" }, { name: "lesson_quit", at: 5, lesson: "meet", step: 2 }] }]);
    expect(usage.pending()).toBe(0);
  });

  it("queues nothing while sharing is off", async () => {
    const { usage, sent } = setup({ enabled: () => false });
    usage.track("app_open");
    await usage.flush();
    expect(sent).toEqual([]);
    expect(usage.pending()).toBe(0);
  });

  it("keeps a failed batch for the next try", async () => {
    const { usage } = setup({ fail: true });
    usage.track("app_open");
    await usage.flush();
    expect(usage.pending()).toBe(1);
  });
});
