#!/usr/bin/env node
/**
 * PWA (mweb) vs native parity harness (iOS Simulator or Android emulator/device).
 * Captures Playwright screenshots + Maestro native screenshots, diffs, writes HTML report.
 *
 * Prereqs: web @ PARITY_BASE_URL, Metro + dev build, Maestro CLI.
 * Platform: PARITY_PLATFORM=ios (default) | android
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { diffScreenshots } from "./lib/parity-diff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "parity-routes.json"), "utf8"));

const ENV = process.env.PARITY_ENV === "prod" ? "prod" : "local";
const account = MANIFEST.accounts[ENV];
const BASE = (process.env.PARITY_BASE_URL || "http://localhost:3210").replace(/\/$/, "");
const OUT = path.join(ROOT, process.env.PARITY_OUT || "parity/reports");
const { width, height } = MANIFEST.viewport;
const ONLY = process.env.PARITY_SCREEN?.split(",").map((s) => s.trim()).filter(Boolean);
const MAESTRO_FLOWS = path.join(ROOT, "parity", "maestro", "flows");
const METRO_PORT = process.env.PARITY_METRO_PORT || "8081";
const APP_ID = "com.chessschool.app";
const PLATFORM = process.env.PARITY_PLATFORM === "android" ? "android" : "ios";

fs.mkdirSync(OUT, { recursive: true });

function thresholdFor(screen) {
  if (typeof screen.thresholdRatio === "number") return screen.thresholdRatio;
  const key = screen.threshold || "default";
  return MANIFEST.thresholds[key] ?? MANIFEST.thresholds.default;
}

function maestroEnv() {
  return {
    ...process.env,
    PARITY_EMAIL: account.email,
    PARITY_PASSWORD: account.password,
    EXPO_PUBLIC_API_URL: BASE,
    EXPO_PUBLIC_PARITY: "1",
  };
}

function metroEnv() {
  return {
    ...process.env,
    EXPO_PUBLIC_API_URL: BASE,
    EXPO_PUBLIC_PARITY: "1",
  };
}

/**
 * Maestro 2.6 does not interpolate ${VAR} inside openLink URLs (leaves the
 * literal `${PARITY_TOKEN}`). Materialize flows with secrets baked in.
 */
function materializeMaestroFlows(token) {
  const authToken = token ?? "";
  const outDir = path.join(OUT, "maestro-run");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(MAESTRO_FLOWS, outDir, { recursive: true });
  const loginLink =
    `chessschool:///login?email=${encodeURIComponent(account.email)}` +
    `&password=${encodeURIComponent(account.password)}`;
  const replacements = {
    "${PARITY_TOKEN}": authToken,
    "${PARITY_EMAIL}": account.email,
    "${PARITY_PASSWORD}": account.password,
    "${AUTH_LINK}": `chessschool:///parity-auth?token=${authToken}`,
    "${LOGIN_LINK}": loginLink,
  };
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
        continue;
      }
      if (!ent.name.endsWith(".yaml")) continue;
      let text = fs.readFileSync(p, "utf8");
      for (const [needle, value] of Object.entries(replacements)) {
        text = text.split(needle).join(value);
      }
      fs.writeFileSync(p, text);
    }
  };
  walk(outDir);
  return outDir;
}

function runMaestro(flowPath, token) {
  const runDir = materializeMaestroFlows(token);
  const rel = path.relative(MAESTRO_FLOWS, flowPath);
  const materialized = path.join(runDir, rel);
  execSync(`maestro test "${materialized}"`, {
    stdio: "inherit",
    cwd: runDir,
    env: maestroEnv(),
  });
}

