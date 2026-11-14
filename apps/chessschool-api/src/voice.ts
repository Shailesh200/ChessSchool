import { SPOKEN_PHRASES, spokenLines, type Step } from "@chessschool/chess";
import { voiceKey } from "@chessschool/design";
import { and, eq, inArray } from "drizzle-orm";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db";
import { voiceClips } from "./schema";

/** data/voice/<coach>.json: the clips `voice:build` has recorded for one coach, keyed by voiceKey(text). */
export type VoiceManifest = { coach: string; clips: Record<string, string> };

export function readVoiceManifests(dir: string): VoiceManifest[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as VoiceManifest);
}

/** Replaces each listed coach's clips with the manifest's. Coaches without a manifest are left alone. */
export async function applyVoice(db: Db, manifests: VoiceManifest[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const m of manifests) {
    const rows = Object.entries(m.clips).map(([key, url]) => ({ coach: m.coach, key, url }));
    const inserts = [];
    for (let i = 0; i < rows.length; i += 500) inserts.push(db.insert(voiceClips).values(rows.slice(i, i + 500)));
    await db.batch([db.delete(voiceClips).where(eq(voiceClips.coach, m.coach)), ...inserts]);
    counts[m.coach] = rows.length;
  }
  return counts;
}

/** Clip URLs for one lesson's lines plus the runner's fixed phrases, keyed by voiceKey(text). */
export async function lessonClips(db: Db, coach: string, steps: Step[]): Promise<Record<string, string>> {
  const keys = [...new Set([...spokenLines(steps), ...SPOKEN_PHRASES].map(voiceKey))];
  const rows = await db.select({ key: voiceClips.key, url: voiceClips.url }).from(voiceClips).where(and(eq(voiceClips.coach, coach), inArray(voiceClips.key, keys)));
  return Object.fromEntries(rows.map((r) => [r.key, r.url]));
}
