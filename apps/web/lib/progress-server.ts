import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { progress, lessonRecords } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { ProgressPushBody } from "@/lib/api-schemas";
import { mergeProgressPush, serverStateFromRow } from "@/lib/progress-merge";

type Db = LibSQLDatabase<typeof schema>;

/** Apply a merged progress push inside a transaction — never delete-all lesson records. */
export async function applyProgressPush(
  userId: string,
  body: ProgressPushBody,
  database: Db,
): Promise<{ lessonCount: number }> {
  const now = Date.now();

  return database.transaction(async (tx) => {
    const existing = (
      await tx.select().from(progress).where(eq(progress.userId, userId)).limit(1)
    )[0];
    const recs = await tx
      .select()
      .from(lessonRecords)
      .where(eq(lessonRecords.userId, userId));

    const server = serverStateFromRow(existing, recs);
    const merged = mergeProgressPush(body, server);

    await tx
      .insert(progress)
      .values({
        userId,
        xp: merged.xp,
        streak: merged.streak,
        lastActiveDay: merged.lastActiveDay,
        graduatedClasses: JSON.stringify(merged.graduatedClasses),
        dailyGoalXp: merged.dailyGoalXp,
        data: JSON.stringify(merged.data),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: progress.userId,
        set: {
          xp: merged.xp,
          streak: merged.streak,
          lastActiveDay: merged.lastActiveDay,
          graduatedClasses: JSON.stringify(merged.graduatedClasses),
          dailyGoalXp: merged.dailyGoalXp,
          data: JSON.stringify(merged.data),
          updatedAt: now,
        },
      });

    const lessonEntries = Object.entries(merged.lessons);
    for (let i = 0; i < lessonEntries.length; i += 200) {
      const batch = lessonEntries.slice(i, i + 200).map(([lessonId, r]) => ({
        id: `${userId}:${lessonId}`,
        userId,
        lessonId,
        mastery: r.mastery,
        attempts: r.attempts,
        lastSeen: r.lastSeen,
        dueAt: r.dueAt,
      }));
      for (const row of batch) {
        await tx
          .insert(lessonRecords)
          .values(row)
          .onConflictDoUpdate({
            target: lessonRecords.id,
            set: {
              mastery: row.mastery,
              attempts: row.attempts,
              lastSeen: row.lastSeen,
              dueAt: row.dueAt,
            },
          });
      }
    }

    return { lessonCount: lessonEntries.length };
  });
}
