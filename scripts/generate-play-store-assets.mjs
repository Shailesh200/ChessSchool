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
import { access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/mobile/store-assets/play-store");
const icon = join(out, "icon-512.png");

const retired = [
  "feature-graphic-1024x500.png",
  "screenshots/01-academy.png",
  "screenshots/04-play.png",
  "screenshots/05-review.png",
  "screenshots/06-profile.png",
];

const iconStat = await stat(icon);
if (iconStat.size !== 29284) {
  throw new Error(`refusing to continue: icon-512.png changed (${iconStat.size} bytes)`);
}
for (const name of retired) {
  try {
    await access(join(out, name));
  } catch {
    continue;
  }
  throw new Error(`refusing to leave retired asset in place: ${name}`);
}
console.log(
  "Phone screenshots are not generated here. Use apps/mobile/maestro/store-shots.yaml. icon-512.png was not rewritten.",
);
