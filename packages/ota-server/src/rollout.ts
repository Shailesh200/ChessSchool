import { createHash } from "node:crypto";
import type { MetadataStore, OtaRecord, Platform } from "./types";

/**
 * A device's bucket (0–99) for one update: a stable hash of the update id and the device's client id, so the
 * same device stays in (or out) on every check, and raising the percentage only ever adds devices.
 */
export function rolloutBucket(updateId: string, clientId: string): number {
  return createHash("sha256").update(`${updateId}:${clientId}`).digest().readUInt32BE(0) % 100;
}

/** Devices without a client id only get fully rolled-out updates. */
export function inRollout(record: Pick<OtaRecord, "id" | "rolloutPercent">, clientId: string | null): boolean {
  if (record.rolloutPercent >= 100) return true;
  if (!clientId || record.rolloutPercent <= 0) return false;
  return rolloutBucket(record.id, clientId) < record.rolloutPercent;
}

/**
 * What a device on this channel/runtime/platform should run: the newest record that isn't paused and whose
 * rollout includes the device. Null when nothing matches (the client keeps what it has).
 */
export async function resolveUpdate(
  metadata: MetadataStore,
  q: { channel: string; runtimeVersion: string; platform: Platform; clientId: string | null },
): Promise<OtaRecord | null> {
  const records = await metadata.list({ channel: q.channel, runtimeVersion: q.runtimeVersion, platform: q.platform, limit: 50 });
  for (const r of records) {
    if (r.paused) continue;
    if (r.kind === "rollback") return r;
    if (inRollout(r, q.clientId)) return r;
  }
  return null;
}
