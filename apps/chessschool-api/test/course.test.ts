import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSeedCourse } from "../scripts/seed-course";
import { createApp } from "../src/app";
import { applyCourse, loadPath } from "../src/course";
import { checkCourse, type CourseDoc } from "../src/course-check";
import { openDb } from "../src/db";
import { progress, users } from "../src/schema";
import { COURSE, seededDb } from "./course-fixture";

const NOW = new Date("2026-11-14T10:00:00Z");
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const clone = (): CourseDoc => JSON.parse(JSON.stringify(COURSE));
const unitNo = (id: string) => Number(id.slice(4));

describe("data/course.json", () => {
  it("has 200+ playable lessons in 42 units, teaching and practice alternating after unit 18", () => {
    expect(COURSE.lessons.length).toBeGreaterThanOrEqual(200);
    expect(COURSE.units.map((u) => u.id)).toEqual(Array.from({ length: 42 }, (_, i) => `unit${i + 1}`));
    expect(COURSE.lessons[0]!.id).toBe("meet");
    for (const u of COURSE.units.filter((x) => unitNo(x.id) > 18)) {
      const lessons = COURSE.lessons.filter((l) => l.unit === u.id);
      const practice = unitNo(u.id) % 2 === 0;
      expect(lessons.length, u.id).toBe(practice ? 6 : 5);
      expect(lessons.every((l) => l.id.startsWith("practice") === practice), u.id).toBe(true);
      expect(u.title, u.id).toMatch(new RegExp(`^Unit ${unitNo(u.id)} · ${practice ? "Practice: " : ""}`));
    }
  });

  it("puts practice positions in order from easy to hard and names their sources", () => {
    for (const l of COURSE.lessons.filter((x) => x.id.startsWith("practice"))) {
      const lines = l.steps.filter((s) => s.kind === "line");
      expect(lines, l.id).toHaveLength(5);
      expect((l as unknown as { sources: string[] }).sources, l.id).toHaveLength(5);
      expect(l.steps[0]!.kind, l.id).toBe("say");
    }
  });
});

describe("checkCourse", () => {
  it("rejects broken lessons and says which", { timeout: 60_000 }, () => {
    const doc = clone();
    const choice = doc.lessons.find((l) => l.steps.some((s) => s.kind === "choice"))!;
    const step = choice.steps.find((s) => s.kind === "choice")!;
    if (step.kind === "choice") step.options = step.options.map((o) => ({ ...o, correct: true }));
    const move = doc.lessons.find((l) => l.id === "anastasiaMate")!;
    const m = move.steps.find((s) => s.kind === "move")!;
    m.fen = "8/4N1pk/8/8/8/8/8/K7 w - - 0 1"; // no rook: no mate left
    const line = doc.lessons.find((l) => l.id === "visualise")!;
    const ln = line.steps.find((s) => s.kind === "line")!;
    if (ln.kind === "line") ln.moves = ["b1c3", "d7d6", "c3h3"]; // a rook can't jump like a knight
    doc.lessons.push({ ...doc.lessons[1]!, id: doc.lessons[1]!.id });
    doc.lessons.push({ ...doc.lessons[2]!, id: "orphan", unit: "unit99" });
    const result = checkCourse(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const all = result.errors.join("\n");
    expect(all).toMatch(new RegExp(`${choice.id} step \\d+: a choice needs exactly one correct option`));
    expect(all).toMatch(/anastasiaMate step 2 .*no legal move meets the goal/);
    expect(all).toMatch(/visualise step 2 .*line move b1c3 is not accepted/);
    expect(all).toMatch(new RegExp(`lesson ${doc.lessons[1]!.id}: duplicate id`));
    expect(all).toMatch(/lesson orphan: unknown unit unit99/);
  });
});

describe("course served from the database", () => {
  it("serves exactly what the tables hold, and a reseed changes it without a code change", async () => {
    const db = await seededDb();
    const app = createApp({ db, google: null, apple: null, secureCookies: false, corsOrigins: [], now: () => NOW });
    const first = (await (await app.request("/v1/course?outline=1")).json()) as { version: string; lessons: { id: string; title: string }[]; units: unknown[] };
    expect(first.version).toBe(COURSE.version);
    expect(first.lessons).toHaveLength(COURSE.lessons.length);
    expect(first.units).toHaveLength(42);

    const edited = clone();
    edited.version = "course-test-2";
    edited.lessons.find((l) => l.id === "anastasiaMate")!.title = "Anastasia's mate (edited in the database)";
    const counts = await applyCourse(db, edited);
    expect(counts).toMatchObject({ update: 1, insert: 0, delete: 0 });
    const second = (await (await app.request("/v1/course?outline=1")).json()) as { version: string; lessons: { id: string; title: string }[] };
    expect(second.version).toBe("course-test-2");
    expect(second.lessons.find((l) => l.id === "anastasiaMate")?.title).toBe("Anastasia's mate (edited in the database)");

    const lesson = await app.request("/v1/lessons/board");
    expect(lesson.status).toBe(200);
    expect(((await lesson.json()) as { steps: unknown[] }).steps.length).toBeGreaterThan(0);
    expect((await app.request("/v1/lessons/notALesson")).status).toBe(404);
  });

  it("answers 404 for the course and never trims progress before a course is seeded", async () => {
    const db = await openDb(":memory:");
    expect(await loadPath(db)).toEqual([]);
    const app = createApp({ db, google: null, apple: null, secureCookies: false, corsOrigins: [], now: () => NOW });
    expect((await app.request("/v1/course")).status).toBe(404);
    const reg = await app.request("/v1/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "A", email: "seedless@b.co", password: "pawnpawn" }) });
    const { token } = (await reg.json()) as { token: string };
    const [user] = await db.select().from(users);
    const stored = { completed: { meet: "2026-11-03", board: "2026-11-04" }, xp: 30, streak: { count: 1, lastDay: "2026-11-04" }, minutes: { day: "2026-11-04", value: 7 } };
    await db.insert(progress).values({ userId: user!.id, data: JSON.stringify(stored), updatedAt: 1 });
    const put = await app.request("/v1/progress", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ progress: stored }) });
    expect(put.status).toBe(503);
    const [row] = await db.select().from(progress);
    expect(JSON.parse(row!.data)).toEqual(stored);
    const login = await app.request("/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "seedless@b.co", password: "pawnpawn" }) });
    expect(((await login.json()) as { progress: { completed: Record<string, string> } }).progress.completed).toEqual(stored.completed);
  });
});

