#!/usr/bin/env node
/**
 * Guard for Play listing files that must stay as committed.
 *
 * Does not write icon-512.png. Does not write feature-graphic-1024x500.png.
 * Does not write the retired screenshot names (01-academy, 04-play, 05-review,
 * 06-profile). Does not run a web/Playwright capture.
 *
 * Phone screenshots come from the Android app:
 * apps/mobile/maestro/store-shots.yaml
 * (see apps/mobile/store-assets/play-store/SHOTS.md).
 *
 * Usage: node scripts/generate-play-store-assets.mjs
 */
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/mobile/store-assets/play-store");

export const RETIRED_PLAY_ASSETS = Object.freeze([
  "feature-graphic-1024x500.png",
  "screenshots/01-academy.png",
  "screenshots/04-play.png",
  "screenshots/05-review.png",
  "screenshots/06-profile.png",
]);

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG IHDR. Does not decode the image. */
export function readPngSize(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("icon-512.png is not a PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Throw if a retired Play asset name is present. `present` is a list of relative paths. */
export function assertNoRetiredPlayAssets(present) {
  const found = new Set(present);
  for (const name of RETIRED_PLAY_ASSETS) {
    if (found.has(name)) {
      throw new Error(`refusing to leave retired asset in place: ${name}`);
    }
  }
}

/** icon-512.png must be a 512×512 PNG, and retired names must be absent. */
export async function assertPlayStoreAssets(dir) {
  const bytes = await readFile(join(dir, "icon-512.png"));
  const { width, height } = readPngSize(bytes);
  if (width !== 512 || height !== 512) {
    throw new Error(`icon-512.png must be 512×512 (got ${width}×${height})`);
  }
  const present = [];
  for (const name of RETIRED_PLAY_ASSETS) {
    try {
      await access(join(dir, name));
    } catch {
      continue;
    }
    present.push(name);
  }
  assertNoRetiredPlayAssets(present);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
  await assertPlayStoreAssets(out);
  console.log(
    "Phone screenshots are not generated here. Use apps/mobile/maestro/store-shots.yaml. icon-512.png was not rewritten.",
  );
}
