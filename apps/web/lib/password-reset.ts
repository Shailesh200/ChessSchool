import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { passwordResetLinkOrigin } from "@/lib/password-reset-link-origin";
import { hashSessionToken } from "@/lib/session-token";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { accountResetLink } from "@/lib/auth/password-reset-path";

const RESET_TTL_MS = 45 * 60_000;

function dbConn() {
  return db as import("drizzle-orm/libsql").LibSQLDatabase<
    typeof import("@/db/schema")
  >;
}

function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

async function isGoogleOnlyAccount(userId: string): Promise<boolean> {
  const user = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!user || user.passwordHash) return false;
  const linked = (
    await db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId))
      .limit(1)
  )[0];
  return Boolean(linked);
}

/**
 * Create a reset token and send email when possible. Never throws for unknown
 * emails or delivery failures — callers always show the generic message.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return;

  const origin = passwordResetLinkOrigin();
  if (!origin) return;

  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user) return;
  if (await isGoogleOnlyAccount(user.id)) return;

  const conn = dbConn();
  const now = Date.now();
  await conn
    .delete(passwordResetTokens)
    .where(
      and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)),
    );

  const raw = newResetToken();
  const tokenHash = hashSessionToken(raw);
  await conn.insert(passwordResetTokens).values({
    id: tokenHash,
    userId: user.id,
    expiresAt: now + RESET_TTL_MS,
    usedAt: null,
    createdAt: now,
  });

  const link = accountResetLink(origin, raw);
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    link,
  }).catch(() => undefined);
}

const CONSUME_RESET_TOKEN_SQL = `UPDATE password_reset_tokens
SET used_at = ?
WHERE id = ? AND used_at IS NULL AND expires_at >= ?
RETURNING user_id AS user_id`;

export async function resetPasswordWithToken(
  rawToken: string,
  password: string,
): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const tokenHash = hashSessionToken(rawToken.trim());
  const conn = dbConn();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  const invalid = { error: "This reset link is invalid or has expired." } as const;

  const tx = await db.$client.transaction("write");
  try {
    const consumed = await tx.execute({
      sql: CONSUME_RESET_TOKEN_SQL,
      args: [now, tokenHash, now],
    });
    const userId = consumed.rows[0]?.user_id;
    if (typeof userId !== "string" || !userId) {
      await tx.rollback();
      return invalid;
    }
    await tx.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [passwordHash, userId],
    });
    await tx.execute({
      sql: "DELETE FROM sessions WHERE user_id = ?",
      args: [userId],
    });
    await tx.commit();
    return { ok: true as const };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** @internal tests */
export async function findPasswordResetTokenHash(rawToken: string): Promise<string | null> {
  const tokenHash = hashSessionToken(rawToken);
  const row = (
    await dbConn()
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenHash))
      .limit(1)
  )[0];
  return row?.id ?? null;
}
