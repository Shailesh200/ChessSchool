import { readProgressPushAck } from "@chess-school/progression";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";

/**
 * Copy the merged fields from POST /api/progress into the local stores.
 * An old `{ ok, count }` body changes nothing. Equal values are left alone
 * so adopting the ack does not schedule another push.
 */
export function applyServerProgressAck(body: unknown): void {
  const ack = readProgressPushAck(body);
  if (!ack) return;

  const progress = useProgression.getState();
  const patch: Partial<typeof progress> = {};
  if (ack.streak !== undefined && ack.streak !== progress.streak)
    patch.streak = ack.streak;
  if (ack.lastActiveDay !== undefined && ack.lastActiveDay !== progress.lastActiveDay) {
    patch.lastActiveDay = ack.lastActiveDay;
  }
  if (ack.rating !== undefined && ack.rating !== progress.rating)
    patch.rating = ack.rating;
  if (ack.ratingUpdatedAt !== undefined) {
    const ratingUpdatedAt = ack.ratingUpdatedAt ?? undefined;
    if (ratingUpdatedAt !== progress.ratingUpdatedAt)
      patch.ratingUpdatedAt = ratingUpdatedAt;
  }
  if (ack.dailyGoalXp !== undefined && ack.dailyGoalXp !== progress.dailyGoalXp) {
    patch.dailyGoalXp = ack.dailyGoalXp;
  }
  if (ack.goalUpdatedAt !== undefined) {
    const goalUpdatedAt = ack.goalUpdatedAt ?? undefined;
    if (goalUpdatedAt !== progress.goalUpdatedAt) patch.goalUpdatedAt = goalUpdatedAt;
  }
  if (Object.keys(patch).length > 0) useProgression.setState(patch);

  const plan = usePlan.getState();
  const homeworkStreakDiffers =
    ack.homeworkStreak !== undefined && ack.homeworkStreak !== plan.homeworkStreak;
  const homeworkDayDiffers =
    ack.homeworkLastDay !== undefined && ack.homeworkLastDay !== plan.homeworkLastDay;
  if (homeworkStreakDiffers || homeworkDayDiffers) {
    usePlan
      .getState()
      .adoptHomework(
        ack.homeworkStreak ?? plan.homeworkStreak,
        homeworkDayDiffers ? ack.homeworkLastDay : undefined,
      );
  }
}
