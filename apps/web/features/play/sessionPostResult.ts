function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

/** Session row from a 200 or a 409 that echoed the current game. Error text is dropped. */
export function postedSessionRow(
  status: number,
  body: unknown,
): Record<string, unknown> | null {
  if (status !== 200 && status !== 409) return null;
  if (!isRecord(body)) return null;
  if (typeof body.fen !== "string") return null;
  if (body.turn !== "w" && body.turn !== "b") return null;
  if (body.status !== "waiting" && body.status !== "active" && body.status !== "over") {
    return null;
  }
  if (status === 200 && body.error) return null;
  return Object.fromEntries(Object.entries(body).filter(([key]) => key !== "error"));
}

/**
 * Apply the server board after a session POST.
 * Drops the optimistic move once the body is known, in the same turn as applying
 * a session row, so a confirmed move does not flash the previous position.
 * A 409 that is only an error string is refetched so the board still resets.
 */
export async function consumeSessionPost<T>(
  res: Response,
  handlers: {
    apply: (row: T) => void;
    dropOptimistic: () => void;
    refetch: () => Promise<Response>;
  },
): Promise<void> {
  const row = postedSessionRow(res.status, await res.json().catch(() => null));
  if (row) {
    handlers.dropOptimistic();
    handlers.apply(row as T);
    return;
  }
  handlers.dropOptimistic();
  if (res.status !== 409) return;
  const fresh = await handlers.refetch();
  const again = postedSessionRow(fresh.status, await fresh.json().catch(() => null));
  if (again) handlers.apply(again as T);
}
