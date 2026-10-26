/**
 * Render Play listing images.
 *
 * Requires system Chrome (Playwright channel "chrome", not bundled Chromium).
 * Start the local web app first, with the seeded DB:
 *
 *   pnpm --filter web dev
 *   node apps/mobile/store-assets/play-store/capture.mjs screens
 *   node apps/mobile/store-assets/play-store/capture.mjs screens 04,05,06
 *   node apps/mobile/store-assets/play-store/capture.mjs graphic
 *
 * BASE_URL defaults to http://localhost:3000. Use localhost, not 127.0.0.1.
 * assertSafeCaptureHost refuses /api/auth/register unless the host is
 * localhost, 127.0.0.1, or a *.vercel.app preview.
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
import { fileURLToPath, pathToFileURL } from "node:url";
import { Chess } from "../../../web/node_modules/chess.js/dist/esm/chess.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(dir, "screenshots");
const rawDir = path.join(shotDir, ".raw");
const captionHtml = path.join(shotDir, "caption-frame.html");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/** Hosts where the script may create the throwaway Alex account. */
export function assertSafeCaptureHost(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Refusing to register a capture user: BASE_URL is not a valid URL (${url})`);
  }
  const allowed = host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
  if (!allowed) {
    throw new Error(
      `Refusing to register a capture user on ${host || url}. BASE_URL must be localhost, 127.0.0.1, or a *.vercel.app preview.`,
    );
  }
}

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

async function installCaptureCoach(context) {
  await context.addInitScript(() => {
    const key = "chessschool.settings";
    let stored = { state: {}, version: 11 };
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (parsed && typeof parsed === "object") stored = parsed;
    } catch {
      stored = { state: {}, version: 11 };
    }
    if (!stored.state || typeof stored.state !== "object") stored.state = {};
    stored.state.coachCharacter = "anxious_nerd";
    stored.state.coachPersonality = "anxious_nerd";
    if (typeof stored.version !== "number") stored.version = 11;
    localStorage.setItem(key, JSON.stringify(stored));
  });
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
  assertSafeCaptureHost(BASE);
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
      .map((img) => {
        const square = img.closest(`[id^="${prefix}-square-"]`);
        return `${square?.id}:${img.getAttribute("src")}`;
      })
      .sort()
      .join("|");
  }, prefix);
}

async function waitForSignatureChange(page, prefix, previous, timeout = 20000) {
  await page.waitForFunction(
    ({ prefix, previous }) => {
      const now = [...document.querySelectorAll(`[id^="${prefix}-square-"] img`)]
        .map((img) => {
          const square = img.closest(`[id^="${prefix}-square-"]`);
          return `${square?.id}:${img.getAttribute("src")}`;
        })
        .sort()
        .join("|");
      return now !== previous && now.length > 0;
    },
    { prefix, previous },
    { timeout },
  );
  return pieceSignature(page, prefix);
}

function pieceMap(sig) {
  const map = new Map();
  for (const part of sig.split("|")) {
    if (!part) continue;
    const idx = part.indexOf(":");
    const id = part.slice(0, idx);
    const src = part.slice(idx + 1);
    const sq = id.split("-square-").pop();
    if (sq) map.set(sq, src);
  }
  return map;
}

/** Apply the position diff to a chess.js game and return the SAN. */
function applyDiff(chess, beforeSig, afterSig) {
  const before = pieceMap(beforeSig);
  const after = pieceMap(afterSig);
  const squares = new Set([...before.keys(), ...after.keys()]);
  const lost = [];
  const gained = [];
  for (const sq of squares) {
    const av = before.get(sq) ?? "";
    const bv = after.get(sq) ?? "";
    if (av === bv) continue;
    if (av) lost.push({ sq, src: av });
    if (bv) gained.push({ sq, src: bv });
  }
  const kingLost = lost.find((p) => p.src.endsWith("K.svg"));
  const kingGained = gained.find((p) => p.src.endsWith("K.svg"));
  if (kingLost && kingGained && lost.length >= 2) {
    return chess.move({ from: kingLost.sq, to: kingGained.sq });
  }
  if (lost.length === 2 && gained.length === 1) {
    const mover = lost.find((p) => p.src === gained[0].src);
    if (mover) return chess.move({ from: mover.sq, to: gained[0].sq });
  }
  if (lost.length === 1 && gained.length === 1) {
    const promotion =
      lost[0].src.endsWith("P.svg") && !gained[0].src.endsWith("P.svg")
        ? gained[0].src.includes("Q.svg")
          ? "q"
          : gained[0].src.includes("R.svg")
            ? "r"
            : gained[0].src.includes("B.svg")
              ? "b"
              : "n"
        : undefined;
    return chess.move({ from: lost[0].sq, to: gained[0].sq, promotion });
  }
  return null;
}

const RIM_BLUNDER = /^(Na3|Na6|Nh3|Nh6|Ra3|Ra6|Rh3|Rh6|Rg8|Rh5|Ra5|Ra6)$/;

function hasRimBlunder(history) {
  return history.slice(0, 16).some((san) => RIM_BLUNDER.test(san));
}

function legalSan(chess, san) {
  try {
    const mv = chess.move(san);
    if (!mv) return null;
    chess.undo();
    return mv;
  } catch {
    return null;
  }
}

function pickWhite(chess) {
  const whiteCount = chess.history().filter((_, i) => i % 2 === 0).length;
  const scripted = legalSan(chess, WHITE_LINE[whiteCount] ?? "");
  if (scripted) return scripted;
  const prefs = ["Nf3", "Nc3", "d4", "Bc4", "O-O", "Re1", "d3", "c3", "h3", "a3"];
  for (const san of prefs) {
    const mv = legalSan(chess, san);
    if (mv) return mv;
  }
  const moves = chess.moves({ verbose: true });
  return moves.find((m) => !m.captured && m.piece !== "k") ?? moves[0] ?? null;
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

const TACTIC_PACK_CSS = `
  body[data-capture="tactic"] .coach-avatar { display: none !important; }
  body[data-capture="tactic"] .min-h-dvh { min-height: 0 !important; }
  body[data-capture="tactic"] .min-h-dvh > .flex-1,
  body[data-capture="tactic"] .order-1,
  body[data-capture="tactic"] .order-2,
  body[data-capture="tactic"] .order-2 .flex-1 {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
  }
  body[data-capture="tactic"] .order-2 {
    align-items: stretch !important;
    width: 100% !important;
    gap: 8px !important;
  }
  body[data-capture="tactic"] .order-2 .flex-1 {
    width: 100% !important;
    align-items: flex-start !important;
    justify-content: center !important;
  }
  body[data-capture="tactic"] .order-1 { min-height: 0 !important; }
  body[data-capture="tactic"] .min-h-dvh > .flex-1 {
    gap: 8px !important;
    padding-top: 6px !important;
    padding-bottom: 4px !important;
  }
  body[data-capture="tactic"] [class*="min-h-[5.25rem]"] {
    position: static !important;
    min-height: 0 !important;
    padding-top: 4px !important;
  }
  body[data-capture="tactic"] div:has(> [data-testid="chess-board"]) {
    width: var(--cap-board) !important;
    max-width: var(--cap-board) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  body[data-capture="tactic"] #capture-fork-arrows {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 30;
  }
`;

const MATCH_PACK_CSS = `
  body[data-capture="match"] .coach-avatar { display: none !important; }
  body[data-capture="match"] div.sticky + div { margin-top: var(--cap-shift, 0px) !important; }
  body[data-capture="match"] .h-\\[4\\.75rem\\] > div:first-child { display: none !important; }
  body[data-capture="match"] .h-\\[4\\.75rem\\] {
    height: auto !important;
    min-height: 0 !important;
    max-height: 3.4rem !important;
  }
  body[data-capture="match"] div:has(> button[aria-label="Previous move"]) { display: none !important; }
  body[data-capture="match"] div:has(> div > div > #match-board-board) {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    justify-content: flex-start !important;
    padding-top: var(--cap-pad, 8px) !important;
    padding-bottom: 6px !important;
  }
  body[data-capture="match"] div:has(> div > #match-board-board) {
    width: var(--cap-board) !important;
    height: var(--cap-board) !important;
    max-width: var(--cap-board) !important;
    max-height: var(--cap-board) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
`;

const REVIEW_PACK_CSS = `
  body[data-capture="review"] #main-content {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  body[data-capture="review"] div:has(> [data-testid="chess-board"]) {
    width: var(--cap-board, 396px) !important;
    max-width: var(--cap-board, 396px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  body[data-capture="review"] [id*="-square-"] > span {
    display: none !important;
  }
  body[data-capture="review"] div:has(> input[aria-label="Scrub moves"]) {
    width: var(--cap-board, 396px) !important;
    max-width: var(--cap-board, 396px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
    align-self: center !important;
    box-sizing: border-box !important;
    min-width: 0 !important;
  }
  body[data-capture="review"] div:has(> input[aria-label="Scrub moves"]) > button {
    width: 32px !important;
    min-width: 0 !important;
    flex: 0 0 32px !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  body[data-capture="review"] input[aria-label="Scrub moves"] {
    flex: 1 1 0% !important;
    min-width: 0 !important;
    width: auto !important;
    max-width: 100% !important;
  }
`;

async function installPackStyles(page) {
  await page.addStyleTag({ content: LESSON_PACK_CSS + TACTIC_PACK_CSS + MATCH_PACK_CSS + REVIEW_PACK_CSS });
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

async function drawForkArrows(page) {
  await page.evaluate(() => {
    document.getElementById("capture-fork-arrows")?.remove();
    const c7 = document.querySelector("#lesson-fork-master-square-c7");
    const e8 = document.querySelector("#lesson-fork-master-square-e8");
    const a8 = document.querySelector("#lesson-fork-master-square-a8");
    if (!c7 || !e8 || !a8) return;
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "capture-fork-arrows";
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    const from = center(c7);
    const add = (toEl) => {
      const to = center(toEl);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const endPad = Math.min(18, len * 0.28);
      const ex = to.x - ux * endPad;
      const ey = to.y - uy * endPad;
      const head = 15;
      const wing = 8;
      const px = -uy;
      const py = ux;
      const hx = ex - ux * head;
      const hy = ey - uy * head;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${hx.toFixed(1)} ${hy.toFixed(1)} M ${(hx + px * wing).toFixed(1)} ${(hy + py * wing).toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} L ${(hx - px * wing).toFixed(1)} ${(hy - py * wing).toFixed(1)}`,
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#f59e0b");
      path.setAttribute("stroke-width", "7");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    };
    add(e8);
    add(a8);
    document.body.appendChild(svg);
  });
}

async function packTactic(page) {
  await page.evaluate(() => {
    document.body.dataset.capture = "tactic";
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    for (const row of document.querySelectorAll(".order-2 .h-10")) {
      if (!row.innerText.trim()) row.style.setProperty("display", "none", "important");
    }
  });
  let size = 330;
  let last = null;
  for (let i = 0; i < 12; i += 1) {
    last = await page.evaluate((next) => {
      document.documentElement.style.setProperty("--cap-board", `${next}px`);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const header = document.querySelector(".sticky.top-0")?.getBoundingClientRect();
      const rect = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        if (!r) return null;
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
      };
      const tip = [...document.querySelectorAll("p")].find((p) => p.textContent.includes("knight fork"));
      const cont = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue");
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      };
      return {
        size: next,
        headerBottom: header?.bottom ?? 0,
        a8: rect("#lesson-fork-master-square-a8"),
        e8: rect("#lesson-fork-master-square-e8"),
        h8: rect("#lesson-fork-master-square-h8"),
        a1: rect("#lesson-fork-master-square-a1"),
        h1: rect("#lesson-fork-master-square-h1"),
        board: rect("#lesson-fork-master-board"),
        tip: box(tip),
        cont: box(cont),
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        pieces: {
          c7: Boolean(document.querySelector("#lesson-fork-master-square-c7 img")),
          e8: Boolean(document.querySelector("#lesson-fork-master-square-e8 img")),
          a8: Boolean(document.querySelector("#lesson-fork-master-square-a8 img")),
        },
      };
    }, size);
    const hidden = !last.a8 || last.a8.top < last.headerBottom - 0.5 || last.a8.height < 12;
    const cut =
      !last.cont ||
      last.cont.bottom > last.innerHeight - 1 ||
      !last.a1 ||
      last.a1.bottom > last.innerHeight - 1 ||
      !last.h8 ||
      last.h8.top < last.headerBottom - 0.5;
    const gap = last.tip && last.board ? last.tip.top - last.board.bottom : 999;
    const slack = last.cont ? last.innerHeight - last.cont.bottom : 0;
    const ready = last.pieces.c7 && last.pieces.e8 && last.pieces.a8;
    if (!hidden && !cut && ready && gap >= 0 && gap <= 36) {
      if (slack > 36 && size < 400) {
        size += Math.min(18, Math.floor((slack - 12) / 2));
        continue;
      }
      break;
    }
    size = Math.max(210, size + (hidden || cut || gap > 36 ? -20 : 12));
  }
  await drawForkArrows(page);
  const arrows = await page.locator("#capture-fork-arrows path").count();
  if (!last?.a8 || last.a8.top < last.headerBottom - 0.5) {
    throw new Error(`tactic rank 8 still under the header ${JSON.stringify(last)}`);
  }
  if (!last.pieces?.e8 || !last.pieces?.a8 || !last.pieces?.c7) {
    throw new Error(`tactic fork pieces missing ${JSON.stringify(last?.pieces)}`);
  }
  if (!last.cont || last.cont.bottom > last.innerHeight - 1) {
    throw new Error(`tactic Continue clipped ${JSON.stringify(last)}`);
  }
  const gap = last.tip && last.board ? last.tip.top - last.board.bottom : 999;
  if (gap > 40) throw new Error(`tactic gap still ${gap}px ${JSON.stringify(last)}`);
  const rightGap = (last.innerWidth ?? CSS_W) - (last.board?.right ?? 0);
  if (!last.board || Math.abs(last.board.left - rightGap) > 4) {
    throw new Error(`tactic board off centre left ${last.board?.left} right ${rightGap}`);
  }
  if (arrows < 2) throw new Error("tactic fork arrows missing");
  last.arrows = arrows;
  last.gap = gap;
  return last;
}

