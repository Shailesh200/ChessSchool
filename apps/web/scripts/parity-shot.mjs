// Parity harness: capture the logged-in WEB screen and the APP (Expo web export)
// screen at the same width and composite them side-by-side (web left | app right).
//
// Prereqs:
//   1) Export the app pointed at prod + serve it:
//        cd apps/mobile && EXPO_PUBLIC_API_URL=https://chess-school-alpha.vercel.app \
//          npx expo export --platform web --output-dir dist
//        python3 -m http.server 8088 --directory dist &
//   2) A prod account (PARITY_EMAIL / PARITY_PW).
// Run:  node scripts/parity-shot.mjs <screen>   (screen: home|lesson|play|profile|settings|journal)
// Out:  ./parity-shots/parity-<screen>.png
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const W = Number(process.env.PARITY_W || 393);
const H = Number(process.env.PARITY_H || 853);
const PROD = process.env.PARITY_PROD || "https://chess-school-alpha.vercel.app";
const APP = process.env.PARITY_APP || "http://localhost:8088";
const EMAIL = process.env.PARITY_EMAIL || "parity-bot@duochess.dev";
const PW = process.env.PARITY_PW || "parity12345";
const OUT = "parity-shots";
const screen = process.argv[2] || "home";

const goP = async (p) => { await p.waitForTimeout(300); };
const profileThen = (testId) => async (p) => {
  await p.getByText("Profile", { exact: true }).click().catch(() => {});
  await p.waitForTimeout(1400);
  await p.getByTestId(testId).click().catch(() => {});
  await p.waitForTimeout(1800);
};
// Per-screen: how to reach the same view on each surface, and what to wait for.
const SPECS = {
  home: { web: goP, app: goP, ready: "Start learning" },
  lesson: {
    web: async (p) => { await p.goto(`${PROD}/lesson/board-basics`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => { await p.getByText("Start learning").first().click().catch(() => {}); },
    ready: "Continue",
  },
  play: {
    web: async (p) => { await p.goto(`${PROD}/play`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => { await p.getByText("Play", { exact: true }).click().catch(() => {}); },
    ready: "Start match",
  },
  game: {
    web: async (p) => { await p.goto(`${PROD}/play`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1500); await p.getByText("Start match").click().catch(() => {}); await p.waitForTimeout(2500); },
    app: async (p) => { await p.getByText("Play", { exact: true }).click().catch(() => {}); await p.waitForTimeout(1500); await p.getByText("Start match").click().catch(() => {}); await p.waitForTimeout(2500); },
    ready: null,
  },
  profile: {
    web: async (p) => { await p.goto(`${PROD}/profile`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => { await p.getByText("Profile", { exact: true }).click().catch(() => {}); },
    ready: "Achievements",
  },
  settings: {
    web: async (p) => { await p.goto(`${PROD}/settings`, { waitUntil: "domcontentloaded" }); },
    app: profileThen("hub-Settings"),
    ready: null,
  },
  journal: {
    web: async (p) => { await p.goto(`${PROD}/journal`, { waitUntil: "domcontentloaded" }); },
    app: profileThen("hub-Journal"),
    ready: null,
  },
  homework: {
    web: async (p) => { await p.goto(`${PROD}/plan`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => { await p.getByTestId("homework").click().catch(() => {}); await p.waitForTimeout(1800); },
    ready: null,
  },
  review: {
    web: async (p) => { await p.goto(`${PROD}/review`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => { await p.getByText("Review", { exact: true }).click().catch(() => {}); await p.waitForTimeout(1600); },
    ready: null,
  },
  classes: {
    web: async (p) => { await p.goto(`${PROD}/library`, { waitUntil: "domcontentloaded" }); },
    app: profileThen("hub-Library"),
    ready: null,
  },
  class: {
    web: async (p) => { await p.goto(`${PROD}/class/class-pieces`, { waitUntil: "domcontentloaded" }); },
    app: async (p) => {
      await p.getByText("Profile", { exact: true }).click().catch(() => {});
      await p.waitForTimeout(1400);
      await p.getByTestId("hub-Library").click().catch(() => {});
      await p.waitForTimeout(1800);
      await p.getByTestId("class-class-pieces").click().catch(() => {});
      await p.waitForTimeout(1800);
    },
    ready: null,
  },
};

async function capture(kind) {
  const spec = SPECS[screen] || SPECS.home;
  const isApp = kind === "app";
  const b = await chromium.launch({ channel: "chrome", args: isApp ? ["--disable-web-security"] : [] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  if (isApp) {
    await p.goto(APP, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);
    await p.getByPlaceholder("Email").fill(EMAIL);
    await p.getByPlaceholder("Password").fill(PW);
    await p.getByText("Log in", { exact: true }).click().catch(() => {});
    await p.getByText("Start learning").first().waitFor({ timeout: 20000 }).catch(() => {});
  } else {
    await p.goto(`${PROD}/login`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.fill('input[type="email"]', EMAIL).catch(() => {});
    await p.fill('input[type="password"]', PW).catch(() => {});
    await p.click('button[type="submit"], button:has-text("Log in")').catch(() => {});
    await p.waitForTimeout(3500);
    if (/onboarding|welcome/.test(p.url())) await p.goto(`${PROD}/`, { waitUntil: "domcontentloaded" });
    await p.getByText("Start learning").first().waitFor({ timeout: 15000 }).catch(() => {});
  }
  await (isApp ? spec.app(p) : spec.web(p));
  if (spec.ready) await p.getByText(spec.ready).first().waitFor({ timeout: 12000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${kind}-${screen}.png`, fullPage: true });
  await b.close();
}

mkdirSync(OUT, { recursive: true });
await capture("web");
await capture("app");
const ht = 1200;
const wB = await sharp(`${OUT}/web-${screen}.png`).resize({ height: ht }).toBuffer();
const aB = await sharp(`${OUT}/app-${screen}.png`).resize({ height: ht }).toBuffer();
const wW = (await sharp(wB).metadata()).width, aW = (await sharp(aB).metadata()).width, gap = 30;
await sharp({ create: { width: wW + aW + gap, height: ht, channels: 4, background: "#cbd5e1" } })
  .composite([{ input: wB, left: 0, top: 0 }, { input: aB, left: wW + gap, top: 0 }])
  .png()
  .toFile(`${OUT}/parity-${screen}.png`);
console.log(`wrote ${OUT}/parity-${screen}.png (WEB left | APP right, ${W}px)`);
