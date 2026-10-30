#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "../docs/nov2/sanji-web-a");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  { slug: "01-splash", path: "/splash", design: "01-splash" },
  { slug: "16-auth-login", path: "/login", design: "16-auth" },
  { slug: "19a-forgot-password", path: "/login/forgot", design: "19a-forgot-password" },
  { slug: "19b-reset-password", path: "/account/reset#preview-token", design: "19b-reset-password" },
  { slug: "03-map", path: "/academy", design: "03-map" },
  { slug: "03-map-dark", path: "/academy?premiumMap=dark", design: "03-map-dark" },
  { slug: "03-map-loading", path: "/academy?premiumMap=loading", design: "03-map-loading" },
  { slug: "03-map-empty", path: "/academy?premiumMap=empty", design: "03-map-empty" },
  { slug: "03-map-error", path: "/academy?premiumMap=error", design: "03-map-error" },
  { slug: "03-map-offline", path: "/academy?premiumMap=offline", design: "03-map-offline" },
  { slug: "04-class-detail", path: "/class/class-pieces", design: "04-class-detail" },
  { slug: "09-class-exam", path: "/class/class-pieces/exam", design: "09-class-exam" },
  { slug: "13-profile", path: "/profile", design: "13-profile" },
  { slug: "14-settings", path: "/settings", design: "14-settings" },
  { slug: "15-notify", path: "/notify", design: "15-notify" },
];

const VIEWPORTS = [
  { tag: "390", width: 390, height: 844 },
  { tag: "1280", width: 1280, height: 800 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await context.addInitScript(() => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({ state: { uiKit: "premium", appTheme: "default" }, version: 12 }),
    );
  });
  const page = await context.newPage();
  for (const route of ROUTES) {
    const url = `${BASE}${route.path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(1200);
      const file = join(OUT, `${route.slug}-${vp.tag}.png`);
      await page.screenshot({ path: file });
      console.log("wrote", file);
    } catch (err) {
      console.error("fail", route.slug, vp.tag, String(err));
    }
  }
  await context.close();
}
await browser.close();