const ITALIAN_REPLIES = {
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1": "e7e5",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2": "b8c6",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3": "f8c5",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4": "g8f6",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5": "d7d6",
  "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6": "e8g8",
  "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQR1K1 b - - 3 7": "a7a6",
  "r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQR1K1 b - - 1 8": "c5a7",
  "r1bq1rk1/bpp2ppp/p1np1n2/4p3/2B1P3/2PP1N1P/PP1N1PP1/R1BQR1K1 b - - 0 9": "h7h6",
};

const WHITE_LINE = ["e4", "Nf3", "Bc4", "c3", "d3", "O-O", "Re1", "Nbd2", "h3"];

async function installBotThinkDelay(page) {
  await page.addInitScript((replies) => {
    const wraps = new WeakMap();
    let lastFen = "";
    const origPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      const text = String(msg);
      if (text.startsWith("position fen ")) lastFen = text.slice("position fen ".length).trim();
      return origPost.call(this, msg, ...rest);
    };
    const origAdd = Worker.prototype.addEventListener;
    const origRemove = Worker.prototype.removeEventListener;
    Worker.prototype.addEventListener = function (type, fn, ...rest) {
      if (type !== "message" || typeof fn !== "function") {
        return origAdd.call(this, type, fn, ...rest);
      }
      let wrapped = wraps.get(fn);
      if (!wrapped) {
        wrapped = (ev) => {
          const data = ev.data;
          if (String(data).startsWith("bestmove")) {
            const scripted = replies[lastFen];
            const line = scripted ? `bestmove ${scripted}` : String(data);
            window.setTimeout(() => fn({ data: line }), 3800);
            return;
          }
          fn(ev);
        };
        wraps.set(fn, wrapped);
      }
      return origAdd.call(this, type, wrapped, ...rest);
    };
    Worker.prototype.removeEventListener = function (type, fn, ...rest) {
      return origRemove.call(this, type, wraps.get(fn) ?? fn, ...rest);
    };
  }, ITALIAN_REPLIES);
}

