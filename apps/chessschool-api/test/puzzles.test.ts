import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import { isLegalFen, loadPuzzlePack, parsePuzzlePack } from "../src/puzzles";
import { runSeedPuzzles } from "../scripts/seed-puzzles";

const fixturePath = fileURLToPath(new URL("./fixtures/puzzles-stub.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { version: string; puzzles: { id: string }[] };
const CACHE = "public, max-age=300, stale-while-revalidate=86400";
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fileUrl() {
  const dir = await mkdtemp(join(tmpdir(), "cs-puzzles-"));
  dirs.push(dir);
  const path = join(dir, "puzzles.db");
  const db = await openDb(`file:${path}`);
  await db.$client.close();
  return { path, url: `file:${path}` };
}

describe("puzzle pack API", () => {
  it("returns 404 when nothing is seeded, then the pack, etag, and one puzzle", async () => {
    const { url } = await fileUrl();
    const db = await openDb(url);
    const app = createApp({ db, google: null, apple: null, secureCookies: false, corsOrigins: ["https://chess-school.in"], now: () => new Date("2026-11-13T00:00:00Z") });
    const empty = await app.request("/v1/puzzles/pack");
    expect(empty.status).toBe(404);
    expect(await empty.json()).toMatchObject({ error: "not_found" });
    expect(empty.headers.get("etag")).toBeNull();

    const seeded = await runSeedPuzzles({ argv: ["--file", fixturePath, "--apply"], env: { DATABASE_URL: url }, log: () => {} });
    expect(seeded).toBe(0);

    const pack = await app.request("/v1/puzzles/pack", { headers: { Origin: "https://chess-school.in" } });
    expect(pack.status).toBe(200);
    expect(pack.headers.get("etag")).toBe(`"${fixture.version}"`);
    expect(pack.headers.get("cache-control")).toBe(CACHE);
    expect(pack.headers.get("access-control-expose-headers")?.toLowerCase()).toContain("etag");
    const body = (await pack.json()) as { version: string; puzzles: { id: string; moves: string[]; themes: string[] }[] };
    expect(body.version).toBe(fixture.version);
    expect(body.puzzles.map((puzzle) => puzzle.id)).toEqual([...fixture.puzzles.map((puzzle) => puzzle.id)].sort());
    expect(Array.isArray(body.puzzles[0]?.moves)).toBe(true);
    expect(Array.isArray(body.puzzles[0]?.themes)).toBe(true);

    const cached = await app.request("/v1/puzzles/pack", { headers: { "If-None-Match": `"${fixture.version}"` } });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");

    const one = await app.request("/v1/puzzles/stub-01");
    expect(one.status).toBe(200);
    expect(one.headers.get("cache-control")).toBe(CACHE);
    expect(await one.json()).toMatchObject({ id: "stub-01", moves: ["h1h8"], themes: ["endgame"] });
    const cachedPack = await loadPuzzlePack(db);
    const cachedAgain = await loadPuzzlePack(db);
    expect(cachedAgain?.puzzles).toBe(cachedPack?.puzzles);
    const missing = await app.request("/v1/puzzles/missing");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: "not_found" });
    await db.$client.close();
  });
});

const legal = { id: "ok", fen: "4k3/8/8/8/8/8/8/4K2R w - - 0 1", moves: ["h1h8"], rating: 500, themes: ["endgame"] };

