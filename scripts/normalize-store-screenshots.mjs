#!/usr/bin/env node
/**
 * Play Store phone shots from the capture job: 1080×1920, no alpha.
 *
 * The emulator profile is pixel_2 (1080×1920 at 420 dpi). This does not resize.
 * It flattens any alpha channel and rejects a frame that is not already
 * 1080×1920.
 *
 *   node scripts/normalize-store-screenshots.mjs <raw-dir> <out-dir>
 */
import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";

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
  const out = join(dest, basename(file));
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