async function startMatch(page, elo) {
  const start = page.getByRole("button", { name: "Start match" });
  if (!(await start.isVisible().catch(() => false))) {
    await page.goto(BASE + "/play", { waitUntil: "domcontentloaded" });
    await installPackStyles(page);
  }
  await page.getByRole("button", { name: "Adaptive bot" }).waitFor();
  const adaptiveOn = await page.locator("button", { hasText: "Adaptive bot" }).evaluate((el) =>
    el.className.includes("border-brand"),
  );
  if (adaptiveOn) await page.getByRole("button", { name: "Adaptive bot" }).click();
  const preset = page.getByRole("button", { name: String(elo), exact: true });
  let eloHeld = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await preset.click();
    const selected = await preset
      .evaluate((el) => el.className.includes("bg-brand"))
      .catch(() => false);
    if (!selected) {
      await page.waitForTimeout(200);
      continue;
    }
    await page.waitForTimeout(350);
    eloHeld = await preset.evaluate((el) => el.className.includes("bg-brand")).catch(() => false);
    if (eloHeld) break;
  }
  if (!eloHeld) throw new Error(`elo ${elo} did not stay selected`);
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Start match" }).click();
  await page.locator("#match-board-board").waitFor();
  await page.waitForFunction(() => {
    const r = document.querySelector("#match-board-board")?.getBoundingClientRect();
    return Boolean(r && r.width > 180 && r.height > 180);
  });
  await page.waitForFunction(() => /vs /.test(document.body.innerText), null, { timeout: 15000 });
  const header = (await page.locator("div.sticky").first().innerText()).split("\n")[0];
  console.log("match header", JSON.stringify(header));
  if (!header.includes(String(elo))) throw new Error(`expected elo ${elo}, header was ${header}`);
  return header;
}

