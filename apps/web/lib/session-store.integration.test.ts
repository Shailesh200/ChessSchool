import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hashSessionToken } from "@/lib/session-token";
import {
  createSession,
  findSessionByRawToken,
  purgeExpiredSessions,
  revokeSessionByRawToken,
} from "@/lib/session-store";
import { createIsolatedTestDb } from "@/lib/test-db.harness";

const USER = "user-session-test";

describe("session-store integration", () => {
  let teardown: () => void;
  let db: ReturnType<typeof createIsolatedTestDb>["db"];

  beforeEach(async () => {
    const ctx = createIsolatedTestDb();
    teardown = ctx.teardown;
    db = ctx.db;
    await db.insert(schema.users).values({
      id: USER,
      email: "session@test.dev",
      passwordHash: "x",
      name: "Session Test",
      role: "student",
      createdAt: Date.now(),
    });
  });

  afterEach(() => {
    teardown();
  });

  it("stores sha256 hash, not raw token", async () => {
    const raw = await createSession(USER, db);
    const rows = await db.select().from(schema.sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(hashSessionToken(raw));
    expect(rows[0]!.id).not.toBe(raw);
  });

  it("resolves session by raw bearer token", async () => {
    const raw = await createSession(USER, db);
    const session = await findSessionByRawToken(raw, db);
    expect(session?.userId).toBe(USER);
  });

  it("migrates legacy plaintext session rows on first use", async () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const expiresAt = Date.now() + 86400_000;
    await db.insert(schema.sessions).values({ id: raw, userId: USER, expiresAt });

    const session = await findSessionByRawToken(raw, db);
    expect(session?.userId).toBe(USER);
    expect(session?.id).toBe(hashSessionToken(raw));

    const rows = await db.select().from(schema.sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(hashSessionToken(raw));
  });

  it("revokes by raw token (hashed + legacy)", async () => {
    const raw = await createSession(USER, db);
    await revokeSessionByRawToken(raw, db);
    expect(await findSessionByRawToken(raw, db)).toBeNull();
  });

  it("purges expired sessions", async () => {
    const raw = await createSession(USER, db);
    await db
      .update(schema.sessions)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(schema.sessions.id, hashSessionToken(raw)));
    const deleted = await purgeExpiredSessions(Date.now(), db);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await findSessionByRawToken(raw, db)).toBeNull();
  });
});
