import "server-only";
import Ably from "ably";

let rest: Ably.Rest | null = null;

function getRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  rest ??= new Ably.Rest(key);
  return rest;
}

/**
 * Push the latest game-session state to subscribers on `game:<id>` so the
 * opponent sees moves instantly (no waiting for a poll). No-op when Ably isn't
 * configured — clients then fall back to polling.
 */
export async function publishSession(id: string, state: unknown): Promise<void> {
  const c = getRest();
  if (!c) return;
  try {
    await c.channels.get(`game:${id}`).publish("state", state);
  } catch {
    // best-effort realtime; polling is the safety net
  }
}
