import { describe, expect, it } from "vitest";
import { cleanProps, createPulse, screenPath } from "./pulse";

describe("pulse analytics", () => {
  it("keeps ids and numbers, drops free text, emails and personal keys", () => {
    expect(cleanProps({ bot: "rex", result: "win", moves: 31.456, rated: true, lang: "hi" })).toEqual({ bot: "rex", result: "win", moves: 31.46, rated: true, lang: "hi" });
    expect(cleanProps({ who: "asha@example.com", note: "x", name: "Asha", text: "hello there", userId: "u1", step: 2 })).toEqual({ step: 2 });
    expect(cleanProps({ a: "has spaces in it" })).toBeUndefined();
    expect(screenPath("/c/abc234?seat=xyz")).toBe("/c/:id");
    expect(screenPath("/lesson/forks")).toBe("/lesson/forks");
  });

  it("queues, sends in small batches, and sends nothing when off or unconfigured", async () => {
    const posts: { url: string; body: any }[] = [];
    let enabled = true;
    const p = createPulse({ websiteId: "site", hostname: "app.chess-school.in", post: async (url, body) => posts.push({ url, body: JSON.parse(body) }), enabled: () => enabled, delayMs: 10_000 });
    p.screen("/today");
    p.event("lesson_start", { lesson: "forks" });
    p.event("not_an_event" as never);
    expect(posts).toHaveLength(0);
    expect(p.pending()).toBe(2);
    await p.flush();
    expect(posts.map((x) => x.url)).toEqual(["https://pulse.shaileshjha.in/api/send", "https://pulse.shaileshjha.in/api/send"]);
    expect(posts[1]!.body.payload).toMatchObject({ website: "site", url: "/today", name: "lesson_start", data: { lesson: "forks" } });
    enabled = false;
    p.event("share");
    expect(p.pending()).toBe(0);
    const none = createPulse({ websiteId: "", hostname: "x", post: async () => posts.push({ url: "", body: null }), enabled: () => true });
    none.event("share");
    await none.flush();
    expect(posts).toHaveLength(2);
  });
});
