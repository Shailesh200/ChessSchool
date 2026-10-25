/**
 * Render Play listing images.
 *
 * Requires system Chrome (Playwright channel "chrome", not bundled Chromium).
 * Start the local web app first, with the seeded DB:
 *
 *   pnpm --filter web dev
 *   node apps/mobile/store-assets/play-store/capture.mjs screens
 *   node apps/mobile/store-assets/play-store/capture.mjs graphic
 *
 * BASE_URL defaults to http://localhost:3000. Use localhost, not 127.0.0.1.
 *
 * `screens` signs in as a made-up local user named Alex, captures six phone
 * frames, and composites each one under screenshots/caption-frame.html.
 * Final PNGs are 1080×1920 with no alpha. This script does not change app code,
 * does not write icon-512.png, and does not write the retired mascot filenames.
 * `graphic` re-renders feature-graphic.html. The checked-in feature graphic is
 * already approved — run that mode only when the HTML source changes.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(dir, "screenshots");
const rawDir = path.join(shotDir, ".raw");
const captionHtml = path.join(shotDir, "caption-frame.html");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const CSS_W = 432;
const CSS_H = 656;
const SCALE = 2.5;
const CAPTION_PX = 280;

const CAPTIONS = {
  "01-campus.png": "Learn chess step by step, like school",
  "02-class-journey.png": "Short classes that build on each other",
  "03-lesson.png": "Learn by doing, one move at a time",
  "04-bot-game.png": "Play bots that match your level",
  "05-tactic.png": "Spot forks, pins and more",
  "06-review.png": "Review every game, move by move",
};

const AVATAR_SELECTORS = [
  "img[src*='/mascots/']",
  "img[src*='/coaches/']",
  "img[src*='cody']",
  "img[alt*='coach' i]",
  "img[alt*='mascot' i]",
  "img[alt*='Cody']",
  ".coach-avatar",
];

const facts = {
  capture: "web",
  native: false,
  displayName: "Alex",
};

function pngSize(buf) {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

async function avatarHits(page, clip) {
  return page.evaluate(
    ({ selectors, clip }) => {
      const nodes = selectors.flatMap((sel) => [...document.querySelectorAll(sel)]);
      const hits = [];
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          continue;
        }
        const overlaps =
          r.bottom > clip.y + 1 &&
          r.top < clip.y + clip.height - 1 &&
          r.right > clip.x + 1 &&
          r.left < clip.x + clip.width - 1;
        if (!overlaps) continue;
        const img = el.tagName === "IMG" ? el : el.querySelector("img");
        hits.push({
          tag: el.tagName,
          src: img?.getAttribute("src") ?? "",
          alt: img?.getAttribute("alt") ?? "",
        });
      }
      return hits;
    },
    { selectors: AVATAR_SELECTORS, clip },
  );
}

async function assertFrameClean(page, clip, label) {
  const hits = await avatarHits(page, clip);
  if (hits.length) throw new Error(`${label}: avatar in frame ${JSON.stringify(hits)}`);
  const text = await page.locator("body").innerText();
  if (text.includes("@")) throw new Error(`${label}: email-like text in frame`);
  if (/enroll to the academy/i.test(text)) throw new Error(`${label}: enroll banner in frame`);
  if (/pre-school/i.test(text)) throw new Error(`${label}: Pre-School in frame`);
  const bar = await page.evaluate(() =>
    [...document.querySelectorAll("div")].some(
      (el) =>
        String(el.className).includes("z-[100]") && String(el.className).includes("h-[3px]"),
    ),
  );
  if (bar) throw new Error(`${label}: loading bar still visible`);
}

async function hideDevChrome(context) {
  await context.addInitScript(() => {
    const paint = () => {
      const parent = document.head || document.documentElement;
      if (!parent || document.getElementById("capture-dev-chrome")) return;
      const s = document.createElement("style");
      s.id = "capture-dev-chrome";
      s.textContent =
        "nextjs-portal,[data-nextjs-toast],[data-next-badge-root],#devtools-indicator,aside[class*='w-[220px]']{display:none!important}";
      parent.appendChild(s);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
    else paint();
  });
}

async function signIn(context) {
  const password = `Aa1-${randomUUID()}`;
  const email = `alex.${Date.now()}.${randomUUID().slice(0, 8)}@example.com`;
  const probe = await context.request.post(BASE + "/api/auth/register", {
    data: { email, password, name: "Alex" },
  });
  if (!probe.ok()) throw new Error(`could not create local test user (${probe.status()})`);
  const body = await probe.json();
  if (body?.user?.name !== "Alex" || typeof body.token !== "string") {
    throw new Error("local test user was not created as Alex");
  }
  await context.addCookies([
    {
      name: "chessschool_session",
      value: body.token,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  facts.displayName = "Alex";
  facts.role = "student";
}

async function clickSquare(page, boardId, square) {
  const selectors = [`#${boardId}-square-${square}`, `[id$="-square-${square}"]`];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.click();
      return;
    }
  }
  throw new Error(`square not found: ${boardId} ${square}`);
}

async function pieceSignature(page, prefix) {
  return page.evaluate((prefix) => {
    return [...document.querySelectorAll(`[id^="${prefix}-square-"] img`)]
      .map((img) => `${img.closest("[id]")?.id}:${img.getAttribute("src")}`)
      .sort()
      .join("|");
  }, prefix);
}

async function waitForSignatureChange(page, prefix, previous) {
  await page.waitForFunction(
    ({ prefix, previous }) => {
      const now = [...document.querySelectorAll(`[id^="${prefix}-square-"] img`)]
        .map((img) => `${img.closest("[id]")?.id}:${img.getAttribute("src")}`)
        .sort()
        .join("|");
      return now !== previous && now.length > 0;
    },
    { prefix, previous },
    { timeout: 20000 },
  );
  return pieceSignature(page, prefix);
}

const LESSON_PACK_CSS = `
  body[data-capture="lesson"] .coach-avatar { display: none !important; }
  body[data-capture="lesson"] .min-h-dvh { min-height: 0 !important; height: auto !important; }
  body[data-capture="lesson"] .min-h-dvh > .flex-1,
  body[data-capture="lesson"] .order-2,
  body[data-capture="lesson"] .order-2 > .flex-1 { flex: 0 0 auto !important; }
  body[data-capture="lesson"] [class*="min-h-[5.25rem]"] {
    position: static !important;
    min-height: 0 !important;
  }
`;

const MATCH_PACK_CSS = `
  body[data-capture="match"] .coach-avatar { display: none !important; }
  body[data-capture="match"] .capture-board {
    width: calc(100vw - 64px) !important;
    height: calc(100vw - 64px) !important;
    max-width: calc(100vw - 64px) !important;
    max-height: calc(100vw - 64px) !important;
  }
  body[data-capture="match"] .capture-board-col {
    flex: 0 0 auto !important;
    justify-content: flex-start !important;
    padding-left: 32px !important;
    padding-right: 32px !important;
  }
`;

async function installPackStyles(page) {
  await page.addStyleTag({ content: LESSON_PACK_CSS + MATCH_PACK_CSS });
}

async function prepareLesson(page, { hideGenericTip }) {
  await page.evaluate((hideGenericTip) => {
    document.body.dataset.capture = "lesson";
    const hideTip = () => {
      if (!hideGenericTip) return;
      for (const p of document.querySelectorAll("p")) {
        if (!p.textContent.includes("Take your time and calculate")) continue;
        const card = p.closest("div");
        if (card) card.style.setProperty("display", "none", "important");
      }
    };
    hideTip();
    if (hideGenericTip && !document.body.dataset.tipObserver) {
      document.body.dataset.tipObserver = "1";
      new MutationObserver(hideTip).observe(document.body, { childList: true, subtree: true });
    }
    document.querySelector(".min-h-dvh")?.style.setProperty("min-height", "0", "important");
    for (const el of document.querySelectorAll(".order-2, .order-2 > .flex-1, .min-h-dvh > .flex-1")) {
      el.style.setProperty("flex", "0 0 auto", "important");
    }
    const footer = document.querySelector('[class*="min-h-[5.25rem]"]');
    if (footer) {
      footer.style.setProperty("position", "relative", "important");
      footer.style.setProperty("min-height", "0", "important");
      if (!footer.textContent.includes("Continue")) footer.style.setProperty("display", "none", "important");
    }
  }, hideGenericTip);
}

async function fitLessonBoard(page, boardSel) {
  for (let i = 0; i < 6; i += 1) {
    const measured = await page.evaluate((boardSel) => {
      const board = document.querySelector(boardSel);
      const wrap = board?.parentElement ?? null;
      const nodes = [...document.querySelectorAll("h1, p, button, span")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2 && getComputedStyle(el).display !== "none";
      });
      const bottom = nodes.reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0);
      const cont = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue");
      const tip = [...document.querySelectorAll("p")].find((p) => p.textContent.includes("knight fork"));
      const center = board?.parentElement?.parentElement?.parentElement ?? null;
      if (center) {
        center.style.setProperty("flex", "0 0 auto", "important");
        center.style.setProperty("min-height", "0", "important");
      }
      const gap = cont && tip ? Math.round(cont.getBoundingClientRect().top - tip.getBoundingClientRect().bottom) : null;
      const parentFlex = board?.parentElement ? getComputedStyle(board.parentElement).flex : "";
      return {
        bottom,
        width: wrap ? wrap.getBoundingClientRect().width : 0,
        gap,
        parentClass: board?.parentElement?.parentElement?.className ?? "",
        parentFlex,
      };
    }, boardSel);
    const slack = CSS_H - 12 - measured.bottom;
    if (Math.abs(slack) < 18 && (measured.gap === null || measured.gap < 48)) return measured;
    const extra = Math.max(0, (measured.gap ?? 0) - 28);
    const next = Math.round(Math.max(240, Math.min(400, measured.width + Math.max(slack, extra))));
    await page.evaluate(
      ({ boardSel, next }) => {
        const wrap = document.querySelector(boardSel)?.parentElement;
        if (!wrap) return;
        wrap.style.setProperty("width", `${next}px`, "important");
        wrap.style.setProperty("max-width", `${next}px`, "important");
      },
      { boardSel, next },
    );
    await page.waitForTimeout(120);
  }
}

async function prepareMatch(page) {
  await page.evaluate(() => {
    document.body.dataset.capture = "match";
    const board = document.querySelector("#match-board-board");
    const sized = board?.parentElement;
    if (sized) sized.classList.add("capture-board");
    const col = sized?.parentElement;
    if (col) col.classList.add("capture-board-col");
    const avatar = document.querySelector(".coach-avatar");
    const hole = avatar?.parentElement;
    if (hole) {
      hole.style.display = "none";
      hole.style.width = "0";
      hole.style.height = "0";
      hole.style.overflow = "hidden";
    }
  });
  await page.waitForTimeout(250);
}

async function composite(name) {
  const raw = await readFile(path.join(rawDir, name));
  const rawSize = pngSize(raw);
  if (rawSize.width !== 1080 || rawSize.height !== 1640) {
    throw new Error(`${name} raw is ${rawSize.width}x${rawSize.height}, expected 1080x1640`);
  }
  const page = await compositeBrowser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + captionHtml);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    ({ caption, href }) => {
      const title = document.querySelector("#caption");
      const img = document.querySelector("#shot");
      if (!title || !img) throw new Error("caption frame missing nodes");
      title.textContent = caption;
      img.src = href;
    },
    { caption: CAPTIONS[name], href: `data:image/png;base64,${raw.toString("base64")}` },
  );
  await page.locator("#shot").evaluate((img) =>
    img.complete && img.naturalWidth > 0 ? true : new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error("caption image failed"));
    }),
  );
  const out = path.join(shotDir, name);
  await page.locator("#frame").screenshot({ path: out });
  await page.close();
  const buf = await readFile(out);
  const size = pngSize(buf);
  if (size.width !== 1080 || size.height !== 1920) {
    throw new Error(`${name} is ${size.width}x${size.height}, expected 1080x1920`);
  }
  if (size.colorType !== 2) {
    throw new Error(`${name} color type ${size.colorType}, expected opaque RGB`);
  }
  console.log("wrote", name, `${size.width}x${size.height}`, buf.length);
  return buf.length;
}

let compositeBrowser;

async function shoot(page, name) {
  const clip = { x: 0, y: 0, width: CSS_W, height: CSS_H };
  await assertFrameClean(page, clip, name);
  await mkdir(rawDir, { recursive: true });
  await page.screenshot({ path: path.join(rawDir, name), clip });
  return composite(name);
}

async function captureGraphic(browser) {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + path.join(dir, "feature-graphic.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const missing = await page.evaluate(
    () =>
      [...document.querySelectorAll("#board img")].filter((img) => !img.complete || img.naturalWidth === 0)
        .length,
  );
  if (missing) throw new Error(`feature graphic missing ${missing} piece images`);
  const box = await page.locator("#graphic").boundingBox();
  if (!box || Math.round(box.width) !== 1024 || Math.round(box.height) !== 500) {
    throw new Error(`feature graphic box ${JSON.stringify(box)}`);
  }
  await page.locator("#graphic").screenshot({ path: path.join(dir, "feature-graphic.png") });
  console.log("wrote feature-graphic.png");
  await page.close();
}

async function captureScreens(browser) {
  await mkdir(shotDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: CSS_W, height: CSS_H },
    deviceScaleFactor: SCALE,
    hasTouch: false,
    isMobile: true,
  });
  await hideDevChrome(context);
  await signIn(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (err) => console.error("pageerror", err.message));

  await page.goto(BASE + "/academy", { waitUntil: "domcontentloaded" });
  await installPackStyles(page);
  await page.getByRole("banner").getByText("L1", { exact: true }).waitFor({ timeout: 45000 });
  await page.getByRole("heading", { name: "Starter", exact: true }).waitFor({ timeout: 45000 });
  await page.evaluate(() => {
    const main = document.querySelector("#main-content");
    const heading = [...document.querySelectorAll("h2")].find((el) => el.textContent.trim() === "Starter");
    if (!main || !heading) throw new Error("Starter heading missing from campus");
    const top =
      heading.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    main.scrollTop = Math.max(0, top - 12);
  });
  await page.waitForTimeout(300);
  const bytes01 = await shoot(page, "01-campus.png");
  const starterBox = await page.getByRole("heading", { name: "Starter", exact: true }).boundingBox();
  if (!starterBox || starterBox.y < 0 || starterBox.y > CSS_H - 24) {
    throw new Error(`Starter heading not in campus frame: ${JSON.stringify(starterBox)}`);
  }
  facts.campus = { starterInFrame: true, bytes: bytes01 };

  await page.goto(BASE + "/class/class-pre-board", { waitUntil: "domcontentloaded" });
  await installPackStyles(page);
  await page.getByRole("heading", { name: "The Chess Board" }).waitFor();
  await page.getByRole("banner").getByText("L1", { exact: true }).waitFor();
  await page.waitForTimeout(400);
  facts.classJourney = { bytes: await shoot(page, "02-class-journey.png") };

  await page.goto(BASE + "/lesson/pawn-power", { waitUntil: "domcontentloaded" });
  await installPackStyles(page);
  await page.locator("#lesson-pawn-power-board").waitFor();
  await page.getByText("White to move").waitFor();
  await page.getByText("Push your e-pawn", { exact: false }).waitFor();
  await prepareLesson(page, { hideGenericTip: true });
  await fitLessonBoard(page, "#lesson-pawn-power-board");
  await page.waitForTimeout(200);
  if (await page.getByText("Take your time and calculate").isVisible().catch(() => false)) {
    throw new Error("generic lesson tip still visible");
  }
  facts.lesson = {
    coach: await page.locator(".order-1 p").first().innerText(),
    hintHidden: true,
    bytes: await shoot(page, "03-lesson.png"),
  };

  await page.goto(BASE + "/lesson/fork-master", { waitUntil: "domcontentloaded" });
  await installPackStyles(page);
  await page.locator("#lesson-fork-master-board").waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForFunction(
    () => Boolean(document.querySelector("#lesson-fork-master-square-c7 img")),
    { timeout: 15000 },
  );
  await prepareLesson(page, { hideGenericTip: false });
  await fitLessonBoard(page, "#lesson-fork-master-board");
  await page.waitForTimeout(250);
  facts.tactic = {
    coach: await page.locator(".order-1 p").first().innerText(),
    knightOnC7: true,
    tip: await page
      .locator("p")
      .filter({ hasText: "knight fork" })
      .first()
      .innerText()
      .catch(() => ""),
    bytes: await shoot(page, "05-tactic.png"),
  };

  await page.setViewportSize({ width: CSS_W, height: CSS_H });
  await page.goto(BASE + "/play", { waitUntil: "domcontentloaded" });
  await installPackStyles(page);
  await page.getByRole("button", { name: "Adaptive bot" }).waitFor();
  const adaptiveOn = await page.locator("button", { hasText: "Adaptive bot" }).evaluate((el) =>
    el.className.includes("border-brand"),
  );
  if (adaptiveOn) await page.getByRole("button", { name: "Adaptive bot" }).click();
  await page.getByRole("button", { name: "900", exact: true }).click();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Start match" }).click();
  await page.locator("#match-board-board").waitFor();
  await page.waitForFunction(() => {
    const r = document.querySelector("#match-board-board")?.getBoundingClientRect();
    return Boolean(r && r.width > 200 && r.height > 200);
  });
  await page.getByText("vs Remi", { exact: false }).waitFor();

  const played = [];
  for (const [from, to] of [
    ["e2", "e4"],
    ["g1", "f3"],
    ["f1", "c4"],
  ]) {
    const before = await pieceSignature(page, "match-board");
    await clickSquare(page, "match-board", from);
    await page.waitForTimeout(250);
    await clickSquare(page, "match-board", to);
    const confirm = page.getByRole("button", { name: /^Play / });
    if ((await confirm.count()) > 0 && (await confirm.isVisible().catch(() => false))) {
      played.push((await confirm.innerText()).replace(/^Play\s+/, "").trim());
      await confirm.click();
    }
    let afterOurs;
    try {
      afterOurs = await waitForSignatureChange(page, "match-board", before);
    } catch {
      console.log("move did not land", from, to);
      break;
    }
    if (!played.length || played[played.length - 1].includes(from)) played.push(`${from}-${to}`);
    try {
      await waitForSignatureChange(page, "match-board", afterOurs);
    } catch {
      break;
    }
    await page.waitForTimeout(200);
  }
  if (!played.length) throw new Error("bot game did not leave the starting position");
  await prepareMatch(page);
  const matchLines = (await page.locator("body").innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);
  facts.match = { played, lines: matchLines };
  facts.match.bytes = await shoot(page, "04-bot-game.png");

  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: "Resign", exact: true }).last().click();
  await page.getByText("You resigned", { exact: false }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByText("Moves", { exact: true }).waitFor({ timeout: 20000 });
  const href = new URL(page.url()).pathname;
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("div")].some(
        (el) =>
          String(el.className).includes("z-[100]") && String(el.className).includes("h-[3px]"),
      ),
  );
  await page.evaluate(() => {
    const main = document.querySelector("#main-content");
    const board = document.querySelector('[id$="-board"]');
    if (!main || !board) return;
    const top = board.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    main.scrollTop = Math.max(0, top - 8);
  });
  await page.waitForTimeout(300);
  const moveText = await page.locator("p").filter({ hasText: /^Moves$/ }).locator("xpath=..").innerText();
  facts.review = { hrefPath: href.replace(/[0-9]/g, "#"), moves: moveText, bytes: await shoot(page, "06-review.png") };

  await writeFile("/tmp/play-capture-facts.json", JSON.stringify(facts, null, 2));
  await context.close();
}

const mode = process.argv[2] ?? "screens";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
compositeBrowser = browser;
try {
  if (mode === "graphic" || mode === "all") await captureGraphic(browser);
  if (mode === "screens" || mode === "all") await captureScreens(browser);
} finally {
  await browser.close();
}