describe("seed:course", () => {
  async function tmp() {
    const dir = await mkdtemp(join(tmpdir(), "cs-course-"));
    dirs.push(dir);
    return dir;
  }

  it("writes nothing when any lesson is broken", { timeout: 60_000 }, async () => {
    const dir = await tmp();
    const url = `file:${join(dir, "c.db")}`;
    (await openDb(url)).$client.close();
    const broken = clone();
    broken.lessons[1]!.steps = [];
    await writeFile(join(dir, "broken.json"), JSON.stringify(broken));
    const errors: string[] = [];
    expect(await runSeedCourse({ argv: ["--file", join(dir, "broken.json"), "--apply"], env: { DATABASE_URL: url }, log: () => {}, error: (l) => errors.push(l) })).toBe(1);
    expect(errors.join("\n")).toMatch(/steps must be a non-empty array/);
    expect(await loadPath(await openDb(url))).toEqual([]);
  });

  it("applies locally, then reports nothing to change", { timeout: 60_000 }, async () => {
    const dir = await tmp();
    const url = `file:${join(dir, "c.db")}`;
    (await openDb(url)).$client.close();
    const lines: string[] = [];
    expect(await runSeedCourse({ argv: ["--apply"], env: { DATABASE_URL: url }, log: (l) => lines.push(l), error: () => {} })).toBe(0);
    expect(lines).toContain(`insert: ${COURSE.lessons.length}`);
    lines.length = 0;
    expect(await runSeedCourse({ argv: [], env: { DATABASE_URL: url }, log: (l) => lines.push(l), error: () => {} })).toBe(0);
    expect(lines).toContain(`unchanged: ${COURSE.lessons.length}`);
  });

  it("refuses a remote database without --remote-prod, and a remote write without the version", { timeout: 60_000 }, async () => {
    const errors: string[] = [];
    const io = { env: { DATABASE_URL: "libsql://example.turso.io", DATABASE_AUTH_TOKEN: "t" }, log: () => {}, error: (l: string) => errors.push(l) };
    expect(await runSeedCourse({ ...io, argv: ["--apply"] })).toBe(1);
    expect(await runSeedCourse({ ...io, argv: ["--apply", "--remote-prod"] })).toBe(1);
    expect(errors.join("\n")).toMatch(/--remote-prod/);
    expect(errors.join("\n")).toMatch(new RegExp(`--confirm-version ${COURSE.version}`));
  });
});
