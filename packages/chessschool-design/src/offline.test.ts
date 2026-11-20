import { describe, expect, it } from "vitest";
import type { RateInput } from "./api";
import { ApiError } from "./api";
import { drainQueues, isOfflineError, lessonsForDays, queueDailySolve, queueGameSave, queueVisionScore, sanitizeWriteQueue, writeSent } from "./offline";
import { completeNode, createInitialState, dayKey, hydrateState, mergeProgress, PATH, type LocalState, type Progress } from "./progress";
import { emptyRatings, queueRating, ratedPuzzle } from "./rating";

const COURSE = { lessons: PATH.map((n) => ({ id: n.id, minutes: n.minutes })) };
const signedIn = (): LocalState => ({ ...createInitialState("guest-1"), account: { id: "u1", email: "a@b.co", name: "Asha" } as LocalState["account"] });

describe("lessons kept for offline days", () => {
  it("covers three days at the daily goal, at least one lesson a day, in course order", () => {
    const short = lessonsForDays(COURSE, {}, 5);
    expect(short.length).toBeGreaterThanOrEqual(3);
    expect(short).toEqual(PATH.filter((n) => n.id !== "meet").slice(0, short.length).map((n) => n.id));
    const long = lessonsForDays(COURSE, {}, 15);
    expect(long.length).toBeGreaterThan(short.length);
    expect(long.reduce((m, id) => m + PATH.find((n) => n.id === id)!.minutes, 0)).toBeGreaterThanOrEqual(45);
  });

  it("skips finished lessons, the tour, and lessons closed to a guest", () => {
    const ids = lessonsForDays({ lessons: [{ id: "meet", minutes: 2 }, { id: "a", minutes: 5 }, { id: "b", minutes: 5 }, { id: "c", minutes: 5, guestLocked: true }, { id: "d", minutes: 5 }] }, { a: "2026-11-01" }, 5);
    expect(ids).toEqual(["b", "d"]);
  });
});

describe("write queue", () => {
  it("keeps the best waiting score for a game and day, and survives storage", () => {
    let s = queueVisionScore(signedIn(), "name-square", 7, "2026-11-03");
    s = queueVisionScore(s, "name-square", 5, "2026-11-03");
    s = queueVisionScore(s, "name-square", 9, "2026-11-03");
    s = queueVisionScore(s, "name-square", 4, "2026-11-04");
    expect(s.writeQueue.map((w) => (w.kind === "vision" ? [w.day, w.score] : null))).toEqual([["2026-11-03", 9], ["2026-11-04", 4]]);
    expect(hydrateState(JSON.parse(JSON.stringify(s)), () => "x").writeQueue).toEqual(s.writeQueue);
    expect(sanitizeWriteQueue([{ id: 1 }, null, "x", s.writeQueue[0]])).toEqual([s.writeQueue[0]]);
  });

  it("a score queued while an older one was being sent stays queued", () => {
    const first = queueVisionScore(signedIn(), "name-square", 7, "2026-11-03");
    const better = queueVisionScore(first, "name-square", 9, "2026-11-03");
    expect(writeSent(better, first.writeQueue[0]!).writeQueue).toHaveLength(1);
    expect(writeSent(first, first.writeQueue[0]!).writeQueue).toHaveLength(0);
  });
});

/** A server that can be unplugged. It dedupes rated results by event and keeps the best vision score, like the API. */
function fakeServer() {
  const server = {
    online: true,
    rated: [] as RateInput[],
    vision: new Map<string, number>(),
    progress: null as Progress | null,
    calls: 0,
  };
  const reach = () => {
    server.calls++;
    if (!server.online) throw new ApiError(0, "offline");
  };
  const api = {
    rate: async (input: RateInput) => {
      reach();
      if (!server.rated.some((r) => r.event === input.event)) server.rated.push(input);
      return { ratings: emptyRatings() };
    },
    sendVisionScore: async (game: string, score: number, day: string) => {
      reach();
      server.vision.set(`${game}:${day}`, Math.max(score, server.vision.get(`${game}:${day}`) ?? 0));
    },
    putProgress: async (progress: Progress) => {
      reach();
      server.progress = server.progress ? mergeProgress(server.progress, progress) : progress;
    },
  };
  return { server, api };
}

