#!/usr/bin/env node
/**
 * Test-only store-shot student. Not for production and not for Play Console.
 *
 * Inserts the made-up user Alex into the local SQLite file with a streak and
 * some XP, so the Android screenshot flow is signed in. Curriculum still comes
 * from `pnpm db:seed` (`scripts/seed.mjs`). This file does not read seed.sql.
 *
 * Refuses a remote DATABASE_URL. Calls assertSafeCaptureHost on
 * STORE_SHOT_API_URL, then allows only localhost, 127.0.0.1, and 10.0.2.2.
 * Does not print the email, password, or student number.
 *
 *   STORE_SHOT_API_URL=http://10.0.2.2:3000 \
 *   STORE_SHOT_EMAIL=alex.store-shots@example.com \
 *   STORE_SHOT_PASSWORD=... \
 *   pnpm --filter web db:seed-store-shot
 */
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { assertSafeCaptureHost } from "../../mobile/store-assets/play-store/capture-host.mjs";

const DISPLAY_NAME = "Alex";
const STREAK = 4;
const XP = 240;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function localDbPath() {
  const raw = process.env.DATABASE_URL ?? "file:local.db";
  if (/^(libsql|https?):/i.test(raw)) {
    throw new Error("Refusing to seed the store-shot user into a remote database");
  }
  const stripped = raw.replace(/^file:/, "");
  if (!stripped || stripped.includes("://")) {
    throw new Error("Refusing to seed the store-shot user: DATABASE_URL is not a local file");
  }
  return isAbsolute(stripped) ? stripped : join(webRoot, stripped);
}

function requireLocalApiUrl() {
  const url = process.env.STORE_SHOT_API_URL?.trim();
  if (!url) throw new Error("STORE_SHOT_API_URL is required");
  assertSafeCaptureHost(url);
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      "Refusing to seed the store-shot user: STORE_SHOT_API_URL must be localhost, 127.0.0.1, or 10.0.2.2",
    );
  }
  return host;
}

function requireAccount() {
  const email = process.env.STORE_SHOT_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.STORE_SHOT_PASSWORD ?? "";
  if (!email.endsWith("@example.com") || email.startsWith("@")) {
    throw new Error("STORE_SHOT_EMAIL must be a made-up @example.com address");
  }
  if (password.length < 8) {
    throw new Error("STORE_SHOT_PASSWORD must be at least 8 characters");
  }
  return { email, password };
}

const host = requireLocalApiUrl();
const { email, password } = requireAccount();
const db = new Database(localDbPath());
db.pragma("foreign_keys = ON");

const now = Date.now();
const today = new Date(now).toISOString().slice(0, 10);
const data = JSON.stringify({
  rating: 800,
  placementDone: true,
  activityDays: { [today]: 40 },
  dailyGoalXp: 50,
});
const passwordHash = bcrypt.hashSync(password, 10);
const id = randomUUID();
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

const write = db.transaction(() => {
  if (existing?.id) db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'student', ?)",
  ).run(id, email, passwordHash, DISPLAY_NAME, now);
  db.prepare(
    "INSERT INTO profiles (user_id, student_no, enrolled_at, rank_title, onboarded) VALUES (?, ?, ?, 'Novice', 1)",
  ).run(id, "CS-STORE-00000", now);
  db.prepare(
    `INSERT INTO progress (user_id, xp, streak, last_active_day, daily_goal_xp, graduated_classes, data, updated_at)
     VALUES (?, ?, ?, ?, 50, '[]', ?, ?)`,
  ).run(id, XP, STREAK, today, data, now);
});
write();
db.close();

console.log(
  `Seeded store-shot student ${DISPLAY_NAME} (streak ${STREAK}, xp ${XP}) into the local database. API host ${host}.`,
);
