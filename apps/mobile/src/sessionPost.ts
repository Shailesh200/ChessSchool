/**
 * Retry policy for `api()`. Session move/resign/timeout POSTs are not sent
 * again after a timeout — the server may already have applied the first try.
 * GETs, other POSTs, and network TypeErrors keep the single retry.
 */
export function shouldRetryApiFailure(
  path: string,
  method: string | undefined,
  error: unknown,
): boolean {
  const name = error instanceof Error ? error.name : "";
  const timeout = name === "TimeoutError" || name === "AbortError";
  const network = error instanceof TypeError;
  if (!timeout && !network) return false;
  const verb = (method ?? "GET").toUpperCase();
  if (verb === "POST" && timeout && isSessionPostPath(path)) return false;
  return true;
}

function isSessionPostPath(path: string): boolean {
  const bare = path.split("?")[0] ?? path;
  return bare === "/api/session" || bare.startsWith("/api/session/");
}

export type SessionRow = {
  fen: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "over";
  result?: string | null;
  pgn?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

/** Row carried on a 200 or on a 409 that echoed the current game. */
export function sessionStateFromPost(status: number, body: unknown): SessionRow | null {
  if (status !== 200 && status !== 409) return null;
  if (!isRecord(body)) return null;
  if (typeof body.fen !== "string") return null;
  if (body.turn !== "w" && body.turn !== "b") return null;
  if (body.status !== "waiting" && body.status !== "active" && body.status !== "over") {
    return null;
  }
  if (status === 200 && body.error) return null;
  return Object.fromEntries(Object.entries(body).filter(([key]) => key !== "error")) as SessionRow;
}