describe("parsePuzzlePack", () => {
  it("rejects an illegal FEN, an illegal move, a rating outside 100 to 3500, and an unknown theme", () => {
    expect(isLegalFen(legal.fen)).toBe(true);
    expect(isLegalFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(false);
    const parsed = parsePuzzlePack(JSON.stringify({
      version: "bad",
      puzzles: [
        { ...legal, id: "bad-fen", fen: "8/8/8/8/8/8/8/8 w - - 0 1" },
        { ...legal, id: "bad-move", moves: ["a1a2"] },
        { ...legal, id: "bad-rating", rating: 99 },
        { ...legal, id: "bad-theme", themes: ["not-a-theme"] },
        { ...legal, id: "many", fen: "8/8/8/8/8/8/8/8 w - - 0 1", moves: ["a1a2"], rating: 4000, themes: ["nope"] },
      ],
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      const text = parsed.errors.join("\n");
      expect(text).toMatch(/bad-fen: illegal fen/);
      expect(text).toMatch(/bad-move: illegal move a1a2/);
      expect(text).toMatch(/bad-rating: rating must be an integer from 100 to 3500/);
      expect(text).toMatch(/bad-theme: unknown theme not-a-theme/);
      expect(text).toMatch(/many: illegal fen/);
      expect(text).toMatch(/many: rating/);
      expect(text).toMatch(/many: unknown theme nope/);
    }
  });

  it("exits non-zero and does not write when any row is bad", async () => {
    const { path, url } = await fileUrl();
    const before = readFileSync(path);
    const file = join(path, "..", "bad.json");
    writeFileSync(file, JSON.stringify({ version: "bad", puzzles: [{ ...legal, id: "bad-move", moves: ["a1a2"] }] }));
    const errors: string[] = [];
    const code = await runSeedPuzzles({ argv: ["--file", file, "--apply"], env: { DATABASE_URL: url }, log: () => {}, error: (line) => errors.push(line) });
    expect(code).not.toBe(0);
    expect(errors.join("\n")).toMatch(/bad-move: illegal move a1a2/);
    expect(readFileSync(path).equals(before)).toBe(true);
  });
});

describe("seed:puzzles", () => {
  it("rejects bad rows and duplicate ids without writing", async () => {
    const { path, url } = await fileUrl();
    const before = readFileSync(path);
    const bad = {
      version: "bad",
      puzzles: [
        { id: "", fen: "not-a-fen", moves: [], rating: 1.5, themes: "fork" },
        { id: "dup", fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", moves: ["e2e4"], rating: 400, themes: ["endgame"] },
        { id: "dup", fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", moves: ["e2e4"], rating: 400, themes: ["endgame"] },
      ],
    };
    const parsed = parsePuzzlePack(JSON.stringify(bad));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join("\n")).toMatch(/id/);
      expect(parsed.errors.join("\n")).toMatch(/fen/);
      expect(parsed.errors.join("\n")).toMatch(/moves/);
      expect(parsed.errors.join("\n")).toMatch(/rating/);
      expect(parsed.errors.join("\n")).toMatch(/themes/);
      expect(parsed.errors.join("\n")).toMatch(/dup: duplicate id/);
    }
    const dir = join(path, "..");
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    const code = await runSeedPuzzles({ argv: ["--file", file, "--apply"], env: { DATABASE_URL: url }, log: () => {}, error: () => {} });
    expect(code).toBe(1);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it("dry-run writes nothing on a read-only file, then apply is idempotent and a new version swaps the pack", async () => {
    const { path, url } = await fileUrl();
    chmodSync(path, 0o444);
    const before = statSync(path);
    const bytes = readFileSync(path);
    const lines: string[] = [];
    try {
      const dry = await runSeedPuzzles({ argv: ["--file", fixturePath], env: { DATABASE_URL: url }, log: (line) => lines.push(line) });
      expect(dry).toBe(0);
      expect(lines).toContain("mode: dry-run");
      expect(lines).toContain("database: local");
      expect(lines).toContain(`insert: ${fixture.puzzles.length}`);
      expect(lines).toContain("update: 0");
      expect(lines).toContain("delete: 0");
      expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
      expect(readFileSync(path).equals(bytes)).toBe(true);
    } finally {
      chmodSync(path, 0o644);
    }

    expect(await runSeedPuzzles({ argv: ["--file", fixturePath, "--apply"], env: { DATABASE_URL: url }, log: () => {} })).toBe(0);
    const second: string[] = [];
    expect(await runSeedPuzzles({ argv: ["--file", fixturePath], env: { DATABASE_URL: url }, log: (line) => second.push(line) })).toBe(0);
    expect(second).toContain("insert: 0");
    expect(second).toContain("update: 0");
    expect(second).toContain("delete: 0");

    const next = {
      version: "stub-2",
      puzzles: [
        { ...fixture.puzzles[0], fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", moves: ["a1a8"] },
        { id: "stub-09", fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", moves: ["e1e2"], rating: 300, themes: ["endgame"] },
      ],
    };
    const nextFile = join(path, "..", "next.json");
    writeFileSync(nextFile, JSON.stringify(next));
    const swap: string[] = [];
    expect(await runSeedPuzzles({ argv: ["--file", nextFile], env: { DATABASE_URL: url }, log: (line) => swap.push(line) })).toBe(0);
    expect(swap).toContain("insert: 1");
    expect(swap).toContain("update: 1");
    expect(swap).toContain(`delete: ${fixture.puzzles.length - 1}`);
    expect(await runSeedPuzzles({ argv: ["--file", nextFile, "--apply"], env: { DATABASE_URL: url }, log: () => {} })).toBe(0);
    const db = await openDb(url);
    const { puzzles } = await import("../src/schema");
    const rows = await db.select().from(puzzles);
    expect(rows.map((row) => row.id).sort()).toEqual(["stub-01", "stub-09"]);
    expect(new Set(rows.map((row) => row.packVersion))).toEqual(new Set(["stub-2"]));
    await db.$client.close();

    let opened = false;
    const refused = await runSeedPuzzles({
      argv: ["--file", fixturePath, "--apply", "--remote-prod", "--confirm-version", "nope"],
      env: { DATABASE_URL: "libsql://secret-host.example/db", DATABASE_AUTH_TOKEN: "secret-token" },
      openDb: async () => {
        opened = true;
        throw new Error("should not open");
      },
      log: () => {},
      error: () => {},
    });
    expect(refused).toBe(1);
    expect(opened).toBe(false);
  });
});
