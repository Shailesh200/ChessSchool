import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { parseAllowList, runQaCleanup } from "../src/qa-accounts";
import { profiles, progress, sessions, users } from "../src/schema";

const LIST = `# ChessSchool v2 QA accounts on prod (api.chess-school.in). WIPE ALL BEFORE LAUNCH.
Email pattern: qa+<tester>-<sha7>-<n>@<team test domain>.
| email | created by | date/time IST | build/SHA | platform | notes |
|---|---|---|---|---|---|
| QA+Scout-6109687-1@Example.Test | local test | 2026-11-13 12:00 | 6109687 | web | fixture |
| qa+missing-aaaaaaa-9@example.test | local test | 2026-11-13 12:00 | 6109687 | web | absent |
| student@example.com | local test | 2026-11-13 12:00 | 6109687 | web | not a qa address |
| *@example.test | local test | 2026-11-13 12:00 | 6109687 | web | too broad |
`;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = [join(packageRoot, "node_modules/.bin/tsx"), join(packageRoot, "../../node_modules/.bin/tsx")].find((path) => existsSync(path));
const scriptPath = join(packageRoot, "scripts/delete-qa-accounts.ts");

function runScript(args: string[], env: Record<string, string | undefined>) {
  if (!tsxBin) throw new Error("tsx is not installed");
  return spawnSync(tsxBin, [scriptPath, ...args], { cwd: packageRoot, env: { ...process.env, ...env }, encoding: "utf8" });
}

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fileDb() {
  const dir = await mkdtemp(join(tmpdir(), "cs-qa-"));
  dirs.push(dir);
  const path = join(dir, "qa.db");
  const db = await openDb(`file:${path}`);
  const rows = [
    ["u1", "qa+scout-6109687-1@example.test"],
    ["u2", "qa+other-abcdef0-3@example.test"],
    ["u3", "student@example.com"],
    ["u4", "qa+scout-6109687-2@example.test"],
  ] as const;
  for (const [id, email] of rows) {
    await db.insert(users).values({ id, email, name: id, passwordHash: null, googleSub: null, appleSub: null, guestId: null, kind: "member", createdAt: 1 });
    await db.insert(sessions).values({ tokenHash: `tok-${id}`, userId: id, createdAt: 1, expiresAt: 9_999_999_999_999 });
    await db.insert(progress).values({ userId: id, data: "{}", updatedAt: 1 });
    await db.insert(profiles).values({ userId: id, who: null, dailyMinutes: 10, appearance: "system", sound: true, avatar: null, flair: null });
  }
  return { dir, path, db };
}

describe("QA account cleanup", () => {
  it("parses the email column and rejects rows that are not QA addresses", () => {
    const parsed = parseAllowList(LIST);
    expect(parsed.error).toBeUndefined();
    expect(parsed.emails).toEqual(["qa+scout-6109687-1@example.test", "qa+missing-aaaaaaa-9@example.test"]);
    expect(parsed.rejected).toEqual(["student@example.com", "*@example.test"]);
  });

  it("dry-run changes nothing and apply deletes only listed matches", async () => {
    const { path, db } = await fileDb();
    const parsed = parseAllowList(LIST);
    const preview = await runQaCleanup(db, { emails: parsed.emails, apply: false, max: 200 });
    expect(preview.deleted).toEqual([]);
    expect(preview.found.map((row) => row.email)).toEqual(["qa+scout-6109687-1@example.test"]);
    expect(preview.missing).toEqual(["qa+missing-aaaaaaa-9@example.test"]);
    expect(preview.unlisted.sort()).toEqual(["qa+other-abcdef0-3@example.test", "qa+scout-6109687-2@example.test"]);
    expect(await db.select().from(users)).toHaveLength(4);

    const applied = await runQaCleanup(db, { emails: parsed.emails, apply: true, max: 200 });
    expect(applied.deleted).toEqual(["qa+scout-6109687-1@example.test"]);
    expect(await db.query.users.findFirst({ where: eq(users.email, "qa+scout-6109687-1@example.test") })).toBeUndefined();
    expect(await db.select().from(sessions).where(eq(sessions.userId, "u1"))).toEqual([]);
    expect(await db.select().from(progress).where(eq(progress.userId, "u1"))).toEqual([]);
    expect(await db.select().from(profiles).where(eq(profiles.userId, "u1"))).toEqual([]);
    expect((await db.query.users.findFirst({ where: eq(users.email, "qa+other-abcdef0-3@example.test") }))?.id).toBe("u2");
    expect((await db.query.users.findFirst({ where: eq(users.email, "student@example.com") }))?.id).toBe("u3");
    expect(await db.select().from(sessions).where(eq(sessions.userId, "u2"))).toHaveLength(1);

    const listPath = join(path, "..", "list.md");
    await writeFile(listPath, LIST);
    const dry = runScript(["--list", listPath], { DATABASE_URL: `file:${path}` });
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("mode: dry-run");
    expect(dry.stdout).toContain("no accounts deleted");
    expect(dry.stdout).toContain("unlisted-email: qa+other-abcdef0-3@example.test");
    expect((await db.query.users.findFirst({ where: eq(users.email, "qa+other-abcdef0-3@example.test") }))?.id).toBe("u2");
  });

  it("refuses a broad run over max and a non-local database", async () => {
    const { path, db } = await fileDb();
    const both = ["qa+scout-6109687-1@example.test", "qa+scout-6109687-2@example.test"];
    const refused = await runQaCleanup(db, { emails: both, apply: true, max: 1 });
    expect(refused.refused).toMatch(/exceed max 1/);
    expect(refused.deleted).toEqual([]);
    expect(await db.select().from(users)).toHaveLength(4);

    const listPath = join(path, "..", "list.md");
    await writeFile(listPath, LIST);
    const remote = "libsql://example.invalid";
    const run = runScript(["--list", listPath, "--apply"], { DATABASE_URL: remote, DATABASE_AUTH_TOKEN: "secret-token" });
    expect(run.status).not.toBe(0);
    const output = `${run.stdout}\n${run.stderr}`;
    expect(output).toMatch(/local sqlite file/);
    expect(output).not.toContain(remote);
    expect(output).not.toContain("secret-token");
  });
});
