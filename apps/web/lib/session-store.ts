import { eq, lt } from "drizzle-orm";
import { sessions } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  hashSessionToken,
  isLegacySessionId,
  newSessionToken,
} from "@/lib/session-token";

const SESSION_DAYS = 30;

export type SessionRow = {
  id: string;
  userId: string;
  expiresAt: number;
};

type AppDb = LibSQLDatabase<typeof schema>;

function sessionExpiry(): number {
  return Date.now() + SESSION_DAYS * 86400_000;
}

/** Create a session; returns the raw token for cookie/Bearer (hash stored in DB). */
export async function createSession(userId: string, conn: AppDb): Promise<string> {
  const raw = newSessionToken();
  await conn.insert(sessions).values({
    id: hashSessionToken(raw),
    userId,
    expiresAt: sessionExpiry(),
  });
  return raw;
}

async function migrateLegacySession(
  legacy: SessionRow,
  hashedId: string,
  conn: AppDb,
): Promise<void> {
  await conn.delete(sessions).where(eq(sessions.id, legacy.id));
  await conn.insert(sessions).values({
    id: hashedId,
    userId: legacy.userId,
    expiresAt: legacy.expiresAt,
  });
}

/** Resolve a session from the client raw token; migrates legacy plaintext rows. */
export async function findSessionByRawToken(
  raw: string | null | undefined,
  conn: AppDb,
): Promise<SessionRow | null> {
  if (!raw) return null;
  const hashed = hashSessionToken(raw);

  const byHash = (
    await conn.select().from(sessions).where(eq(sessions.id, hashed)).limit(1)
  )[0];
  if (byHash) return byHash;

  const legacy = (
    await conn.select().from(sessions).where(eq(sessions.id, raw)).limit(1)
  )[0];
  if (!legacy || !isLegacySessionId(legacy.id, raw)) return null;

  await migrateLegacySession(legacy, hashed, conn);
  return { ...legacy, id: hashed };
}

export async function revokeSessionByRawToken(raw: string, conn: AppDb): Promise<void> {
  const hashed = hashSessionToken(raw);
  await conn.delete(sessions).where(eq(sessions.id, hashed));
  await conn.delete(sessions).where(eq(sessions.id, raw));
}

/** Delete expired sessions — safe to run on a schedule. */
export async function purgeExpiredSessions(now: number, conn: AppDb): Promise<number> {
  const res = await conn.delete(sessions).where(lt(sessions.expiresAt, now));
  return (res as { rowsAffected?: number }).rowsAffected ?? 0;
}
