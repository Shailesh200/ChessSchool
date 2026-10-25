#!/usr/bin/env node
/**
 * Phone screenshots for the Play listing.
 *
 * Does not write icon-512.png. Does not write feature-graphic-1024x500.png.
 * Does not write the retired screenshot names (01-academy, 04-play, 05-review,
 * 06-profile). The approved icon and feature graphic stay as committed files.
 *
 * Screenshots come from apps/mobile/store-assets/play-store/capture.mjs, which
 * needs system Chrome and a local web app (see that file's header).
 *
 * Usage: node scripts/generate-play-store-assets.mjs
 */
import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/mobile/store-assets/play-store");
const capture = join(out, "capture.mjs");
const icon = join(out, "icon-512.png");

const retired = [
  "feature-graphic-1024x500.png",
  "screenshots/01-academy.png",
  "screenshots/04-play.png",
  "screenshots/05-review.png",
  "screenshots/06-profile.png",
];

const before = await stat(icon);
const child = spawn(process.execPath, [capture, "screens"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
const code = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", resolve);
});
if (code !== 0) process.exit(code ?? 1);

const after = await stat(icon);
if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
  throw new Error("refusing to continue: icon-512.png changed");
}
for (const name of retired) {
  try {
    await access(join(out, name));
  } catch {
    continue;
  }
  throw new Error(`refusing to leave retired asset in place: ${name}`);
}
console.log("Play phone screenshots updated. icon-512.png was not rewritten.");
