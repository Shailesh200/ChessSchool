import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, passwordResetTokens, users } from "@/db/schema";
import { appOrigin } from "@/lib/google-oauth.server";
import { hashPassword } from "@/lib/auth";
import { hashSessionToken } from "@/lib/session-token";
import { revokeSessionsForUser } from "@/lib/session-store";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";

const RESET_TTL_MS = 45 * 60_000;

function dbConn() {
  return db as import("drizzle-orm/libsql").LibSQLDatabase<
    typeof import("@/db/schema")
  >;
}

function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

function resetLink(origin: string, rawToken: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/account/reset#${rawToken}`;
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
export async function requestPasswordReset(
  email: string,
  origin: string = appOrigin(),
): Promise<void> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return;

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

  const link = resetLink(origin, raw);
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    link,
  }).catch(() => undefined);
}

export async function resetPasswordWithToken(
  rawToken: string,
  password: string,
): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const tokenHash = hashSessionToken(rawToken.trim());
  const conn = dbConn();
  const row = (
    await conn
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenHash))
      .limit(1)
  )[0];
  const now = Date.now();
  if (!row || row.usedAt != null || row.expiresAt < now) {
    return { error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await hashPassword(password);
  await conn.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await conn
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, tokenHash));
  await revokeSessionsForUser(row.userId, conn);
  return { ok: true };
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