describe("three days offline", () => {
  it("loses nothing: lessons, rated puzzles and vision scores all reach the server, in order", async () => {
    const { server, api } = fakeServer();
    let state = signedIn();
    const get = () => state;
    const apply = (fn: (s: LocalState) => LocalState) => void (state = fn(state));
    const sync = async () => {
      const sent = await drainQueues(get, apply, api);
      await api.putProgress(state.progress).catch((err) => expect(isOfflineError(err)).toBe(true));
      return sent;
    };

    // Day 0, online: the next three days of lessons are saved on the device.
    const cached = new Set(lessonsForDays(COURSE, state.progress.completed, state.profile.dailyMinutes));
    expect(await sync()).toBe(true);

    server.online = false;
    const expectedEvents: string[] = [];
    const done: string[] = [];
    for (let day = 1; day <= 3; day++) {
      const now = new Date(2026, 10, 3 + day, 18, 0);
      // One saved lesson, two rated puzzles and a vision score each day.
      const lesson = [...cached].find((id) => !state.progress.completed[id])!;
      expect(lesson, `day ${day} has a saved lesson`).toBeTruthy();
      state = completeNode(state, lesson, now);
      done.push(lesson);
      for (const [n, solved] of [true, false].entries()) {
        const rated = ratedPuzzle({ id: `p${day}${n}`, solved, puzzleRating: 700 }, now.getTime() + n);
        expectedEvents.push(rated.input.event);
        state = queueRating(state, rated);
      }
      state = queueVisionScore(state, "name-square", 3 + day, dayKey(now));
      // Every attempt to sync fails quietly and leaves the queues as they were.
      expect(await sync()).toBe(false);
      expect(state.ratingQueue.map((q) => q.event)).toEqual(expectedEvents);
      // The app is closed and reopened: the state comes back from storage.
      state = hydrateState(JSON.parse(JSON.stringify(state)), () => "x");
    }
    expect(server.rated).toHaveLength(0);
    expect(server.progress?.completed ?? {}).toEqual({});

    // Back online.
    server.online = true;
    expect(await sync()).toBe(true);
    expect(server.rated.map((r) => r.event)).toEqual(expectedEvents);
    expect([...server.vision.entries()]).toEqual([["name-square:2026-11-04", 4], ["name-square:2026-11-05", 5], ["name-square:2026-11-06", 6]]);
    expect(Object.keys(server.progress!.completed).sort()).toEqual([...done].sort());
    expect(server.progress!.xp).toBe(state.progress.xp);
    expect(state.ratingQueue).toEqual([]);
    expect(state.writeQueue).toEqual([]);

    // Sending again changes nothing (the server dedupes).
    expect(await sync()).toBe(true);
    expect(server.rated).toHaveLength(expectedEvents.length);
  });

  it("stops at the first unreachable call and keeps the order; drops a result the server refuses", async () => {
    const { server, api } = fakeServer();
    let state = signedIn();
    const apply = (fn: (s: LocalState) => LocalState) => void (state = fn(state));
    for (const id of ["a", "b", "c"]) state = queueRating(state, ratedPuzzle({ id, solved: true, puzzleRating: 700 }, 1));
    const flaky = {
      ...api,
      rate: async (input: RateInput) => {
        if (input.kind === "puzzle" && input.puzzle === "a") throw new ApiError(400, "invalid_input");
        if (input.kind === "puzzle" && input.puzzle === "c") throw new ApiError(0, "offline");
        return api.rate(input);
      },
    };
    expect(await drainQueues(() => state, apply, flaky)).toBe(false);
    expect(server.rated.map((r) => (r as { puzzle: string }).puzzle)).toEqual(["b"]);
    expect(state.ratingQueue.map((q) => (q as { puzzle: string }).puzzle)).toEqual(["c"]);
  });
});

describe("games and daily solves made offline", () => {
  const game = { id: "g1", endedAt: Date.UTC(2026, 10, 4), setup: { opponent: { kind: "bot" as const, bot: "pip" }, you: "w" as const, time: "none", startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", takebacks: true, askPromotion: true }, history: ["e4", "e5"], winner: "w" as const, reason: "resigned" };

  it("queues each game and day once, survives storage, and sends them when back online", async () => {
    let state = queueGameSave(queueGameSave(signedIn(), game), game);
    state = queueDailySolve(queueDailySolve(state, "2026-11-04", "p001"), "2026-11-04", "p001");
    expect(state.writeQueue.map((w) => w.kind)).toEqual(["game", "daily"]);
    expect(hydrateState(JSON.parse(JSON.stringify(state)), () => "x").writeQueue).toEqual(state.writeQueue);

    const saved: string[] = [];
    const solved: string[] = [];
    let online = false;
    const api = {
      rate: async () => ({ ratings: emptyRatings() }),
      sendVisionScore: async () => {},
      saveGame: async (g: { id: string }) => {
        if (!online) throw new ApiError(0, "offline");
        saved.push(g.id);
      },
      dailySolved: async (day: string, puzzle: string) => {
        if (!online) throw new ApiError(0, "offline");
        solved.push(`${day}:${puzzle}`);
      },
    };
    const apply = (fn: (s: LocalState) => LocalState) => void (state = fn(state));
    expect(await drainQueues(() => state, apply, api)).toBe(false);
    expect(state.writeQueue).toHaveLength(2);
    online = true;
    expect(await drainQueues(() => state, apply, api)).toBe(true);
    expect(saved).toEqual(["g1"]);
    expect(solved).toEqual(["2026-11-04:p001"]);
    expect(state.writeQueue).toEqual([]);
  });

  it("signed out, sends only the daily solve, as the device's guest id", async () => {
    let state = queueDailySolve(queueGameSave(createInitialState("guest-9"), game), "2026-11-04", "p001");
    const who: (string | null)[] = [];
    const api = { rate: async () => ({ ratings: emptyRatings() }), sendVisionScore: async () => {}, saveGame: async () => {}, dailySolved: async (_d: string, _p: string, solver: string | null) => void who.push(solver) };
    expect(await drainQueues(() => state, (fn) => void (state = fn(state)), api, { signedIn: false })).toBe(true);
    expect(who).toEqual(["guest-9"]);
    expect(state.writeQueue.map((w) => w.kind)).toEqual(["game"]);
  });
});
