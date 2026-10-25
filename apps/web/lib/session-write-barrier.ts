/**
 * Test seam for POST /api/session/[id] only. Two writers can sit between the
 * read and the UPDATE. Production leaves `wait` null: no lock, no transaction,
 * no extra delay. Do not use this from any other route.
 */
export const sessionWriteBarrier: {
  wait: ((action: "move" | "resign" | "timeout") => Promise<void>) | null;
} = { wait: null };
