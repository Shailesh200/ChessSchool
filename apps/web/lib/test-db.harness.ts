import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

export type TestDb = LibSQLDatabase<typeof schema>;

/** Drop the cached Drizzle singleton so the next import picks up DATABASE_URL. */
export function resetGlobalDb(): void {
  (globalThis as unknown as { __db?: unknown }).__db = undefined;
}

function pushSchema(dbPath: string): void {
  execSync("pnpm exec drizzle-kit push", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  });
}

/** Isolated libSQL file + Drizzle client (pass `conn` into server helpers). */
export function createIsolatedTestDb(): {
  dir: string;
  db: TestDb;
  teardown: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "cs-test-"));
  const dbPath = join(dir, "test.db");
  pushSchema(dbPath);
  const client = createClient({ url: `file:${dbPath}` });
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
  pushSchema(dbPath);
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
