import { SPOKEN_PHRASES, spokenLines, type Step } from "@chessschool/chess";
import { coachOf, coachSample, COACHES, isCoachId, voiceKey } from "@chessschool/design";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_COURSE_FILE, VOICE_DIR } from "./seed-course";
import type { VoiceManifest } from "../src/voice";
import { r2, readCached, writeCached } from "./voice-store";
import { localizeSteps, type CourseText } from "../src/course-text";

/**
 * Records a coach's lines with ElevenLabs and uploads them to Cloudflare R2, earliest lessons first.
 * Every clip is also kept in the local voice cache; cached lines are uploaded without re-recording.
 * Usage: voice:build --coach meera [--lang hi] [--max-chars 70000] [--reserve 15000] [--concurrency 4]
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
/** Characters each period that batch runs leave untouched, for new lines. Override with --reserve. */
const RESERVE = Number(arg("--reserve") ?? 15_000);
const concurrency = Math.max(1, Math.min(5, Number(arg("--concurrency") ?? 4)));

const lang = arg("--lang") ?? "en";
const course = JSON.parse(readFileSync(DEFAULT_COURSE_FILE, "utf8")) as { lessons: { id: string; steps: Step[] }[] };
const text: CourseText | null = lang === "en" ? null : JSON.parse(readFileSync(join(VOICE_DIR, "..", `course.${lang}.json`), "utf8"));
// shortcut: Hindi runs voice the lesson lines only; the runner's fixed praise phrases stay English until they are translated.
const phrases = lang === "en" ? SPOKEN_PHRASES : [];
const lines = new Map<string, string>();
// The Settings sample in this coach's own voice. Meera also reads the other coaches' Hindi samples, as the stand-in voice.
const samples = (lang === "hi" && coach === "meera" ? COACHES.map((c) => coachSample(c.id, "hi")) : [coachSample(coach, lang === "hi" ? "hi" : "en")]).filter((t): t is string => Boolean(t));
for (const t of [...samples, ...phrases, ...course.lessons.flatMap((l) => spokenLines(localizeSteps(l.steps, text?.lessons[l.id]?.steps)))]) lines.set(voiceKey(t), t.replace(/\s+/g, " ").trim());

const file = join(VOICE_DIR, `${coach}.json`);
const manifest: VoiceManifest = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { coach, clips: {} };
const missing = [...lines].filter(([key]) => !manifest.clips[key]);
const needChars = missing.reduce((n, [, t]) => n + t.length, 0);
console.log(`coach: ${coach} · language: ${lang}`);
console.log(`lines: ${lines.size} · recorded: ${lines.size - missing.length} · missing: ${missing.length} (${needChars} characters)`);
if (!maxChars) {
  console.log("dry-run: pass --max-chars to record");
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const store = r2();
if (!apiKey || !store) {
  console.error("ELEVENLABS_API_KEY and R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL are required");
  process.exit(1);
}
const sub = (await (await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": apiKey } })).json()) as { character_count: number; character_limit: number };
const left = sub.character_limit - sub.character_count;
// Monthly batches never spend the last RESERVE characters: they stay for new lines (a new bot, coach or lesson).
const budget = Math.max(0, Math.min(maxChars, left - RESERVE));
console.log(`ElevenLabs characters left this period: ${left}; keeping ${RESERVE} in reserve; this run may use ${budget}`);
if (left - RESERVE < needChars) console.warn(`Heads up: ${needChars} characters are still missing for ${coach} (${lang}); this period's credit only covers ${Math.max(0, left - RESERVE)} after the reserve.`);

let queue: [string, string][] = [];
let planned = 0;
// Lines already in the local cache cost nothing to upload again.
for (const item of missing) {
  if (readCached(coach, item[0])) {
    queue.push(item);
    continue;
  }
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
  const cached = readCached(coach, key);
  if (cached) {
    manifest.clips[key] = await store!.put(coach, key, cached);
    return save();
  }
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
  writeCached(coach, key, audio);
  manifest.clips[key] = await store!.put(coach, key, audio);
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
