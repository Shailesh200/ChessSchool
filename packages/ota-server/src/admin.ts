import { randomUUID } from "node:crypto";
import { PLATFORMS, type MetadataStore, type OtaRecord, type Platform } from "./types";

/** Shared by the HTTP admin routes and the CLI. */

export async function setRollout(metadata: MetadataStore, id: string, percent: number): Promise<OtaRecord> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new AdminError(400, "percent must be 0–100");
  const r = await metadata.get(id);
  if (!r) throw new AdminError(404, `no update ${id}`);
  await metadata.update(id, { rolloutPercent: Math.round(percent) });
  return { ...r, rolloutPercent: Math.round(percent) };
}

export async function setPaused(metadata: MetadataStore, id: string, paused: boolean): Promise<OtaRecord> {
  const r = await metadata.get(id);
  if (!r) throw new AdminError(404, `no update ${id}`);
  await metadata.update(id, { paused });
  return { ...r, paused };
}

/** Pauses the newest live update for each runtime and platform on a channel. Returns what it paused. */
export async function pauseChannel(metadata: MetadataStore, channel: string): Promise<OtaRecord[]> {
  const seen = new Set<string>();
  const paused: OtaRecord[] = [];
  for (const r of await metadata.list({ channel, limit: 200 })) {
    const group = `${r.runtimeVersion}|${r.platform}`;
    if (r.kind !== "update" || r.paused || seen.has(group)) continue;
    seen.add(group);
    await metadata.update(r.id, { paused: true });
    paused.push({ ...r, paused: true });
  }
  return paused;
}

/** Sends every device on the channel (optionally one runtime / platform) back to the update built into the app. */
export async function rollbackChannel(
  metadata: MetadataStore,
  channel: string,
  opts: { runtimeVersion?: string; platform?: Platform; message?: string; now?: Date } = {},
): Promise<OtaRecord> {
  if (opts.platform && !PLATFORMS.includes(opts.platform)) throw new AdminError(400, "platform must be ios or android");
  const record: OtaRecord = {
    id: randomUUID(),
    kind: "rollback",
    channel,
    runtimeVersion: opts.runtimeVersion ?? "*",
    platform: opts.platform ?? "*",
    createdAt: (opts.now ?? new Date()).toISOString(),
    message: opts.message ?? "Roll back to embedded",
    rolloutPercent: 100,
    paused: false,
    body: null,
  };
  await metadata.add(record);
  return record;
}

/** The newest record that isn't paused, per platform: what a fully included device gets now. */
export async function currentUpdates(metadata: MetadataStore, channel: string, runtimeVersion?: string) {
  const out: Record<Platform, OtaRecord | null> = { ios: null, android: null };
  for (const platform of PLATFORMS) {
    const list = await metadata.list({ channel, runtimeVersion, platform, limit: 50 });
    out[platform] = list.find((r) => !r.paused) ?? null;
  }
  return out;
}

export class AdminError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
