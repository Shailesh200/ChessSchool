#!/usr/bin/env node
/**
 * Play Store phone shots from the capture job: 1080×1920, no alpha.
 *
 * The emulator profile is pixel_2 (1080×1920 at 420 dpi). This does not resize.
 * It flattens any alpha channel and rejects a frame that is not already
 * 1080×1920.
 *
 * Names match apps/mobile/store-assets/play-store/SHOTS.md on the store-shot
 * lane. Retired names such as 01-academy.png and 04-play.png are rejected.
 *
 *   node scripts/normalize-store-screenshots.mjs --self-test
 *   node scripts/normalize-store-screenshots.mjs <raw-dir> <out-dir>
 */
import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";

/** File names the flow writes. Keep this list identical to SHOTS.md. */
export const STORE_SHOT_FILES = Object.freeze([
  "01-campus.png",
  "02-class-journey.png",
  "03-lesson.png",
  "04-bot-game.png",
  "05-tactic.png",
  "06-review.png",
]);

const ALLOWED = new Set(STORE_SHOT_FILES);
const RETIRED = new Set([
  "01-academy.png",
  "04-play.png",
  "05-review.png",
  "06-profile.png",
]);

export function canonicalShotName(file) {
  const name = basename(file);
  if (RETIRED.has(name)) {
    throw new Error(
      `${name} is a retired Play screenshot name. Use ${STORE_SHOT_FILES.join(", ")}.`,
    );
  }
  if (!ALLOWED.has(name)) {
    throw new Error(
      `${name} is not a Play screenshot name. Expected ${STORE_SHOT_FILES.join(", ")}.`,
    );
  }
  return name;
}

function selfTest() {
  for (const name of STORE_SHOT_FILES) {
    if (canonicalShotName(name) !== name) throw new Error(`expected to keep ${name}`);
  }
  for (const name of RETIRED) {
    let threw = false;
    try {
      canonicalShotName(name);
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("retired")) throw new Error("retired name was not rejected");
    }
    if (!threw) throw new Error(`expected reject for ${name}`);
  }
  let threw = false;
  try {
    canonicalShotName("07-extra.png");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("expected reject for an unknown name");
  console.log("✓ normalize-store-screenshots self-test");
}

if (process.argv[2] === "--self-test") {
  try {
    selfTest();
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  process.exit(0);
}

const src = process.argv[2];
const dest = process.argv[3];
if (!src || !dest) {
  console.error("Usage: normalize-store-screenshots.mjs <raw-dir> <out-dir>");
  process.exit(1);
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "debug") continue;
      walk(path, acc);
    } else if (entry.name.endsWith(".png")) {
      acc.push(path);
    }
  }
  return acc;
}

/** PNG IHDR colour type. 2 = truecolour RGB. 6 = RGBA. */
function pngColorType(path) {
  const buf = readFileSync(path);
  if (buf.length < 26 || buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${basename(path)} is not a PNG`);
  }
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${basename(path)} is missing IHDR`);
  }
  return buf[25];
}

const COLOR = {
  0: "greyscale",
  2: "RGB",
  3: "indexed",
  4: "greyscale+alpha",
  6: "RGBA",
};

const files = walk(src);
if (!files.length) {
  console.error(`No PNG screenshots found under ${src}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

for (const file of files) {
  const meta = await sharp(file).metadata();
  if (meta.width !== 1080 || meta.height !== 1920) {
    console.error(
      `${basename(file)} is ${meta.width}x${meta.height}. Expected 1080x1920 from the pixel_2 profile. Not resizing.`,
    );
    process.exit(1);
  }
  let name;
  try {
    name = canonicalShotName(file);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  const out = join(dest, name);
  await sharp(file).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toFile(out);
  const after = await sharp(out).metadata();
  const colorType = pngColorType(out);
  if (after.hasAlpha || colorType !== 2) {
    console.error(
      `${basename(out)} still has an alpha channel (colorType=${colorType}, hasAlpha=${after.hasAlpha}).`,
    );
    process.exit(1);
  }
  console.log(
    `${basename(out)} ${after.width}x${after.height} colorType=${colorType} (${COLOR[colorType] ?? "unknown"}, no alpha)`,
  );
}
