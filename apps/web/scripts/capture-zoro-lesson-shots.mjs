#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = process.env.SCREENSHOT_OUT_DIR ?? "/opt/cursor/artifacts/zoro-shots";
const KIT = join(ROOT, "../../design-kit/screens");
const BASE = process.env.BASE_URL ?? "http://localhost:3210";

const SCREENS = ["05a", "05b", "05c", "05d", "06a", "06b", "07", "08"] as const;
const KIT_HTML: Record<(typeof SCREENS)[number], string> = {
  "05a": "05a-lesson-intro.html",
  "05b": "05b-lesson-drill.html",
  "05c": "05c-lesson-tap-squares.html",
  "05d": "05d-lesson-why-quiz.html",
  "06a": "06a-bar-correct.html",
  "06b": "06b-bar-wrong.html",
  "07": "07-hint.html",
  "08": "08-lesson-complete.html",
};

const WIDTHS = [
  { tag: "390", width: 390, height: 844 },
  { tag: "1280", width: 1280, height: 800 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of WIDTHS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await context.addInitScript(() => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({ state: { uiKit: "premium", appTheme: "default" }, version: 12 }),
    );
  });
  const page = await context.newPage();
  for (const id of SCREENS) {
    await page.goto(`file://${join(KIT, KIT_HTML[id])}`);
    await page.waitForTimeout(400);
    const kitPath = join(OUT, `kit-${id}-${vp.tag}.png`);
    await page.screenshot({ path: kitPath, fullPage: true });
    console.log("wrote", kitPath);
  }
  for (const id of SCREENS) {
    await page.goto(`${BASE}/dev/lesson-kit?screen=${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForTimeout(600);
    const webPath = join(OUT, `web-${id}-${vp.tag}.png`);
    await page.screenshot({ path: webPath, fullPage: true });
    console.log("wrote", webPath);
  }
  await context.close();
}
await browser.close();
