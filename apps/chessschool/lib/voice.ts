import { copy, language, voiceKey } from "@chessschool/design";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ensureAudioMode } from "./feedback";
import { useApp } from "./state";

/**
 * Coach voice. Clips live on R2 as small MP3s; streaming each one on demand made lines start late (or
 * not at all on a slow connection). Now every clip of the open lesson is downloaded to the cache folder
 * in reading order as soon as the lesson's clip list arrives, and lines play from disk through one
 * reused player. A line whose file isn't ready waits briefly for it, then streams as a fallback.
 */

let player: AudioPlayer | null = null;
let loaded = "";
/** Bumped by every play/stop, so a line that was waiting for its download never starts late over a newer one. */
let turn = 0;

const manifests = new Map<string, Record<string, string>>();
const manifestRequests = new Map<string, Promise<Record<string, string>>>();

/* ---------- clip files ---------- */

const onDisk = new Map<string, string>();
const downloads = new Map<string, Promise<string | null>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
const PARALLEL = 3;
/** How long a line waits for its file before streaming instead. */
const WAIT_MS = 1200;

let folder: Directory | null = null;
function voiceDir(): Directory | null {
  try {
    if (!folder) {
      folder = new Directory(Paths.cache, "voice");
      if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    }
    return folder;
  } catch {
    return null;
  }
}

/** Clip URLs end in <coach>/<key>.mp3, which is unique and stable. */
const fileName = (url: string) => url.split("/").slice(-2).join("-").replace(/[^\w.-]/g, "_");

/** The cached file for a clip, if it has been downloaded (this run or an earlier one). */
export function cachedClip(url: string): string | null {
  const hit = onDisk.get(url);
  if (hit) return hit;
  const dir = voiceDir();
  if (!dir) return null;
  try {
    const f = new File(dir, fileName(url));
    if (f.exists && (f.size ?? 0) > 0) {
      onDisk.set(url, f.uri);
      return f.uri;
    }
  } catch {}
  return null;
}

function pump() {
  while (active < PARALLEL && queue.length) {
    const job = queue.shift()!;
    active++;
    void job().finally(() => {
      active--;
      pump();
    });
  }
}

/** Downloads a clip into the cache (once). `urgent` jumps the queue for the line about to be spoken. */
export function prefetchClip(url: string, urgent = false): Promise<string | null> {
  const hit = cachedClip(url);
  if (hit) return Promise.resolve(hit);
  const running = downloads.get(url);
  if (running) return running;
  const dir = voiceDir();
  if (!dir) return Promise.resolve(null);
  const done = new Promise<string | null>((resolve) => {
    const job = async () => {
      try {
        const f = await File.downloadFileAsync(url, new File(dir, fileName(url)), { idempotent: true });
        onDisk.set(url, f.uri);
        resolve(f.uri);
      } catch {
        // Offline or a missing clip: forget the attempt so a later line can try again.
        downloads.delete(url);
        resolve(null);
      }
    };
    if (urgent) queue.unshift(job);
    else queue.push(job);
  });
  downloads.set(url, done);
  pump();
  return done;
}

/** Queues clips in the order they will be heard. */
export function prefetchClips(urls: (string | undefined)[]) {
  for (const url of urls) if (url) void prefetchClip(url);
}

/* ---------- playback ---------- */

function start(src: string, rate: number) {
  try {
    if (!player) player = createAudioPlayer(src, { updateInterval: 1000 });
    else if (loaded !== src) player.replace(src);
    else void player.seekTo(0);
    loaded = src;
    player.setPlaybackRate(rate);
    player.play();
  } catch {}
}

/** Plays one clip, cutting off whatever the coach was saying straight away. */
export function playClip(url: string, rate = 1) {
  ensureAudioMode();
  const mine = ++turn;
  stopPlayer();
  const hit = cachedClip(url);
  if (hit) return start(hit, rate);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS));
  void Promise.race([prefetchClip(url, true), timeout]).then((file) => {
    if (mine === turn) start(file ?? url, rate);
  });
}

function stopPlayer() {
  try {
    player?.pause();
  } catch {}
}

export function stopVoice() {
  turn++;
  stopPlayer();
}

/* ---------- clip lists ---------- */

function loadManifest(coach: string, lesson: string): Promise<Record<string, string>> {
  const id = `${coach}:${language()}:${lesson}`;
  const hit = manifests.get(id);
  if (hit) return Promise.resolve(hit);
  let req = manifestRequests.get(id);
  if (!req) {
    req = api
      .voice(coach, lesson)
      .then((r) => {
        manifests.set(id, r.clips);
        return r.clips;
      })
      .finally(() => manifestRequests.delete(id));
    manifestRequests.set(id, req);
  }
  return req;
}

/** The chosen coach's clips for a lesson (empty until recorded, or offline). */
export function useClips(coach: string, lesson: string | null) {
  const id = `${coach}:${language()}:${lesson}`;
  const [clips, setClips] = useState<Record<string, string> | null>(() => manifests.get(id) ?? null);
  useEffect(() => {
    if (!lesson) return;
    const hit = manifests.get(id);
    if (hit) return setClips(hit);
    let live = true;
    loadManifest(coach, lesson)
      .then((c) => live && setClips(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, coach, lesson]);
  return clips;
}

/** The Settings sample for a coach: their own greeting once recorded, else any line of theirs. */
export function sampleClip(coach: string, clips: Record<string, string> | null): string | undefined {
  if (!clips) return undefined;
  const line = copy.coach.samples[coach];
  return (line ? clips[voiceKey(line)] : undefined) ?? Object.values(clips)[0];
}

/**
 * `say(text)` plays the coach's recording of that line, when there is one and voice is on.
 * `lines` are the lesson's spoken lines in order; their clips are downloaded ahead of time.
 */
export function useCoachVoice(lesson: string | null, lines: readonly string[] = []) {
  const { prefs } = useApp().state;
  const coach = prefs.coach ?? "meera";
  const clips = useClips(coach, prefs.voice ? lesson : null);
  useEffect(() => stopVoice, []);
  const order = lines.join("\n");
  useEffect(() => {
    if (!clips) return;
    const ahead = order ? order.split("\n").map((t) => clips[voiceKey(t)]) : [];
    // Lines first in reading order, then the praise phrases.
    prefetchClips([...ahead, ...Object.values(clips)]);
  }, [clips, order]);
  return useCallback(
    (text: string) => {
      const url = prefs.voice ? clips?.[voiceKey(text)] : undefined;
      if (url) playClip(url, prefs.voiceSpeed);
    },
    [clips, prefs.voice, prefs.voiceSpeed],
  );
}
