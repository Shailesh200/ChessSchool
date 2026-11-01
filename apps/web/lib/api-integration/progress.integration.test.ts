import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { bootApiTestEnv, bearer, readJson, testIp } from "@/lib/test-db.harness";

const PW = "testpass123";

async function registerToken(
  postRegister: typeof import("@/app/api/auth/register/route").POST,
  slot: number,
): Promise<string> {
  const email = `progress-${slot}-${Date.now()}@test.dev`;
  const res = await postRegister(
    new Request("http://test/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", ...testIp(slot) },
      body: JSON.stringify({ email, password: PW, name: "Progress Test" }),
    }),
  );
  expect(res.status).toBe(200);
  const { token } = await readJson<{ token: string }>(res);
  return token;
}

function pushBody(overrides: Record<string, unknown> = {}) {
  return {
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    graduatedClasses: [] as string[],
    lessons: {} as Record<
      string,
      { mastery: number; attempts: number; lastSeen: number; dueAt: number }
    >,
    ...overrides,
  };
}

describe("progress API integration", () => {
  let teardown: () => void = () => {};
  let db: import("@/lib/test-db.harness").TestDb;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let getProgress: typeof import("@/app/api/progress/route").GET;
  let postProgress: typeof import("@/app/api/progress/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const ctx = await bootApiTestEnv();
    teardown = ctx.teardown;
    db = ctx.db;
    postRegister = (await import("@/app/api/auth/register/route")).POST;
    getProgress = (await import("@/app/api/progress/route")).GET;
    postProgress = (await import("@/app/api/progress/route")).POST;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("requires authentication", async () => {
    const res = await getProgress(new Request("http://test/api/progress"));
    expect(res.status).toBe(401);
  });

  it("push then pull returns merged lesson records and max XP", async () => {
    const token = await registerToken(postRegister, 40);
    const headers = {
      "content-type": "application/json",
      ...bearer(token),
      ...testIp(41),
    };

    const push1 = await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers,
        body: JSON.stringify(
          pushBody({
            xp: 100,
            lessons: {
              "lesson-a": { mastery: 0.8, attempts: 2, lastSeen: 100, dueAt: 200 },
            },
          }),
        ),
      }),
    );
    expect(push1.status).toBe(200);

    const push2 = await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers: { ...headers, ...testIp(42) },
        body: JSON.stringify(
          pushBody({
            xp: 80,
            lessons: {
              "lesson-b": { mastery: 0.5, attempts: 1, lastSeen: 3, dueAt: 4 },
            },
          }),
        ),
      }),
    );
    expect(push2.status).toBe(200);

    const pull = await getProgress(
      new Request("http://test/api/progress", { headers: bearer(token) }),
    );
    expect(pull.status).toBe(200);
    const body = await readJson<{
      xp: number;
      lessons: Record<string, { mastery: number }>;
    }>(pull);
    expect(body.xp).toBe(100);
    expect(Object.keys(body.lessons).sort()).toEqual(["lesson-a", "lesson-b"]);
    expect(body.lessons["lesson-a"]!.mastery).toBe(0.8);
  });

  it("empty lessons map on push does not wipe existing records", async () => {
    const token = await registerToken(postRegister, 50);
    const headers = {
      "content-type": "application/json",
      ...bearer(token),
      ...testIp(51),
    };

    await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers,
        body: JSON.stringify(
          pushBody({
            xp: 50,
            lessons: {
              "keep-me": { mastery: 0.9, attempts: 1, lastSeen: 1, dueAt: 2 },
            },
          }),
        ),
      }),
    );

    await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers: { ...headers, ...testIp(52) },
        body: JSON.stringify(pushBody({ xp: 60, lessons: {} })),
      }),
    );

    const recs = await db
      .select()
      .from(schema.lessonRecords)
      .where(eq(schema.lessonRecords.lessonId, "keep-me"));
    expect(recs).toHaveLength(1);

    const pull = await getProgress(
      new Request("http://test/api/progress", { headers: bearer(token) }),
    );
    const body = await readJson<{ xp: number; lessons: Record<string, unknown> }>(pull);
    expect(body.xp).toBe(60);
    expect(body.lessons["keep-me"]).toBeTruthy();
  });

  it("an unknown time zone does not 400 the push and the stored streak is kept", async () => {
    const token = await registerToken(postRegister, 70);
    const headers = {
      "content-type": "application/json",
      ...bearer(token),
      ...testIp(71),
    };
    const post = (body: Record<string, unknown>, slot: number) =>
      postProgress(
        new Request("http://test/api/progress", {
          method: "POST",
          headers: { ...headers, ...testIp(slot) },
          body: JSON.stringify(body),
        }),
      );
    const today = new Date().toISOString().slice(0, 10);
    const first = await post(
      pushBody({
        xp: 20,
        lastActiveDay: today,
        activityDays: { [today]: 20 },
        tz: "Etc/Unknown",
      }),
      72,
    );
    expect(first.status).toBe(200);
    const storedTz = async () => {
      const row = (await db.select().from(schema.progress))[0];
      return (JSON.parse(row!.data) as { tz?: string }).tz;
    };
    expect(await storedTz()).toBeUndefined();
    const second = await post(pushBody({ xp: 20, tz: "GMT+5" }), 73);
    expect(second.status).toBe(200);
    expect(await storedTz()).toBeUndefined();
    const ack = await readJson<{ streak: number }>(second);
    expect(ack.streak).toBeGreaterThanOrEqual(1);
  });

  it("stores a time zone alias in its canonical form", async () => {
    const token = await registerToken(postRegister, 75);
    const res = await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(token),
          ...testIp(76),
        },
        body: JSON.stringify(pushBody({ tz: "US/Pacific" })),
      }),
    );
    expect(res.status).toBe(200);
    const row = (await db.select().from(schema.progress))[0];
    expect((JSON.parse(row!.data) as { tz?: string }).tz).toBe("America/Los_Angeles");
  });

  it("drops a malformed lastActiveDay or homeworkLastDay as missing instead of a 400", async () => {
    const token = await registerToken(postRegister, 78);
    const res = await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(token),
          ...testIp(79),
        },
        body: JSON.stringify(
          pushBody({
            xp: 5,
            lastActiveDay: "2026-02-30",
            homeworkLastDay: "2026-13-40",
          }),
        ),
      }),
    );
    expect(res.status).toBe(200);
    const row = (await db.select().from(schema.progress))[0];
    expect(row!.lastActiveDay).toBeNull();
    expect(row!.xp).toBe(5);
  });

  it("returns 200 and dayRejected when lastActiveDay is past server UTC+1", async () => {
    const token = await registerToken(postRegister, 60);
    const headers = {
      "content-type": "application/json",
      ...bearer(token),
      ...testIp(61),
    };
    const rejectedDay = "9999-12-31";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const push = await postProgress(
        new Request("http://test/api/progress", {
          method: "POST",
          headers,
          body: JSON.stringify(
            pushBody({
              xp: 25,
              streak: 4,
              lastActiveDay: rejectedDay,
              lessons: {
                "kept-lesson": { mastery: 0.7, attempts: 1, lastSeen: 5, dueAt: 6 },
              },
            }),
          ),
        }),
      );
      expect(push.status).toBe(200);
      const pushed = await readJson<{ ok: boolean; dayRejected?: boolean }>(push);
      expect(pushed.ok).toBe(true);
      expect(pushed.dayRejected).toBe(true);

      const pull = await getProgress(
        new Request("http://test/api/progress", { headers: bearer(token) }),
      );
      const saved = await readJson<{
        user: { id: string; email: string };
        xp: number;
        streak: number;
        lastActiveDay: string | null;
        lessons: Record<string, { mastery: number }>;
      }>(pull);
      expect(saved.xp).toBe(25);
      // The client streak number is not stored. This row has no active-day set yet.
      expect(saved.streak).toBe(0);
      expect(saved.lastActiveDay).toBeNull();
      expect(saved.lessons["kept-lesson"]?.mastery).toBe(0.7);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]).toEqual([
        `progress day rejected user=${saved.user.id} day=${rejectedDay}`,
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it("stores object mistakeLog entries and does not 500 on null", async () => {
    const token = await registerToken(postRegister, 80);
    const headers = {
      "content-type": "application/json",
      ...bearer(token),
      ...testIp(81),
    };
    const kept = {
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      played: "e2e4",
      best: "e4",
      tag: "opening",
      at: 1,
    };
    const push = await postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers,
        body: JSON.stringify(pushBody({ xp: 12, mistakeLog: [null, "nope", 4, kept] })),
      }),
    );
    expect(push.status).toBe(200);

    const pull = await getProgress(
      new Request("http://test/api/progress", { headers: bearer(token) }),
    );
    const saved = await readJson<{ mistakeLog: unknown[] }>(pull);
    expect(saved.mistakeLog).toEqual([kept]);
  });
});
