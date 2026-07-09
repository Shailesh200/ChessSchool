import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { applyProgressPush } from "./progress-server";

const USER = "user-progress-test";

function emptyPush(overrides: Record<string, unknown> = {}) {
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

describe("applyProgressPush integration", () => {
  let dir: string;
  let dbPath: string;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "cs-progress-"));
    dbPath = join(dir, "test.db");
    execSync("pnpm exec drizzle-kit push", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    const client = createClient({ url: `file:${dbPath}` });
    db = drizzle(client, { schema });
    const now = Date.now();
    await db.insert(schema.users).values({
      id: USER,
      email: "progress-test@test.dev",
      passwordHash: "x",
      name: "Test",
      role: "student",
      createdAt: now,
    });
    await db
      .insert(schema.progress)
      .values({ userId: USER, xp: 0, streak: 0, updatedAt: now });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not wipe lesson records when client posts an empty lessons map", async () => {
    await applyProgressPush(
      USER,
      emptyPush({
        xp: 50,
        lessons: {
          "lesson-a": { mastery: 0.8, attempts: 2, lastSeen: 100, dueAt: 200 },
        },
      }),
      db,
    );

    await applyProgressPush(USER, emptyPush({ xp: 60, lessons: {} }), db);

    const recs = await db
      .select()
      .from(schema.lessonRecords)
      .where(eq(schema.lessonRecords.userId, USER));
    expect(recs).toHaveLength(1);
    expect(recs[0]?.lessonId).toBe("lesson-a");
    expect(recs[0]?.mastery).toBe(0.8);

    const row = (
      await db
        .select()
        .from(schema.progress)
        .where(eq(schema.progress.userId, USER))
        .limit(1)
    )[0];
    expect(row?.xp).toBe(60);
  });

  it("serial writes both retain their lesson updates and max XP", async () => {
    await applyProgressPush(
      USER,
      emptyPush({
        xp: 100,
        lessons: {
          a: { mastery: 0.7, attempts: 1, lastSeen: 1, dueAt: 2 },
        },
      }),
      db,
    );
    await applyProgressPush(
      USER,
      emptyPush({
        xp: 80,
        lessons: {
          b: { mastery: 0.5, attempts: 1, lastSeen: 3, dueAt: 4 },
        },
      }),
      db,
    );

    const recs = await db
      .select()
      .from(schema.lessonRecords)
      .where(eq(schema.lessonRecords.userId, USER));
    expect(recs).toHaveLength(2);
    expect(recs.map((r) => r.lessonId).sort()).toEqual(["a", "b"]);

    const row = (
      await db
        .select()
        .from(schema.progress)
        .where(eq(schema.progress.userId, USER))
        .limit(1)
    )[0];
    expect(row?.xp).toBe(100);
  });
});
