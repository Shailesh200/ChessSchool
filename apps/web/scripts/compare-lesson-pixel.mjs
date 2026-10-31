#!/usr/bin/env node
/**
 * Muse design vs /dev/lesson-kit pixel diff (% viewport pixels, pixelmatch threshold 0.1).
 * Usage: BASE_URL=http://localhost:3210 node apps/web/scripts/compare-lesson-pixel.mjs
 * Output: table to stdout; PNGs under SCREENSHOT_OUT_DIR (not committed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN = join(WEB, "../../muse-design/code");
const OUT = process.env.SCREENSHOT_OUT_DIR ?? "/opt/cursor/artifacts/lesson-pixel";
const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const THRESHOLD = 0.1;

/** @type {Array<{ id: string; designLight: string; designDark: string; app: string }>} */
const SCREENS = [
  {
    id: "05a-lesson-intro",
    designLight: "screens/05a-lesson-intro.html",
    designDark: "screens/05a-lesson-intro.html",
    app: "05a",
  },
  {
    id: "05b-lesson-drill",
    designLight: "screens/05b-lesson-drill.html",
    designDark: "screens/05b-lesson-drill-dark.html",
    app: "05b",
  },
  {
    id: "05c-lesson-tap-squares",
    designLight: "screens/05c-lesson-tap-squares.html",
    designDark: "screens/05c-lesson-tap-squares-dark.html",
    app: "05c",
  },
  {
    id: "05d-lesson-why-quiz",
    designLight: "screens/05d-lesson-why-quiz.html",
    designDark: "screens/05d-lesson-why-quiz.html",
    app: "05d",
  },
  {
    id: "06a-bar-correct",
    designLight: "screens/06a-bar-correct.html",
    designDark: "screens/06a-bar-correct-dark.html",
    app: "06a",
  },
  {
    id: "06b-bar-wrong",
    designLight: "screens/06b-bar-wrong.html",
    designDark: "screens/06b-bar-wrong.html",
    app: "06b",
  },
  {
    id: "07-hint",
    designLight: "screens/07-hint.html",
    designDark: "screens/07-hint-dark.html",
    app: "07",
  },
  {
    id: "08-lesson-complete",
    designLight: "screens/08-lesson-complete.html",
    designDark: "screens/08-lesson-complete.html",
    app: "08",
  },
];

const VIEWPORTS = [
  { tag: "390", width: 390, height: 844 },
  { tag: "1440", width: 1440, height: 900 },
];

function pctDiff(a, b) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const out = new PNG({ width, height });
  const pa =
    a.width === width && a.height === height
      ? a
      : padPng(a, width, height);
  const pb =
    b.width === width && b.height === height
      ? b
      : padPng(b, width, height);
  const mismatched = pixelmatch(pa.data, pb.data, out.data, width, height, {
    threshold: THRESHOLD,
  });
  return { pct: (mismatched / (width * height)) * 100, out, width, height };
}

function padPng(src, width, height) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      if (x < src.width && y < src.height) {
        const sj = (y * src.width + x) * 4;
        out.data[si] = src.data[sj];
        out.data[si + 1] = src.data[sj + 1];
        out.data[si + 2] = src.data[sj + 2];
        out.data[si + 3] = src.data[sj + 3];
      } else {
        out.data[si + 3] = 255;
      }
    }
  }
  return out;
}

async function shotDesign(page, rel, theme) {
  await page.goto(`file://${join(DESIGN, rel)}`, { waitUntil: "load" });
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
  }, theme);
  await page.waitForTimeout(400);
  return page.screenshot({ type: "png" });
}

async function shotApp(page, screen) {
  const testId =
    screen === "08" ? "lesson-complete-screen" : "lesson-stage";
  await page.goto(`${BASE}/dev/lesson-kit?screen=${screen}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator(`[data-testid="${testId}"]`).waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const t = document.documentElement.getAttribute("data-theme");
      const raw = localStorage.getItem("chessschool.settings");
      if (!raw) return false;
      const appTheme = JSON.parse(raw)?.state?.appTheme;
      if (appTheme === "midnight") return t === "dark";
      return t === "light";
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(600);
  return page.screenshot({ type: "png" });
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const table = {};

for (const vp of VIEWPORTS) {
  table[vp.tag] = {};
  for (const theme of ["light", "dark"]) {
    const appTheme = theme === "dark" ? "midnight" : "default";
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await context.addInitScript((at) => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({ state: { uiKit: "premium", appTheme: at }, version: 12 }),
      );
    }, appTheme);
    const page = await context.newPage();

    for (const sc of SCREENS) {
      const designFile = theme === "dark" ? sc.designDark : sc.designLight;
      const dBuf = await shotDesign(page, designFile, theme);
      const aBuf = await shotApp(page, sc.app);
      const dPng = PNG.sync.read(dBuf);
      const aPng = PNG.sync.read(aBuf);
      const { pct, out } = pctDiff(dPng, aPng);
      const tag = `${sc.id}-${vp.tag}-${theme}`;
      writeFileSync(join(OUT, `${tag}-design.png`), dBuf);
      writeFileSync(join(OUT, `${tag}-app.png`), aBuf);
      writeFileSync(join(OUT, `${tag}-diff.png`), PNG.sync.write(out));
      if (!table[vp.tag][sc.id]) table[vp.tag][sc.id] = {};
      table[vp.tag][sc.id][theme] = pct.toFixed(1);
      console.log(`${sc.id} @${vp.tag} ${theme}: ${pct.toFixed(1)}%`);
    }
    await context.close();
  }
}

await browser.close();

console.log("\n| Screen | 390 light | 390 dark | 1440 light | 1440 dark |");
console.log("|---|---|---|---|---|");
for (const sc of SCREENS) {
  const row = [
    sc.id,
    table["390"]?.[sc.id]?.light ?? "—",
    table["390"]?.[sc.id]?.dark ?? "—",
    table["1440"]?.[sc.id]?.light ?? "—",
    table["1440"]?.[sc.id]?.dark ?? "—",
  ];
  console.log(`| ${row.join(" | ")} |`);
}
