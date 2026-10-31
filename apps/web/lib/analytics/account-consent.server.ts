import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { progress } from "@/db/schema";
import {
  accountShareAnalyticsFromSettings,
  parseExtraData,
} from "@/lib/progress-merge";

/** True when the account has opted in to first-party analytics (synced settings). */
export async function userShareAnalyticsOptIn(userId: string): Promise<boolean> {
  const row = (
    await db
      .select({ data: progress.data })
      .from(progress)
      .where(eq(progress.userId, userId))
      .limit(1)
  )[0];
  const settings = parseExtraData(row?.data).settings;
  return accountShareAnalyticsFromSettings(
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : undefined,
  );
}