async function clickVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }
  throw new Error("no visible control for that action");
}

async function resignToChooser(page) {
  await clickVisible(page.getByRole("button", { name: "Resign", exact: true }));
  await page.getByRole("button", { name: "Resign", exact: true }).last().click();
  await page.getByRole("button", { name: "New game" }).first().waitFor({ timeout: 15000 });
  await clickVisible(page.getByRole("button", { name: "New game" }));
  await page.getByRole("button", { name: "Start match" }).first().waitFor({ timeout: 15000 });
}

async function playUci(page, chess, from, to, burnMs) {
  if (burnMs) await page.waitForTimeout(burnMs);
  await page
    .waitForFunction(() => !document.body.innerText.includes("Thinking…"), null, { timeout: 30000 })
    .catch(() => {});
  const before = await pieceSignature(page, "match-board");
  await clickSquare(page, "match-board", from);
  await page.waitForTimeout(280);
  await clickSquare(page, "match-board", to);
  const confirm = page.getByRole("button", { name: /^Play / });
  if ((await confirm.count()) > 0 && (await confirm.isVisible().catch(() => false))) {
    await confirm.click();
  }
  const after = await waitForSignatureChange(page, "match-board", before, 15000);
  const ours = applyDiff(chess, before, after);
  if (!ours) throw new Error(`could not read white move ${from}${to}`);
  if (chess.isGameOver() || chess.turn() === "w") return;
  const replied = await waitForSignatureChange(page, "match-board", after, 20000);
  const bot = applyDiff(chess, after, replied);
  if (!bot) throw new Error(`could not read bot reply after ${ours.san}`);
  console.log(chess.history().join(" "));
}

