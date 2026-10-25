import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { profiles, progress, sessions, users } from "@/db/schema";
import { bootApiTestEnv, type TestDb } from "@/lib/test-db.harness";

const PW = "testpass123";
const TRIGGER = "cs23_fail_progress_insert";

/** Fail the progress insert the way a real constraint failure would (ABORT, transaction left open). */
async function failNextProgressInsert(db: TestDb): Promise<void> {
  await db.run(`
    CREATE TRIGGER ${TRIGGER}
    BEFORE INSERT ON progress
    BEGIN
      SELECT RAISE(ABORT, 'cs23 simulated progress insert failure');
    END
  `);
}

async function clearProgressInsertFailure(db: TestDb): Promise<void> {
  await db.run(`DROP TRIGGER IF EXISTS ${TRIGGER}`);
}

function failureText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? err.cause.message : "";
  return `${err.message}\n${cause}`;
}

async function expectNoAccount(db: TestDb, email: string): Promise<void> {
  expect(
    (await db.select().from(users).where(eq(users.email, email)).limit(1))[0],
  ).toBeUndefined();
  expect(await db.select().from(profiles)).toHaveLength(0);
  expect(await db.select().from(progress)).toHaveLength(0);
  expect(await db.select().from(sessions)).toHaveLength(0);
}

describe("atomic registration", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let registerUser: typeof import("@/lib/auth").registerUser;
  let registerWithToken: typeof import("@/lib/auth").registerWithToken;

  beforeEach(async () => {
    vi.resetModules();
    const env = await bootApiTestEnv();
    teardown = env.teardown;
    db = env.db;
    const auth = await import("@/lib/auth");
    registerUser = auth.registerUser;
    registerWithToken = auth.registerWithToken;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("registerWithToken rolls back a failed later insert and then registers that email", async () => {
    const email = "atomic-mobile@test.dev";
    await failNextProgressInsert(db);

    let thrown: unknown;
    try {
      await registerWithToken(email, PW, "Mobile Student");
    } catch (err) {
      thrown = err;
    }
    expect(failureText(thrown)).toMatch(/cs23 simulated progress insert failure/);
    await expectNoAccount(db, email);

    await clearProgressInsertFailure(db);
    const registered = await registerWithToken(email, PW, "Mobile Student");
    expect("token" in registered).toBe(true);
    if (!("token" in registered)) return;
    expect(registered.user).toMatchObject({
      email,
      name: "Mobile Student",
      role: "student",
    });
    expect(registered.token.length).toBeGreaterThan(10);

    const user = (
      await db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0];
    expect(user?.id).toBe(registered.user.id);
    expect(user?.passwordHash).toBeTruthy();
    if (!user) return;
    expect(
      (await db.select().from(profiles).where(eq(profiles.userId, user.id)))[0]
        ?.rankTitle,
    ).toBe("Novice");
    expect(
      (await db.select().from(progress).where(eq(progress.userId, user.id)))[0]?.userId,
    ).toBe(user.id);
    expect(
      (await db.select().from(sessions).where(eq(sessions.userId, user.id))).length,
    ).toBe(1);
  });

  it("registerUser rolls back a failed later insert and then registers that email", async () => {
    const email = "atomic-web@test.dev";
    await failNextProgressInsert(db);

    let thrown: unknown;
    try {
      await registerUser(email, PW, "Web Student");
    } catch (err) {
      thrown = err;
    }
    expect(failureText(thrown)).toMatch(/cs23 simulated progress insert failure/);
    await expectNoAccount(db, email);

    await clearProgressInsertFailure(db);
    const registered = await registerUser(email, PW, "Web Student");
    expect(registered).toEqual({ ok: true });

    const user = (
      await db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0];
    expect(user?.email).toBe(email);
    expect(user?.name).toBe("Web Student");
    expect(user?.passwordHash).toBeTruthy();
    if (!user) return;
    expect(
      (await db.select().from(profiles).where(eq(profiles.userId, user.id)))[0]
        ?.rankTitle,
    ).toBe("Novice");
    expect(
      (await db.select().from(progress).where(eq(progress.userId, user.id)))[0]?.userId,
    ).toBe(user.id);
    expect(
      (await db.select().from(sessions).where(eq(sessions.userId, user.id))).length,
    ).toBe(1);
  });
});
