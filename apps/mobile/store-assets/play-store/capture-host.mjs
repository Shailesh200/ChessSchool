/**
 * Hosts allowed to register the made-up store-shot student (display name Alex).
 *
 * Allowed: localhost, 127.0.0.1, and 10.0.2.2 as exact host matches
 * (the emulator's name for this machine — not a 10.x range or a suffix),
 * or a hostname matching
 * ^chess-school-git-[a-z0-9-]+\.vercel\.app$ whose branch part is not
 * main or staging and does not start with main- or staging-.
 * That refuses chess-school.vercel.app, -git-main and -git-staging builds,
 * other projects' *.vercel.app hosts, and lookalikes.
 *
 * Jimbe's emulator job (branch jimbe/e-native-store-shots) points the app at
 * http://10.0.2.2:<port> and runs this guard on that URL before it captures.
 * This branch does not add that workflow. Alex's account is Luffy's fixture
 * (db:seed:test-user, name may change), not this branch. Never register
 * against production.
 *
 *   node apps/mobile/store-assets/play-store/capture-host.mjs --self-test
 *   node apps/mobile/store-assets/play-store/capture-host.mjs "$EXPO_PUBLIC_API_URL"
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Branch preview only: chess-school-git-<branch>.vercel.app, never main or staging. */
const CAPTURE_PREVIEW_HOST = /^chess-school-git-([a-z0-9-]+)\.vercel\.app$/;

function isAllowedCaptureHost(host) {
  // Exact strings only. No wildcard and no 10.x range.
  if (host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2") return true;
  const match = CAPTURE_PREVIEW_HOST.exec(host);
  if (!match) return false;
  const branch = match[1];
  if (branch === "main" || branch === "staging") return false;
  if (branch.startsWith("main-") || branch.startsWith("staging-")) return false;
  return true;
}

/** Throw before registration when BASE_URL is not a local or branch-preview host. */
export function assertSafeCaptureHost(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Refusing to register a capture user: BASE_URL is not a valid URL (${url})`);
  }
  if (!isAllowedCaptureHost(host)) {
    throw new Error(
      `Refusing to register a capture user on ${host || url}. BASE_URL must be localhost, 127.0.0.1, 10.0.2.2, or chess-school-git-<branch>.vercel.app for a branch other than main or staging.`,
    );
  }
}

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

/**
 * Fail closed. Allowed: empty, `file:` (not a nested URL), `:memory:`,
 * or a URL whose host is exactly localhost, 127.0.0.1, or 10.0.2.2.
 * The error does not include the URL.
 */
export function assertLocalDatabaseUrl(raw) {
  if (raw == null || String(raw).trim() === "") return;
  const value = String(raw).trim();
  if (value === ":memory:" || LOCAL_DB_HOSTS.has(value)) return;
  if (value.startsWith("file:")) {
    if (value.slice("file:".length).includes("://")) {
      throw new Error("Refusing a remote DATABASE_URL.");
    }
    return;
  }
  let host = "";
  try {
    host = new URL(value).hostname;
  } catch {
    throw new Error("Refusing a remote DATABASE_URL.");
  }
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error("Refusing a remote DATABASE_URL.");
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

function selfTest() {
  for (const ok of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.0.2.2:3210",
    "https://chess-school-git-lane-f-f12-shailesh200.vercel.app",
  ]) {
    assertSafeCaptureHost(ok);
  }
  for (const bad of [
    "https://chess-school-git-main.vercel.app",
    "https://chess-school-git-main-shailesh200.vercel.app",
    "https://chess-school-git-staging.vercel.app",
    "https://chess-school-git-staging-x.vercel.app",
    "https://evil-git-x.vercel.app",
    "https://chess-school.vercel.app",
    "https://chess-school.in",
    "https://www.chess-school.in",
    "https://chess-school-git-x.vercel.app.evil.com",
  ]) {
    let threw = false;
    try {
      assertSafeCaptureHost(bad);
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      if (/password|secret|token/i.test(message)) {
        throw new Error("host guard included a secret in an error");
      }
    }
    if (!threw) throw new Error(`expected reject for ${bad}`);
  }
  assertLocalDatabaseUrl(undefined);
  assertLocalDatabaseUrl("");
  assertLocalDatabaseUrl("file:local.db");
  assertLocalDatabaseUrl("file:/tmp/local.db");
  assertLocalDatabaseUrl(":memory:");
  assertLocalDatabaseUrl("http://127.0.0.1:8080");
  assertLocalDatabaseUrl("http://10.0.2.2:3210");
  for (const bad of [
    "libsql://example.turso.io",
    "https://example.turso.io",
    "example.turso.io",
    "libsql-host.example.com:8080",
    "localhost.evil.com",
  ]) {
    let threw = false;
    try {
      assertLocalDatabaseUrl(bad);
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("turso") || message.includes("libsql") || message.includes("example")) {
        throw new Error("database guard echoed the remote URL");
      }
    }
    if (!threw) throw new Error("expected database reject for a remote URL");
  }
  process.stdout.write("capture-host self-test passed\n");
}

if (isDirectRun()) {
  const arg = process.argv[2];
  try {
    if (arg === "--self-test") {
      selfTest();
    } else {
      const raw = arg || process.env.EXPO_PUBLIC_API_URL;
      assertSafeCaptureHost(raw);
      assertLocalDatabaseUrl(process.env.DATABASE_URL);
      process.stdout.write(`Host guard passed for ${new URL(raw).hostname}\n`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