async function finishGame(page, chess) {
  while (chess.history().length < 18 && !chess.isGameOver()) {
    if (chess.turn() !== "w") throw new Error(`turn desync ${chess.fen()} ${chess.history().join(" ")}`);
    const mv = pickWhite(chess);
    if (!mv) break;
    const burn = chess.history().length >= 4 ? 10000 : 1200;
    await playUci(page, chess, mv.from, mv.to, burn);
    if (hasRimBlunder(chess.history())) {
      throw new Error(`rim blunder ${chess.history().join(" ")}`);
    }
  }
  const history = chess.history();
  const expected = "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O";
  if (history.slice(0, 12).join(" ") !== expected) {
    throw new Error(`opening left the Italian: ${history.join(" ")}`);
  }
  if (history.length < 16) throw new Error(`game too short ${history.join(" ")}`);
  if (hasRimBlunder(history)) throw new Error(`blunder ${history.join(" ")}`);
  return chess;
}

async function probeOpening(page, elo) {
  const header = await startMatch(page, elo);
  const chess = new Chess();
  const first = pickWhite(chess);
  await playUci(page, chess, first.from, first.to, 0);
  return { chess, header };
}

async function playBelievableGame(page) {
  await installBotThinkDelay(page);
  const { chess, header } = await probeOpening(page, 1600);
  facts.matchHeader = header;
  return finishGame(page, chess);
}

