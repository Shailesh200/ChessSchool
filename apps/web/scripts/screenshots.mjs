// Capture mobile screenshots using the system Chrome. Server must be running.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE || "http://localhost:3210";
const out = "screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 12/13/14 logical size
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

const shots = [
  { path: "/", name: "01-home", wait: 900 },
  { path: "/lesson/pawn-power", name: "02-lesson", wait: 1100 },
  { path: "/play", name: "03-play", wait: 1300 },
  { path: "/review", name: "04-review", wait: 700 },
  { path: "/profile", name: "05-profile", wait: 700 },
  { path: "/settings", name: "06-settings", wait: 700 },
];

for (const s of shots) {
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `${out}/${s.name}.png` });
  console.log("✓", s.name);
}

await browser.close();
console.log("Screenshots saved to", out);