async function fetchParityToken() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!res.ok) throw new Error(`API login failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (!body?.token) throw new Error("API login returned no token");
  return body.token;
}

async function loginWeb(context) {
  const res = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email: account.email, password: account.password },
  });
  if (!res.ok()) {
    throw new Error(`API login failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  if (!body?.token) throw new Error("API login returned no token");
  await context.addCookies([
    {
      name: "chessschool_session",
      value: body.token,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function clearWebSession(context) {
  await context.clearCookies();
}

async function captureWeb(page, screen, { authed }) {
  if (screen.auth === "user") {
    if (!authed) throw new Error("captureWeb: expected authed context for user screen");
  } else if (authed) {
    await clearWebSession(page.context());
  }

  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}${screen.web.path}`, { waitUntil: "domcontentloaded" });
  if (screen.web.readyText) {
    await page.getByText(screen.web.readyText, { exact: false }).first().waitFor({ timeout: 20_000 }).catch(() => {});
  }
  for (const text of screen.semantic ?? []) {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
  const out = path.join(OUT, `web-${screen.id}.png`);
  await page.screenshot({ path: out, fullPage: false });
  return out;
}

function captureNative(screen, { nativeAuthed, parityToken }) {
  const flow = path.join(MAESTRO_FLOWS, "capture", `${screen.id}.yaml`);
  const screenshot = path.join(OUT, `native-${screen.id}.png`);
  if (!fs.existsSync(flow)) {
    throw new Error(`Missing Maestro flow: ${flow} — run pnpm parity:generate`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  let navError = null;
  try {
    if (screen.auth === "user" && !nativeAuthed) {
      throw new Error("captureNative: expected nativeAuthed before user screen");
    }
    runMaestro(flow, parityToken);
  } catch (e) {
    navError = e instanceof Error ? e.message : String(e);
  }
  if (PLATFORM === "android") {
    const png = execSync("adb exec-out screencap -p", { maxBuffer: 32 * 1024 * 1024 });
    fs.writeFileSync(screenshot, png);
  } else {
    execSync(`xcrun simctl io booted screenshot "${screenshot}"`, { stdio: "pipe" });
  }
  if (!fs.existsSync(screenshot) || fs.statSync(screenshot).size < 100) {
    throw new Error(`${PLATFORM} screenshot missing/empty: ${screenshot}`);
  }
  return { path: screenshot, navError };
}

function writeReport(results) {
  const failed = results.filter((r) => !r.pass);
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>ChessSchool Parity Report</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f8fafc;color:#1c1b2e}
h1{margin:0 0 8px}.meta{color:#6b6982;margin-bottom:24px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px #1c1b2e14}
th,td{padding:12px 14px;border-bottom:1px solid #e7e6f2;text-align:left;vertical-align:top}
.fail{color:#f43f5e;font-weight:700}.pass{color:#10b981;font-weight:700}
img{max-width:360px;border-radius:8px;border:1px solid #e7e6f2}
code{background:#f1f0f9;padding:2px 6px;border-radius:6px}
</style></head><body>
<h1>PWA ↔ ${PLATFORM === "android" ? "Android" : "iOS"} parity report</h1>
<p class="meta">Env: <code>${ENV}</code> · Platform: <code>${PLATFORM}</code> · Base: <code>${BASE}</code> · Viewport: ${width}×${height} · ${new Date().toISOString()}</p>
<table><thead><tr><th>Screen</th><th>Visual</th><th>Drift</th><th>Side-by-side</th><th>Notes</th></tr></thead><tbody>
${results
  .map(
    (r) => `<tr>
<td><strong>${r.label}</strong><br/><code>${r.id}</code></td>
<td class="${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</td>
<td>${r.semanticOnly ? "semantic only" : `${(r.ratio * 100).toFixed(2)}%`}</td>
<td>${r.sideBySidePath ? `<a href="${path.basename(r.sideBySidePath)}"><img src="${path.basename(r.sideBySidePath)}" alt=""/></a>` : "—"}</td>
<td>${r.error ? `<span class="fail">${r.error}</span>` : r.navError ? `<span class="fail">nav: ${r.navError.slice(0, 80)}…</span>` : (r.notes ?? "")}</td>
</tr>`,
  )
  .join("")}
</tbody></table>
<p><strong>${results.length - failed.length}/${results.length}</strong> screens within tolerance.</p>
</body></html>`;
  const reportPath = path.join(OUT, "index.html");
  fs.writeFileSync(reportPath, html);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n→ Report: ${reportPath}`);
  return { reportPath, failed };
}

async function runScreen(page, screen, { webAuthed, nativeAuthed, parityToken }) {
  const threshold = thresholdFor(screen);
  const semanticOnly = threshold >= 1;
  const entry = {
    id: screen.id,
    label: screen.label,
    notes: screen.notes ?? "",
    semanticOnly,
    pass: false,
    ratio: semanticOnly ? 0 : 1,
  };

  try {
    const webPath = await captureWeb(page, screen, { authed: webAuthed });
    const { path: nativePath, navError } = captureNative(screen, { nativeAuthed, parityToken });
    if (navError) entry.navError = navError;

    if (semanticOnly) {
      entry.pass = !navError;
      entry.ratio = 0;
      entry.sideBySidePath = null;
      console.log(navError ? "→ semantic-only screen (nav failed)" : "→ semantic-only screen (visual diff skipped)");
    } else {
      const diff = await diffScreenshots(webPath, nativePath, path.join(OUT, `${screen.id}-diff.png`), {
        width,
        height,
        threshold,
      });
      entry.ratio = diff.ratio;
      entry.pass = diff.pass && !navError;
      entry.sideBySidePath = diff.sideBySidePath;
      entry.mismatchedPixels = diff.mismatchedPixels;
      console.log(`→ drift ${(diff.ratio * 100).toFixed(2)}% (max ${(threshold * 100).toFixed(0)}%) ${entry.pass ? "PASS" : "FAIL"}`);
    }
  } catch (e) {
    entry.error = e instanceof Error ? e.message : String(e);
    entry.pass = false;
    console.error(`✗ ${screen.id}:`, entry.error);
  }
  return entry;
}

function relaunchDevClient() {
  try {
    fetch(`http://localhost:${METRO_PORT}/reload`, { method: "POST" }).catch(() => undefined);
  } catch {
    /* ignore */
  }
  if (PLATFORM === "android") {
    const metroHost = process.env.PARITY_METRO_HOST || "10.0.2.2";
    execSync(`adb shell am force-stop ${APP_ID} 2>/dev/null || true`, { stdio: "pipe" });
    execSync(
      `adb shell am start -a android.intent.action.VIEW -d "exp+chess-school://expo-development-client/?url=http://${metroHost}:${METRO_PORT}" ${APP_ID}/.MainActivity`,
      { stdio: "pipe", env: metroEnv() },
    );
  } else {
    execSync(`xcrun simctl terminate booted ${APP_ID} 2>/dev/null || true`, { stdio: "pipe" });
    execSync(
      `xcrun simctl launch booted ${APP_ID} "exp+chess-school://expo-development-client/?url=http://localhost:${METRO_PORT}"`,
      { stdio: "pipe", env: metroEnv() },
    );
  }
  execSync("sleep 30", { stdio: "pipe" });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  execSync("node scripts/generate-parity-maestro.mjs", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PARITY_OUT: OUT },
  });

  let screens = MANIFEST.screens;
  if (ONLY?.length) screens = screens.filter((s) => ONLY.includes(s.id));

  const guestScreens = screens.filter((s) => s.auth !== "user");
  const userScreens = screens.filter((s) => s.auth === "user");
  const needsColdBoot = !process.env.PARITY_SKIP_COLD_BOOT;
  const needsAuthLogin = userScreens.length > 0 && !process.env.PARITY_SKIP_AUTH_BOOT;

  if (needsColdBoot && guestScreens.length > 0) {
    console.log("\n══ Cold boot (guest session) ══");
    if (process.env.PARITY_FRESH === "1") {
      if (PLATFORM === "android") {
        execSync(`adb uninstall ${APP_ID} 2>/dev/null || true`, { stdio: "pipe" });
        console.error(
          "✗ PARITY_FRESH=1 requires dev client reinstall — run: cd apps/mobile && EXPO_PUBLIC_API_URL=" +
            BASE +
            " npx expo run:android",
        );
      } else {
        execSync(`xcrun simctl uninstall booted ${APP_ID} 2>/dev/null || true`, { stdio: "pipe" });
        console.error(
          "✗ PARITY_FRESH=1 requires dev client reinstall — run: cd apps/mobile && EXPO_PUBLIC_API_URL=" +
            BASE +
            " npx expo run:ios",
        );
      }
      process.exit(1);
    }
    console.log(`Platform: ${PLATFORM}`);
    relaunchDevClient();
    runMaestro(path.join(MAESTRO_FLOWS, "_cold-boot.yaml"));
  }

  const browser = await chromium.launch({ channel: "chrome" });
  const results = [];
  let nativeAuthed = false;
  let parityToken = "";

  if (guestScreens.length > 0) {
    const guestContext = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const guestPage = await guestContext.newPage();
    for (const screen of guestScreens) {
      console.log(`\n══ ${screen.label} (${screen.id}) ══`);
      results.push(await runScreen(guestPage, screen, { webAuthed: false, nativeAuthed: false, parityToken: "" }));
    }
    await guestContext.close();
  }

  if (userScreens.length > 0) {
    if (needsAuthLogin) {
      console.log("\n══ Auth login (parity fixture) ══");
      try {
        parityToken = await fetchParityToken();
        relaunchDevClient();
        runMaestro(path.join(MAESTRO_FLOWS, "_cold-boot.yaml"));
        runMaestro(path.join(MAESTRO_FLOWS, "_auth-login.yaml"), parityToken);
        nativeAuthed = true;
      } catch (e) {
        console.error("✗ Auth login flow failed:", e instanceof Error ? e.message : e);
        await browser.close();
        writeReport(results);
        console.error(`\n✗ Auth required for ${userScreens.length} signed-in screen(s); refusing incomplete suite`);
        process.exit(1);
      }
    } else {
      nativeAuthed = true;
      parityToken = await fetchParityToken().catch(() => "");
    }

    const userContext = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await loginWeb(userContext);
    const userPage = await userContext.newPage();
    for (const screen of userScreens) {
      console.log(`\n══ ${screen.label} (${screen.id}) ══`);
      results.push(await runScreen(userPage, screen, { webAuthed: true, nativeAuthed: true, parityToken }));
    }
    await userContext.close();
  }

  await browser.close();
  const { failed } = writeReport(results);
  if (results.length !== screens.length) {
    console.error(`\n✗ Incomplete suite: compared ${results.length}/${screens.length} screens`);
    process.exit(1);
  }
  if (failed.length) {
    console.error(`\n✗ ${failed.length} screen(s) failed parity checks`);
    process.exit(1);
  }
  console.log("\n✓ All parity screens passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