async function packMatch(page) {
  const plan = await page.evaluate(() => {
    document.body.dataset.capture = "match";
    const botName = [...document.querySelectorAll("span")].find((s) => {
      const t = s.textContent.trim();
      return /· \d+$/.test(t) && s.className.includes("font-extrabold") && !t.startsWith("vs");
    });
    const youName = [...document.querySelectorAll("span")].find(
      (s) => s.textContent.trim() === "You" && s.className.includes("font-extrabold"),
    );
    const botBar = botName?.parentElement?.parentElement;
    const youBar = youName?.parentElement?.parentElement;
    if (!botBar || !youBar) return { error: "player bars missing" };
    const side = 18;
    const coach = document.querySelector('[class*="h-[4.75rem]"]');
    const aboveBottom = coach
      ? coach.getBoundingClientRect().bottom
      : botBar.getBoundingClientRect().bottom;
    const youH = youBar.getBoundingClientRect().height;
    const availW = window.innerWidth - side * 2;
    const availH = window.innerHeight - aboveBottom - youH - 16;
    const size = Math.max(220, Math.floor(Math.min(availW, availH)));
    const extra = Math.max(0, availH - size);
    const pad = Math.max(4, Math.min(24, Math.floor(extra / 2)));
    document.documentElement.style.setProperty("--cap-board", `${size}px`);
    document.documentElement.style.setProperty("--cap-pad", `${pad}px`);
    return { size, pad, availW: Math.round(availW), availH: Math.round(availH) };
  });
  await page.waitForTimeout(250);
  const check = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
    };
    const botName = [...document.querySelectorAll("span")].find((s) => {
      const t = s.textContent.trim();
      return /· \d+$/.test(t) && s.className.includes("font-extrabold") && !t.startsWith("vs");
    });
    const youName = [...document.querySelectorAll("span")].find(
      (s) => s.textContent.trim() === "You" && s.className.includes("font-extrabold"),
    );
    const clocks = [...document.querySelectorAll("span.font-mono")].map((s) => s.textContent.trim());
    return {
      board: rect(document.querySelector("#match-board-board")),
      a8: rect(document.querySelector("#match-board-square-a8")),
      h1: rect(document.querySelector("#match-board-square-h1")),
      bot: rect(botName?.parentElement?.parentElement ?? null),
      you: rect(youName?.parentElement?.parentElement ?? null),
      header: rect(document.querySelector(".sticky.top-0")),
      headerText: document.querySelector(".sticky.top-0")?.innerText?.split("\n")[0] ?? "",
      botLabel: botName?.textContent.trim() ?? "",
      clocks,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });
  if (check.you && check.innerHeight - check.you.bottom > 40) {
    const shift = Math.max(0, Math.round(check.innerHeight - check.you.bottom - 20));
    await page.evaluate((shift) => {
      document.documentElement.style.setProperty("--cap-shift", `${shift}px`);
    }, shift);
    await page.waitForTimeout(120);
    Object.assign(check, await page.evaluate(() => {
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
      };
      const botName = [...document.querySelectorAll("span")].find((s) => {
        const t = s.textContent.trim();
        return /· \d+$/.test(t) && s.className.includes("font-extrabold") && !t.startsWith("vs");
      });
      const youName = [...document.querySelectorAll("span")].find(
        (s) => s.textContent.trim() === "You" && s.className.includes("font-extrabold"),
      );
      return {
        board: rect(document.querySelector("#match-board-board")),
        a8: rect(document.querySelector("#match-board-square-a8")),
        h1: rect(document.querySelector("#match-board-square-h1")),
        bot: rect(botName?.parentElement?.parentElement ?? null),
        you: rect(youName?.parentElement?.parentElement ?? null),
        header: rect(document.querySelector(".sticky.top-0")),
        clocks: [...document.querySelectorAll("span.font-mono")].map((s) => s.textContent.trim()),
      };
    }));
  }
  const { board, you, bot, header, a8, h1 } = check;
  const problems = [];
  if (!board || !you || !bot || !a8 || !h1 || !header) problems.push("missing boxes");
  else {
    if (board.left < 12 || check.innerWidth - board.right < 12) problems.push("board touches the edge");
    if (a8.top < header.bottom - 1) problems.push("rank 8 under header");
    if (h1.bottom > you.top + 1) problems.push("rank 1 under your bar");
    if (you.bottom > check.innerHeight - 1 || you.top < board.bottom - 2) problems.push("your bar clipped");
    if (bot.bottom > board.top + 1 || bot.top < 0) problems.push("bot bar clipped");
    if (you.top - board.bottom > 36) problems.push(`gap under board ${Math.round(you.top - board.bottom)}`);
  }
  if (problems.length) {
    throw new Error(`match frame: ${problems.join("; ")} ${JSON.stringify({ plan, check })}`);
  }
  return { plan, check };
}

