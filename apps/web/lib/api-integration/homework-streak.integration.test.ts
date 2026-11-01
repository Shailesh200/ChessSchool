import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { addDays, calendarDay } from "@chess-school/progression";
import * as schema from "@/db/schema";
import { bearer, bootApiTestEnv, readJson, testIp } from "@/lib/test-db.harness";

const PW = "testpass123";

type HomeworkReply = {
  ok: boolean;
  homeworkStreak: number;
  homeworkLastDay: string | null;
};

type HomeworkSaved = {
  homeworkStreak: number;
  homeworkLastDay: string | null;
};

describe("homework streak progress API", () => {
  let teardown: () => void = () => {};
  let db: import("@/lib/test-db.harness").TestDb;
  let postRegister: typeof import("@/app/api/auth/register/route").POST;
  let getProgress: typeof import("@/app/api/progress/route").GET;
  let postProgress: typeof import("@/app/api/progress/route").POST;
  /**
   * The server's UTC day, read when a test runs. A run that crosses UTC midnight
   * must not compare against a day taken when the file loaded.
   */
  const serverToday = () => calendarDay(new Date(), "UTC");

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

  async function register(slot: number): Promise<string> {
    const res = await postRegister(
      new Request("http://test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", ...testIp(slot) },
        body: JSON.stringify({
          email: `homework-${slot}-${Date.now()}@test.dev`,
          password: PW,
          name: "Homework Streak",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const { token } = await readJson<{ token: string }>(res);
    return token;
  }

  async function pushHomework(
    token: string,
    slot: number,
    day: string,
    claimedStreak: number,
  ) {
    return postProgress(
      new Request("http://test/api/progress", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...bearer(token),
          ...testIp(slot),
        },
        body: JSON.stringify({
          xp: 0,
          streak: claimedStreak,
          lastActiveDay: null,
          graduatedClasses: [],
          lessons: {},
          homeworkStreak: claimedStreak,
          homeworkLastDay: day,
        }),
      }),
    );
  }

  async function savedHomework(token: string): Promise<HomeworkSaved> {
    const pull = await getProgress(
      new Request("http://test/api/progress", { headers: bearer(token) }),
    );
    expect(pull.status).toBe(200);
    return readJson<HomeworkSaved>(pull);
  }

  it("day 1 then day 2 gives 2 in the reply and in the stored row", async () => {
    const today = serverToday();
    const yesterday = addDays(today, -1);
    const token = await register(180);
    const first = await pushHomework(token, 181, yesterday, 40);
    expect(first.status).toBe(200);
    const firstBody = await readJson<HomeworkReply>(first);
    expect(firstBody.homeworkStreak).toBe(1);
    expect(firstBody.homeworkLastDay).toBe(yesterday);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: yesterday,
    });

    const second = await pushHomework(token, 182, today, 0);
    const secondBody = await readJson<HomeworkReply>(second);
    expect(secondBody.homeworkStreak).toBe(2);
    expect(secondBody.homeworkLastDay).toBe(today);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 2,
      homeworkLastDay: today,
    });
  });

  it("a missed day resets the stored streak to 1", async () => {
    const today = serverToday();
    const yesterday = addDays(today, -1);
    const token = await register(190);
    await pushHomework(token, 191, yesterday, 1);
    const row = (await db.select().from(schema.progress))[0];
    expect(row).toBeTruthy();
    const data = JSON.parse(row!.data) as {
      homeworkStreak?: number;
      homeworkLastDay?: string;
    };
    data.homeworkLastDay = addDays(today, -3);
    data.homeworkStreak = 4;
    await db
      .update(schema.progress)
      .set({ data: JSON.stringify(data) })
      .where(eq(schema.progress.userId, row!.userId));

    const pushed = await pushHomework(token, 192, today, 9);
    const body = await readJson<HomeworkReply>(pushed);
    expect(body.homeworkStreak).toBe(1);
    expect(body.homeworkLastDay).toBe(today);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: today,
    });
  });

  it("rejects a future homework day in the reply and the stored row", async () => {
    const today = serverToday();
    const token = await register(200);
    await pushHomework(token, 201, today, 1);
    const future = await pushHomework(token, 202, addDays(today, 2), 6);
    const body = await readJson<HomeworkReply>(future);
    expect(body.homeworkStreak).toBe(1);
    expect(body.homeworkLastDay).toBe(today);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: today,
    });
  });

  it("two pushes on the same day keep the streak unchanged", async () => {
    const today = serverToday();
    const token = await register(210);
    const first = await pushHomework(token, 211, today, 3);
    expect((await readJson<HomeworkReply>(first)).homeworkStreak).toBe(1);
    const second = await pushHomework(token, 212, today, 8);
    const body = await readJson<HomeworkReply>(second);
    expect(body.homeworkStreak).toBe(1);
    expect(body.homeworkLastDay).toBe(today);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: today,
    });
  });

  it("accepts the inclusive UTC+1 edge and rejects UTC+2", async () => {
    const today = serverToday();
    const edge = addDays(today, 1);
    const token = await register(220);
    const accepted = await readJson<HomeworkReply>(
      await pushHomework(token, 221, edge, 0),
    );
    expect(accepted.homeworkStreak).toBe(1);
    expect(accepted.homeworkLastDay).toBe(edge);
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: edge,
    });

    const other = await register(222);
    const rejected = await readJson<Partial<HomeworkReply>>(
      await pushHomework(other, 223, addDays(today, 2), 5),
    );
    expect(rejected).not.toHaveProperty("homeworkStreak");
    expect(rejected).not.toHaveProperty("homeworkLastDay");
    expect(await savedHomework(other)).toMatchObject({
      homeworkStreak: 0,
      homeworkLastDay: null,
    });
  });

  it("rejects a claim two days before the server UTC day", async () => {
    const today = serverToday();
    const token = await register(230);
    const body = await readJson<Partial<HomeworkReply>>(
      await pushHomework(token, 231, addDays(today, -2), 9),
    );
    // Nothing is stored, so the reply carries no homework fields.
    expect(body.ok).toBe(true);
    expect(body).not.toHaveProperty("homeworkStreak");
    expect(body).not.toHaveProperty("homeworkLastDay");
    expect(await savedHomework(token)).toMatchObject({
      homeworkStreak: 0,
      homeworkLastDay: null,
    });
  });
});
