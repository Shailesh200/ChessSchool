import { readProgressPushAck } from "@chess-school/progression";
import { usePlan } from "@/core/store/plan.store";
import { progressGeneration, useProgression } from "@/core/store/progression.store";

/** The local values a push carried. The ack may only replace values still equal to these. */
export type PushedProgress = {
  streak?: number;
  lastActiveDay?: string | null;
  rating?: number;
  ratingUpdatedAt?: number;
  dailyGoalXp?: number;
  goalUpdatedAt?: number;
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
};

/**
 * Copy the merged fields from POST /api/progress into the local stores.
 * An old `{ ok, count }` body changes nothing. Equal values are left alone
 * so adopting the ack does not schedule another push.
 *
 * Pass what the push carried as `pushed`. The reply is for that snapshot, and
 * the player may have changed rating, goal, streak or homework while it was in
 * flight. A group is adopted only when the local values still equal the pushed
 * ones. A changed group stays local and goes out with the next push.
 *
 * Pass `generation` as `progressGeneration()` read when the push started. If the
 * store was wiped since (logout, account deletion) the reply belongs to the old
 * user and is dropped. Without this a wiped store still equals a default-valued
 * snapshot and would adopt the old user's merged values.
 */
export function applyServerProgressAck(
  body: unknown,
  pushed?: PushedProgress,
  generation?: number,
): void {
  if (generation !== undefined && generation !== progressGeneration()) return;
  const ack = readProgressPushAck(body);
  if (!ack) return;

  const progress = useProgression.getState();
  const unchanged = <T>(local: T, sent: T | undefined, tracked: boolean) =>
    !pushed || !tracked || local === sent;
  const patch: Partial<typeof progress> = {};

  const streakUnchanged =
    unchanged(progress.streak, pushed?.streak, true) &&
    unchanged(progress.lastActiveDay, pushed?.lastActiveDay, true);
  if (streakUnchanged) {
    if (ack.streak !== undefined && ack.streak !== progress.streak)
      patch.streak = ack.streak;
    if (
      ack.lastActiveDay !== undefined &&
      ack.lastActiveDay !== progress.lastActiveDay
    ) {
      patch.lastActiveDay = ack.lastActiveDay;
    }
  }

  const ratingUnchanged =
    unchanged(progress.rating, pushed?.rating, true) &&
    unchanged(progress.ratingUpdatedAt, pushed?.ratingUpdatedAt, true);
  if (ratingUnchanged) {
    if (ack.rating !== undefined && ack.rating !== progress.rating)
      patch.rating = ack.rating;
    if (ack.ratingUpdatedAt !== undefined) {
      const ratingUpdatedAt = ack.ratingUpdatedAt ?? undefined;
      if (ratingUpdatedAt !== progress.ratingUpdatedAt)
        patch.ratingUpdatedAt = ratingUpdatedAt;
    }
  }

  const goalUnchanged =
    unchanged(progress.dailyGoalXp, pushed?.dailyGoalXp, true) &&
    unchanged(progress.goalUpdatedAt, pushed?.goalUpdatedAt, true);
  if (goalUnchanged) {
    if (ack.dailyGoalXp !== undefined && ack.dailyGoalXp !== progress.dailyGoalXp) {
      patch.dailyGoalXp = ack.dailyGoalXp;
    }
    if (ack.goalUpdatedAt !== undefined) {
      const goalUpdatedAt = ack.goalUpdatedAt ?? undefined;
      if (goalUpdatedAt !== progress.goalUpdatedAt) patch.goalUpdatedAt = goalUpdatedAt;
    }
  }
  if (Object.keys(patch).length > 0) useProgression.setState(patch);

  // The server sends the homework pair only when it stores a homework day.
  // Without a day there is nothing to adopt: the local streak stays.
  const plan = usePlan.getState();
  const homeworkUnchanged =
    unchanged(plan.homeworkStreak, pushed?.homeworkStreak, true) &&
    unchanged(plan.homeworkLastDay, pushed?.homeworkLastDay, true);
  if (homeworkUnchanged && typeof ack.homeworkLastDay === "string") {
    const streakDiffers =
      ack.homeworkStreak !== undefined && ack.homeworkStreak !== plan.homeworkStreak;
    const dayDiffers = ack.homeworkLastDay !== plan.homeworkLastDay;
    if (streakDiffers || dayDiffers) {
      usePlan
        .getState()
        .adoptHomework(
          ack.homeworkStreak ?? plan.homeworkStreak,
          dayDiffers ? ack.homeworkLastDay : undefined,
        );
    }
  }
}
