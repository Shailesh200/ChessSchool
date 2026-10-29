/**
 * First-load JS for `/` — the script URLs Chromium actually requests when it
 * parses the home document (what a Playwright load of `/` measures).
 *
 * The old budget script summed client-manifest `entryJSFiles` for
 * `app/layout`, `app/template`, and `app/page` only. The document also
 * includes the `app/error`, `app/not-found`, and `app/global-error` chunks
 * (~8 KB gzip together). Those are ordinary `<script src>` tags, so the
 * browser downloads them on first load.
 *
 * The polyfill chunk is in the HTML as `noModule`. Playwright's Chrome does
 * not request it, so it is not part of this total.
 *
 * Gzip is `zlib.gzipSync` at the default level. KB is bytes / 1024.
 * Post-hydration dynamic imports (toaster, command palette, analytics) are
 * not in the document and are not counted.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "../..");
const NEXT_DIR = path.join(ROOT, "apps/web/.next");
const HOME_HTML = path.join(NEXT_DIR, "server/app/index.html");

/** Default gate. Override with HOME_JS_BUDGET_KB. Do not change this to chase a measurement. */
const HOME_JS_BUDGET_KB = 320;

function gzipLength(buf) {
  return zlib.gzipSync(buf).length;
}

function decodeAttr(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return decodeAttr(match[2] ?? match[3] ?? "");
}

/**
 * Script URLs the browser fetches while parsing `html`.
 * `noModule` scripts are omitted. Preload-as-script links are included.
 * @param {string} html
 * @returns {string[]}
 */
function firstLoadScriptUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    if (/\bnoModule\b/i.test(tag)) continue;
    const src = attr(tag, "src");
    if (src) urls.add(src.split("#")[0]);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if ((attr(tag, "rel") ?? "").toLowerCase() !== "preload") continue;
    if ((attr(tag, "as") ?? "").toLowerCase() !== "script") continue;
    const href = attr(tag, "href");
    if (href) urls.add(href.split("#")[0]);
  }
  return [...urls];
}

/**
 * @param {string} nextDir
 * @param {string} url
 * @returns {string | null} absolute file path, or null when the URL is not a built `/_next` chunk
 */
function resolveChunkFile(nextDir, url) {
  const pathname = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  const decoded = decodeURIComponent(pathname);
  if (!decoded.startsWith("/_next/")) return null;
  return path.join(nextDir, decoded.slice("/_next/".length));
}

/**
 * @param {string} html
 * @param {string} [nextDir]
 */
function measureFirstLoadJs(html, nextDir = NEXT_DIR) {
  const urls = firstLoadScriptUrls(html);
  let gzipBytes = 0;
  let rawBytes = 0;
  /** @type {{ url: string, file: string, gzipBytes: number, rawBytes: number }[]} */
  const chunks = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const external = [];

  for (const url of urls) {
    const file = resolveChunkFile(nextDir, url);
    if (!file) {
      external.push(url);
      continue;
    }
    if (!fs.existsSync(file)) {
      missing.push(url);
      continue;
    }
    const buf = fs.readFileSync(file);
    const gz = gzipLength(buf);
    gzipBytes += gz;
    rawBytes += buf.length;
    chunks.push({ url, file, gzipBytes: gz, rawBytes: buf.length });
  }

  if (missing.length || external.length) {
    const detail = [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      external.length ? `external: ${external.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(`Home first-load JS is incomplete (${detail})`);
  }

  return {
    gzipBytes,
    rawBytes,
    kb: gzipBytes / 1024,
    chunks,
  };
}

function readBuiltHomeHtml() {
  if (!fs.existsSync(HOME_HTML)) {
    throw new Error(
      "Home document missing — run pnpm build first (apps/web/.next/server/app/index.html)",
    );
  }
  return fs.readFileSync(HOME_HTML, "utf8");
}

function measureBuiltHome() {
  return measureFirstLoadJs(readBuiltHomeHtml(), NEXT_DIR);
}

module.exports = {
  HOME_JS_BUDGET_KB,
  HOME_HTML,
  NEXT_DIR,
  firstLoadScriptUrls,
  measureFirstLoadJs,
  measureBuiltHome,
  readBuiltHomeHtml,
};
