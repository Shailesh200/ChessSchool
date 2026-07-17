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
});