function notationOverlaps() {
  const hits = [];
  const squares = ["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
  for (const sq of squares) {
    const el = document.querySelector(`[id$="-square-${sq}"]`);
    if (!el) continue;
    const img = el.querySelector("img");
    if (!img) continue;
    const ir = img.getBoundingClientRect();
    for (const letter of el.querySelectorAll("span")) {
      const text = letter.textContent.trim();
      if (text.length !== 1) continue;
      const lr = letter.getBoundingClientRect();
      if (lr.width < 2 || lr.height < 2) continue;
      const overlap =
        ir.left < lr.right - 0.5 &&
        ir.right > lr.left + 0.5 &&
        ir.top < lr.bottom - 0.5 &&
        ir.bottom > lr.top + 0.5;
      if (overlap) hits.push(`${sq}:${text}`);
    }
  }
  return hits;
}

async function packReview(page) {
  await page.evaluate(() => {
    document.body.dataset.capture = "review";
    document.documentElement.style.setProperty("--cap-board", "396px");
    const main = document.querySelector("#main-content");
    const board = document.querySelector("[data-testid='chess-board']");
    if (main && board) {
      const top = board.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      main.scrollTop = Math.max(0, top - 4);
    }
  });
  const last = await page.evaluate(() => {
    const main = document.querySelector("#main-content");
    const boardEl = document.querySelector("[data-testid='chess-board']");
    if (main && boardEl) {
      const top = boardEl.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      main.scrollTop = Math.max(0, top - 4);
    }
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
    };
    const label = [...document.querySelectorAll("p")].find((p) =>
      /^(Starting position|\d+\.)/.test(p.textContent.trim()),
    );
    const navTops = [...document.querySelectorAll("nav")]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.height > 24 && r.top > window.innerHeight * 0.45)
      .map((r) => r.top);
    const square = document.querySelector('[id$="-square-d1"]');
    const piece = square?.querySelector("img");
    const notation = document.querySelector('[id*="-square-"] > span');
    const notationStyle = notation ? getComputedStyle(notation) : null;
    const slider = document.querySelector('input[aria-label="Scrub moves"]');
    const scrub = slider?.parentElement ?? null;
    return {
      board: rect(document.querySelector('[id$="-board"]')),
      a8: rect(document.querySelector('[id$="-square-a8"]')),
      h1: rect(document.querySelector('[id$="-square-h1"]')),
      label: rect(label),
      labelText: label?.textContent.trim() ?? "",
      navTop: navTops.length ? Math.min(...navTops) : window.innerHeight,
      mainTop: main?.getBoundingClientRect().top ?? 0,
      innerWidth: window.innerWidth,
      pieceRatio: square && piece ? piece.getBoundingClientRect().width / square.getBoundingClientRect().width : 0,
      notationHidden: !notation || notationStyle.display === "none" || notationStyle.visibility === "hidden",
      scrub: rect(scrub),
      slider: rect(slider),
      firstBtn: rect(scrub?.querySelector("button") ?? null),
    };
  });
  if (last.labelText !== "6. O-O") throw new Error(`review label is ${last.labelText}`);
  if (!last.label || last.label.bottom > last.navTop - 2) {
    throw new Error(`review label clipped ${JSON.stringify(last)}`);
  }
  if (!last.a8 || last.a8.top < last.mainTop - 1 || !last.h1 || last.h1.bottom > last.navTop) {
    throw new Error(`review board clipped ${JSON.stringify(last)}`);
  }
  const rightGap = last.innerWidth - (last.board?.right ?? 0);
  if (!last.board || Math.abs(last.board.left - rightGap) > 4 || last.board.width < 380) {
    throw new Error(`review board margins left ${last.board?.left} right ${rightGap} width ${last.board?.width}`);
  }
  if (!last.notationHidden) throw new Error("review notation still visible");
  if (last.pieceRatio < 0.9) throw new Error(`review pieces inset at ${last.pieceRatio}`);
  if (
    !last.scrub ||
    !last.slider ||
    !last.firstBtn ||
    Math.abs(last.scrub.left - last.board.left) > 4 ||
    Math.abs(last.scrub.right - last.board.right) > 4 ||
    last.slider.right > last.scrub.right + 1 ||
    last.firstBtn.left < last.scrub.left - 1 ||
    last.slider.width < 48
  ) {
    throw new Error(`review controls overflow ${JSON.stringify({ scrub: last.scrub, slider: last.slider, firstBtn: last.firstBtn, board: last.board })}`);
  }
  return last;
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
  const only = new Set(
    (process.argv[3] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const want = (file) => only.size === 0 || only.has(file) || only.has(file.slice(0, 2));
  await mkdir(shotDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: CSS_W, height: CSS_H },
    deviceScaleFactor: SCALE,
    hasTouch: false,
    isMobile: true,
  });
  await hideDevChrome(context);
  await installCaptureCoach(context);
  await signIn(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (err) => console.error("pageerror", err.message));

  try {
  if (want("01-campus.png")) {
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
  }

  if (want("02-class-journey.png")) {
    await page.goto(BASE + "/class/class-pre-board", { waitUntil: "domcontentloaded" });
    await installPackStyles(page);
    await page.getByRole("heading", { name: "The Chess Board" }).waitFor();
    await page.getByRole("banner").getByText("L1", { exact: true }).waitFor();
    await page.waitForTimeout(400);
    facts.classJourney = { bytes: await shoot(page, "02-class-journey.png") };
  }

  if (want("03-lesson.png")) {
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
    const lessonCoach = await page.locator(".order-1 p").first().innerText();
    if (!lessonCoach.includes("Pawns move forward")) {
      throw new Error(`lesson coach line changed: ${lessonCoach}`);
    }
    if (/Bold of you to show up|Thrilling advice|No fireworks yet/.test(lessonCoach)) {
      throw new Error(`lesson still uses the sarcastic coach: ${lessonCoach}`);
    }
    facts.lesson = {
      coach: lessonCoach,
      hintHidden: true,
      bytes: await shoot(page, "03-lesson.png"),
    };
  }

  if (want("05-tactic.png")) {
    await page.goto(BASE + "/lesson/fork-master", { waitUntil: "domcontentloaded" });
    await installPackStyles(page);
    await page.locator("#lesson-fork-master-board").waitFor();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForFunction(
      () => Boolean(document.querySelector("#lesson-fork-master-square-c7 img")),
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Continue" }).waitFor();
    await page.waitForTimeout(300);
    const tactic = await packTactic(page);
    const tacticCoach = await page.locator(".order-1 p").first().innerText();
    if (!tacticCoach.includes("Watch the knight leap to c7")) {
      throw new Error(`tactic coach line changed: ${tacticCoach}`);
    }
    facts.tactic = {
      coach: tacticCoach,
      knightOnC7: true,
      tip: await page.locator("p").filter({ hasText: "knight fork" }).first().innerText(),
      geometry: tactic,
      bytes: await shoot(page, "05-tactic.png"),
    };
  }

  if (want("04-bot-game.png") || want("06-review.png")) {
    const chess = await playBelievableGame(page);
    const history = chess.history();
    facts.match = { history, pgn: chess.pgn() };
    if (want("04-bot-game.png")) {
      const packed = await packMatch(page);
      facts.match.header = packed.check.headerText;
      facts.match.botLabel = packed.check.botLabel;
      facts.match.clocks = packed.check.clocks;
      const matchCoach = await page.locator(".line-clamp-2").last().innerText();
      if (/Bold of you to show up|Thrilling advice|No fireworks yet/.test(matchCoach)) {
        throw new Error(`match still uses the sarcastic coach: ${matchCoach}`);
      }
      facts.match.coach = matchCoach;
      facts.match.frame = packed.check;
      facts.match.bytes = await shoot(page, "04-bot-game.png");
    }

    await page.getByRole("button", { name: "Resign" }).click();
    await page.getByRole("button", { name: "Resign", exact: true }).last().click();
    await page.getByText("You resigned", { exact: false }).waitFor({ timeout: 15000 });
    if (want("06-review.png")) {
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
      await installPackStyles(page);
      const castle = page.getByRole("button", { name: /^\d+\.\s*O-O$/ }).first();
      if (await castle.count()) await castle.click();
      else {
        const mid = page.locator("button").filter({ hasText: /^\d+\./ }).nth(4);
        if (await mid.count()) await mid.click();
      }
      await page.waitForTimeout(250);
      const review = await packReview(page);
      const moveText = await page.locator("p").filter({ hasText: /^Moves$/ }).locator("xpath=..").innerText();
      const comment = await page
        .locator("p")
        .filter({ hasText: /How the checkmate happened|prevented this/ })
        .allInnerTexts()
        .catch(() => []);
      facts.review = {
        hrefPath: href.replace(/[0-9]/g, "#"),
        label: review.labelText,
        comment,
        moves: moveText,
        geometry: review,
        bytes: await shoot(page, "06-review.png"),
      };
    }
  }

  } catch (error) {
    await page.screenshot({ path: "/tmp/play-capture-fail.png", fullPage: true }).catch(() => {});
    facts.error = String(error?.message ?? error);
    throw error;
  } finally {
    await writeFile("/tmp/play-capture-facts.json", JSON.stringify(facts, null, 2));
    await context.close();
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  const mode = process.argv[2] ?? "screens";
  if (mode === "screens" || mode === "all") assertSafeCaptureHost(BASE);
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
}
