import { SPOKEN_PHRASES, spokenLines, type Step } from "@chessschool/chess";
import { coachOf, isCoachId, voiceKey } from "@chessschool/design";
import { put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_COURSE_FILE, VOICE_DIR } from "./seed-course";
import type { VoiceManifest } from "../src/voice";

/**
 * Records a coach's lines with ElevenLabs and uploads them to Vercel Blob, earliest lessons first.
 * Usage: voice:build --coach meera [--max-chars 70000] [--concurrency 4]
 * Without --max-chars it only reports what is missing. Progress is saved after every clip, so a
 * stopped run picks up where it left off. Load the result into the database with seed:course --apply.
 */
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const coach = arg("--coach") ?? "";
if (!isCoachId(coach)) {
  console.error("--coach must be one of meera, vikram, rohan, tara");
  process.exit(1);
}
const maxChars = Number(arg("--max-chars") ?? 0);
const concurrency = Math.max(1, Math.min(5, Number(arg("--concurrency") ?? 4)));

const course = JSON.parse(readFileSync(DEFAULT_COURSE_FILE, "utf8")) as { lessons: { id: string; steps: Step[] }[] };
const lines = new Map<string, string>();
for (const text of [...SPOKEN_PHRASES, ...course.lessons.flatMap((l) => spokenLines(l.steps))]) lines.set(voiceKey(text), text.replace(/\s+/g, " ").trim());

const file = join(VOICE_DIR, `${coach}.json`);
const manifest: VoiceManifest = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { coach, clips: {} };
const missing = [...lines].filter(([key]) => !manifest.clips[key]);
const needChars = missing.reduce((n, [, t]) => n + t.length, 0);
console.log(`coach: ${coach}`);
console.log(`lines: ${lines.size} · recorded: ${lines.size - missing.length} · missing: ${missing.length} (${needChars} characters)`);
if (!maxChars) {
  console.log("dry-run: pass --max-chars to record");
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!apiKey || !blobToken) {
  console.error("ELEVENLABS_API_KEY and BLOB_READ_WRITE_TOKEN are required");
  process.exit(1);
}
const sub = (await (await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": apiKey } })).json()) as { character_count: number; character_limit: number };
const left = sub.character_limit - sub.character_count;
const budget = Math.min(maxChars, left);
console.log(`ElevenLabs characters left this period: ${left}; this run may use ${budget}`);

let queue = [];
let planned = 0;
for (const item of missing) {
  if (planned + item[1].length > budget) break;
  planned += item[1].length;
  queue.push(item);
}
console.log(`recording ${queue.length} lines (${planned} characters)`);
mkdirSync(VOICE_DIR, { recursive: true });
const save = () => writeFileSync(file, `${JSON.stringify(manifest, null, 1)}\n`);

let done = 0;
let failed = 0;
async function record([key, text]: [string, string], attempt = 1): Promise<void> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${coachOf(coach as never).voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": apiKey!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  // 409: the library voice is still being added on first use; 429/5xx: busy. Back off and retry.
  if ((res.status === 409 || res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return record([key, text], attempt + 1);
  }
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  const blob = await put(`voice/${coach}/${key}.mp3`, audio, { access: "public", contentType: "audio/mpeg", addRandomSuffix: false, allowOverwrite: true, token: blobToken });
  manifest.clips[key] = blob.url;
  save();
}
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await record(item);
        done++;
        if (done % 50 === 0) console.log(`  ${done} recorded`);
      } catch (err) {
        failed++;
        console.error(`  failed: ${item[1].slice(0, 40)}… ${String(err).slice(0, 160)}`);
        if (/quota|401|402/.test(String(err))) queue = [];
      }
    }
  }),
);
console.log(`done: ${done} recorded, ${failed} failed; manifest ${file}`);
