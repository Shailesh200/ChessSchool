import { readProgressPushAck } from "@chess-school/progression";

/** Each group moves together: a value and the day or stamp that goes with it. */
const ACK_GROUPS = [
  ["streak", "lastActiveDay"],
  ["rating", "ratingUpdatedAt"],
  ["dailyGoalXp", "goalUpdatedAt"],
  ["homeworkStreak", "homeworkLastDay"],
] as const;

/**
 * Copy the merged fields from the POST /api/progress reply into `current`,
 * the snapshot as it is when the reply arrives. The reply is for what the push
 * carried (`pushed`). If the user changed a group while the push was in flight,
 * `current` no longer equals `pushed` for it, so that group is left alone and
 * goes out with the next push. This is the same rule as the web ack guard
 * (`applyServerProgressAck`). A legacy `{ ok, count }` reply changes nothing.
 * The server sends the homework pair only when it stores a homework day.
 */
export function adoptAckUnlessEdited<T extends Record<string, unknown>>(
  current: T,
  pushed: Record<string, unknown>,
  body: unknown,
): T {
  const ack = readProgressPushAck(body) as Record<string, unknown> | null;
  if (!ack) return current;
  const next: Record<string, unknown> = { ...current };
  for (const group of ACK_GROUPS) {
    if (group.some((key) => current[key] !== pushed[key])) continue;
    if (group[0] === "homeworkStreak" && typeof ack.homeworkLastDay !== "string")
      continue;
    for (const key of group) if (ack[key] !== undefined) next[key] = ack[key];
  }
  return next as T;
}
