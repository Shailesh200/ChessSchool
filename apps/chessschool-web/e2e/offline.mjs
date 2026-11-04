// PWA check against a production server: the service worker caches the shell,
// then pages still open with the network off. Usage: node e2e/offline.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3101";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
let ok = true;

await page.goto(`${BASE}/welcome`);
await page.getByRole("button", { name: "Skip" }).click();
await page.waitForURL("**/today");
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  await new Promise((r) => setTimeout(r, 1500));
});
const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller) || navigator.serviceWorker.getRegistration().then((r) => Boolean(r?.active)));
console.log("service worker active:", controlled);
if (!controlled) ok = false;

const manifest = await (await page.request.get(`${BASE}/manifest.webmanifest`)).json();
console.log("manifest:", manifest.name, manifest.display, manifest.icons.length, "icons");

await ctx.setOffline(true);
for (const route of ["/today", "/rooms", "/you"]) {
  await page.goto(`${BASE}${route}`).catch(() => {});
  const text = await page.locator("main").innerText().catch(() => "");
  const fine = text.length > 20;
  console.log(`offline ${route}:`, fine ? "renders" : "BLANK");
  if (!fine) ok = false;
}
const banner = await page.getByText("You're offline").first().isVisible().catch(() => false);
console.log("offline banner:", banner);
if (!banner) ok = false;
await page.screenshot({ path: "/tmp/cs-shots/pwa-offline.png" });
await browser.close();
console.log(ok ? "PWA OK" : "PWA FAILED");
process.exitCode = ok ? 0 : 1;
