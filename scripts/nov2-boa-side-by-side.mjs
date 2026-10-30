#!/usr/bin/env node
/** Build side-by-side PNGs (reference | implementation) at 390px width for docs/nov2/boa/. */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const refDir = path.join(root, "docs/nov2/boa/reference");
const implDir = path.join(root, "docs/nov2/boa/implement");
const outDir = path.join(root, "docs/nov2/boa");

const pairs = [
  ["19a-forgot-password-390.png", "19a-forgot-password-entry-390.png"],
  ["19a-forgot-password-sent-390.png", "19a-forgot-password-sent-390.png"],
  ["19b-reset-password-390.png", "19b-reset-password-390.png"],
  ["19b-reset-password-error-390.png", "19b-reset-password-error-390.png"],
  ["19b-reset-password-strong-390.png", "19b-reset-password-strong-390.png"],
  ["19b-reset-password-success-390.png", "19b-reset-password-success-390.png"],
  ["01-splash.png", "01-splash-390.png"],
  ["02a-onboarding-goal.png", "02a-onboarding-goal-390.png"],
  ["02b-onboarding-level.png", "02b-onboarding-level-390.png"],
  ["16-auth-390.png", "16-auth-signin-390.png"],
  ["16-auth-signup-390.png", "16-auth-signup-390.png"],
  ["16-auth-errors-390.png", "16-auth-errors-390.png"],
  ["12-play-hub-390.png", "12-play-hub-390.png"],
  ["12-play-match-390.png", "12-play-match-390.png"],
  ["12-play-match-ash-390.png", "12-play-match-ash-390.png"],
  ["12-play-match-rex-390.png", "12-play-match-rex-390.png"],
  ["12-play-match-skye-390.png", "12-play-match-skye-390.png"],
  ["12-play-match-390-dark.png", "12-play-match-dark-390.png"],
  ["12-play-won-390.png", "12-play-won-390.png"],
  ["12-play-lost-390.png", "12-play-lost-390.png"],
];

async function sideBySide(refName, implName, outName) {
  const refPath = path.join(refDir, refName);
  const implPath = path.join(implDir, implName);
  if (!fs.existsSync(refPath)) {
    console.warn("skip (no ref):", refName);
    return;
  }
  if (!fs.existsSync(implPath)) {
    console.warn("skip (no impl):", implName);
    return;
  }
  const height = 844;
  const refBuf = await sharp(refPath).resize(390, height, { fit: "cover" }).png().toBuffer();
  const implBuf = await sharp(implPath).resize(390, height, { fit: "cover" }).png().toBuffer();
  const labelH = 28;
  const out = await sharp({
    create: {
      width: 390 * 2,
      height: height + labelH,
      channels: 3,
      background: "#111",
    },
  })
    .composite([
      { input: refBuf, left: 0, top: labelH },
      { input: implBuf, left: 390, top: labelH },
    ])
    .png()
    .toBuffer();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, outName), out);
  console.log("wrote", outName);
}

for (const [ref, impl] of pairs) {
  const outName = impl.replace(/-390\.png$/, "-side-by-side.png").replace(/\.png$/, "-side-by-side.png");
  await sideBySide(ref, impl, outName.includes("side-by-side") ? outName : `${path.basename(impl, ".png")}-side-by-side.png`);
}
