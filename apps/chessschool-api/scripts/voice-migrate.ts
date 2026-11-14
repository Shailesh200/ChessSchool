import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceManifest } from "../src/voice";
import { VOICE_DIR } from "./seed-course";
import { r2, readCached, writeCached } from "./voice-store";

/**
 * One-time move of clips recorded into Vercel Blob over to Cloudflare R2, keeping a local copy.
 * Re-runnable: clips already on R2 are skipped. Usage: tsx scripts/voice-migrate.ts
 */
const store = r2();
if (!store) {
  console.error("R2_* settings are required");
  process.exit(1);
}
const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
for (const f of readdirSync(VOICE_DIR).filter((n) => n.endsWith(".json"))) {
  const file = join(VOICE_DIR, f);
  const m = JSON.parse(readFileSync(file, "utf8")) as VoiceManifest;
  let moved = 0;
  let failed = 0;
  for (const [key, url] of Object.entries(m.clips)) {
    if (url.startsWith(publicUrl)) continue;
    try {
      let audio = readCached(m.coach, key);
      if (!audio) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`download ${res.status}`);
        audio = Buffer.from(await res.arrayBuffer());
        writeCached(m.coach, key, audio);
      }
      m.clips[key] = await store.put(m.coach, key, audio);
      moved++;
    } catch (err) {
      failed++;
      if (failed === 1) console.error(`  ${m.coach}: ${String(err).slice(0, 120)}`);
    }
  }
  writeFileSync(file, `${JSON.stringify(m, null, 1)}\n`);
  console.log(`${m.coach}: moved ${moved}, failed ${failed}`);
}
