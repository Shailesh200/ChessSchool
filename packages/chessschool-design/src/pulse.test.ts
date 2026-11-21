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

describe("pulse event mapping", () => {
  it("maps usage events, bot games and settings without personal data", async () => {
    const { pulseForUsage, botGameProps, settingsProps } = await import("./pulse");
    expect(pulseForUsage("lesson_start", { lesson: "meet" })).toEqual(["first_lesson_start", { lesson: "meet" }]);
    expect(pulseForUsage("lesson_finish", { lesson: "forks" })).toEqual(["lesson_complete", { lesson: "forks" }]);
    expect(pulseForUsage("app_open")).toBeNull();
    const game = { winner: "b" as const, reason: "checkmate", history: ["e4", "e5"], setup: { you: "b" as const, opponent: { kind: "bot", bot: "rex" } } };
    expect(botGameProps(game)).toEqual({ bot: "rex", result: "win", reason: "checkmate", moves: 2 });
    expect(botGameProps({ ...game, setup: { ...game.setup, opponent: { kind: "friend" } } })).toBeNull();
    expect(settingsProps({ sound: false, theme: "sunset", coach: null })).toEqual([{ key: "sound", value: false }, { key: "theme", value: "sunset" }, { key: "coach" }]);
  });
});

describe("pulse events from API calls", () => {
  it("names sign-in, challenges, AI help and leaderboard opens", async () => {
    const { pulseForApi } = await import("./pulse");
    expect(pulseForApi("POST", "/v1/auth/register", { email: "a@b.co", name: "Asha" }, {})).toEqual(["signup", { method: "password" }]);
    expect(pulseForApi("POST", "/v1/auth/google", {}, {})).toEqual(["login", { method: "google" }]);
    expect(pulseForApi("POST", "/v1/challenges", { kind: "game", tc: "10m" }, { challenge: { kind: "game", status: "waiting" } })).toEqual(["challenge_create", { kind: "game", tc: "10m" }]);
    expect(pulseForApi("POST", "/v1/challenges/abc/moves", {}, { challenge: { kind: "game", status: "active" } })).toBeNull();
    expect(pulseForApi("POST", "/v1/challenges/abc/moves", {}, { challenge: { kind: "game", status: "over", result: "1-0" } })).toEqual(["challenge_finish", { kind: "game", result: "1-0" }]);
    expect(pulseForApi("POST", "/v1/coach/line", { kind: "hint" }, {})).toEqual(["ai_hint", { kind: "hint" }]);
    expect(pulseForApi("POST", "/v1/coach/line", { kind: "bot" }, {})).toBeNull();
    expect(pulseForApi("GET", "/v1/leaderboard?scope=global&metric=xp", undefined, {})).toEqual(["leaderboard_open", { scope: "global", metric: "xp" }]);
  });
});
