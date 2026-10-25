import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/libsql";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createLibsqlClient } from "@/db/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

export type TestDb = LibSQLDatabase<typeof schema>;

/** Drop the cached Drizzle singleton so the next import picks up DATABASE_URL. */
export function resetGlobalDb(): void {
  (globalThis as unknown as { __db?: unknown }).__db = undefined;
}

const migrationsFolder = fileURLToPath(new URL("../db/migrations", import.meta.url));

/** Apply committed migrations. Same journal format drizzle-kit migrate uses. */
function applyMigrations(dbPath: string): void {
  const sqlite = new Database(dbPath);
  try {
    migrate(drizzleSqlite(sqlite), { migrationsFolder });
  } finally {
    sqlite.close();
  }
}

/** Isolated libSQL file + Drizzle client (pass `conn` into server helpers). */
export function createIsolatedTestDb(): {
  dir: string;
  db: TestDb;
  teardown: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "cs-test-"));
  const dbPath = join(dir, "test.db");
  applyMigrations(dbPath);
  const client = createLibsqlClient(`file:${dbPath}`);
  const db = drizzle(client, { schema }) as TestDb;
  return {
    dir,
    db,
    teardown: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Boot `@/db` against a fresh temp file — use before dynamically importing API routes.
 * Call `teardown()` (and `vi.resetModules()`) in afterEach.
 */
export async function bootApiTestEnv(): Promise<{
  dir: string;
  db: TestDb;
  teardown: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), "cs-api-"));
  const dbPath = join(dir, "test.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
  resetGlobalDb();
  applyMigrations(dbPath);
  const { db } = await import("@/db");
  return {
    dir,
    db: db as TestDb,
    teardown: () => {
      rmSync(dir, { recursive: true, force: true });
      resetGlobalDb();
    },
  };
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Distinct synthetic IP per test — avoids in-memory rate-limit bucket collisions. */
export function testIp(slot: number): Record<string, string> {
  return { "x-forwarded-for": `203.0.${Math.floor(slot / 256)}.${slot % 256}` };
}

export async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
