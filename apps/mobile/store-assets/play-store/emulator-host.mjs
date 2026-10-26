#!/usr/bin/env node
/**
 * Refuse a Play Store capture that is not pointed at this machine.
 *
 * Allowed API hosts: localhost, 127.0.0.1, 10.0.2.2 (the emulator's alias
 * for the host). A local database must be a sqlite file, not Turso or any
 * http(s) URL.
 *
 *   node apps/mobile/store-assets/play-store/emulator-host.mjs --self-test
 *   node apps/mobile/store-assets/play-store/emulator-host.mjs "$EXPO_PUBLIC_API_URL"
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

export function assertLocalCaptureHost(raw) {
  if (raw == null || String(raw).trim() === "") {
    throw new Error(
      "API host is missing. Set EXPO_PUBLIC_API_URL to http://10.0.2.2:<port>.",
    );
  }
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error("API host is not a valid URL.");
  }
  if (url.username || url.password) {
    throw new Error("Refusing API URL with userinfo.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Refusing API scheme ${url.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing non-local API host "${url.hostname}". Allowed hosts: localhost, 127.0.0.1, 10.0.2.2.`,
    );
  }
  return url;
}

/** Local sqlite only. Never print the URL — it might carry a token. */
export function assertLocalDatabaseUrl(raw) {
  if (raw == null || String(raw).trim() === "") return;
  const value = String(raw).trim();
  if (value.startsWith("file:")) {
    const path = value.slice("file:".length);
    if (path.includes("://")) {
      throw new Error("Refusing non-local DATABASE_URL.");
    }
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error("Refusing non-local DATABASE_URL.");
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

function selfTest() {
  for (const ok of [
    "http://10.0.2.2:3210",
    "http://127.0.0.1:3000",
    "http://localhost:3210/",
    "https://localhost:3210",
  ]) {
    const url = assertLocalCaptureHost(ok);
    if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`allowed host rejected: ${ok}`);
  }
  for (const bad of [
    "",
    "not a url",
    "https://www.chess-school.in",
    "https://chess-school.in",
    "http://10.0.2.2.example.com",
    "http://192.168.1.5:3000",
    "http://0.0.0.0:3210",
    "ftp://127.0.0.1",
    "http://user:secret@127.0.0.1:3210",
  ]) {
    let threw = false;
    try {
      assertLocalCaptureHost(bad);
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      if (/secret|user:|password/i.test(message)) {
        throw new Error("host guard included credentials in an error");
      }
    }
    if (!threw) throw new Error(`expected reject for ${bad || "(empty)"}`);
  }

  assertLocalDatabaseUrl(undefined);
  assertLocalDatabaseUrl("");
  assertLocalDatabaseUrl("file:local.db");
  assertLocalDatabaseUrl("file:/tmp/local.db");
  assertLocalDatabaseUrl("local.db");
  for (const bad of ["libsql://example.turso.io", "https://example.turso.io", "http://127.0.0.1:8080"]) {
    let threw = false;
    try {
      assertLocalDatabaseUrl(bad);
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("turso") || message.includes("libsql") || message.includes("8080")) {
        throw new Error("database guard echoed the remote URL");
      }
    }
    if (!threw) throw new Error(`expected database reject for a remote URL`);
  }
  console.log("✓ emulator-host self-test");
}

if (isDirectRun()) {
  const arg = process.argv[2];
  if (arg === "--self-test") {
    try {
      selfTest();
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else {
    try {
      const api = assertLocalCaptureHost(arg || process.env.EXPO_PUBLIC_API_URL);
      assertLocalDatabaseUrl(process.env.DATABASE_URL);
      console.log(`✓ capture API host is local (${api.hostname}${api.port ? `:${api.port}` : ""})`);
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }
}
