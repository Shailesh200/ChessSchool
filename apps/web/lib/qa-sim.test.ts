import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isQaSimServer } from "@/lib/qa-sim";

const SIM = { QA_SIM: "1", DATABASE_URL: "file:local.db", NODE_ENV: "production" };

describe("isQaSimServer", () => {
  it("is on for the qa-sim runner: QA_SIM=1, a file database, `next start` (NODE_ENV=production)", () => {
    expect(isQaSimServer(SIM)).toBe(true);
    expect(isQaSimServer({ ...SIM, DATABASE_URL: "file:/tmp/x/test.db" })).toBe(true);
  });

  it("is off unless QA_SIM is exactly 1", () => {
    expect(isQaSimServer({ DATABASE_URL: "file:local.db" })).toBe(false);
    expect(isQaSimServer({ ...SIM, QA_SIM: "" })).toBe(false);
    expect(isQaSimServer({ ...SIM, QA_SIM: "0" })).toBe(false);
    expect(isQaSimServer({ ...SIM, QA_SIM: "true" })).toBe(false);
  });

  it("is off on any Vercel deploy, production or preview, even with QA_SIM=1", () => {
    expect(isQaSimServer({ ...SIM, VERCEL: "1" })).toBe(false);
    expect(isQaSimServer({ ...SIM, VERCEL_ENV: "production" })).toBe(false);
    expect(isQaSimServer({ ...SIM, VERCEL_ENV: "preview" })).toBe(false);
  });

  it("is off with a remote database, a Turso token or any TURSO_* variable", () => {
    const turso = "libsql://chessschool-shailesh200.aws-ap-south-1.turso.io";
    expect(isQaSimServer({ ...SIM, DATABASE_URL: turso })).toBe(false);
    expect(isQaSimServer({ ...SIM, DATABASE_AUTH_TOKEN: "t" })).toBe(false);
    expect(isQaSimServer({ ...SIM, TURSO_DATABASE_URL: "x" })).toBe(false);
    expect(isQaSimServer({ ...SIM, DATABASE_URL: undefined })).toBe(false);
  });

  it("is off for the container image's database path", () => {
    expect(isQaSimServer({ ...SIM, DATABASE_URL: "/app/data/local.db" })).toBe(false);
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
// QA_SIM as its own name; EXPO_PUBLIC_QA_SIM (the mobile build flag) is not it.
const QA_SIM_VAR = /(^|[^A-Z_])QA_SIM\b/;

describe("QA_SIM wiring", () => {
  it("only scripts/qa-sim-web.sh sets it, on the `next start` line, after the guard", () => {
    const web = read("scripts/qa-sim-web.sh");
    const lines = web.split("\n");
    const set = lines.filter((l) => /^QA_SIM=1 /.test(l));
    expect(set).toHaveLength(1);
    expect(set[0]).toContain("next start -p 3108");
    expect(web.indexOf("QA_SIM=1 setsid")).toBeGreaterThan(
      web.lastIndexOf("qa-sim-guard.sh"),
    );
    expect(web).not.toMatch(/export QA_SIM/);
  });

  it("no deploy config sets it", () => {
    const files = [
      "apps/web/Dockerfile",
      "apps/web/vercel.json",
      "apps/web/.env.example",
      "apps/mobile/eas.json",
      "apps/mobile/.eas/workflows/qa-sim.yml",
      ...readdirSync(path.join(root, ".github/workflows")).map(
        (f) => `.github/workflows/${f}`,
      ),
    ];
    for (const f of files) {
      expect(read(f), f).not.toMatch(QA_SIM_VAR);
    }
  });

  it("no app code calls the expire route (only the Maestro flow does)", () => {
    const skip = new Set(["node_modules", ".next", ".expo", "dist"]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) {
          if (full.includes(path.join("api", "qa", "expire-session"))) continue;
          if (readFileSync(full, "utf8").includes("qa/expire-session")) hits.push(full);
        }
      }
    };
    for (const d of [
      "apps/web/app",
      "apps/web/components",
      "apps/web/core",
      "apps/web/features",
      "apps/web/lib",
      "apps/mobile/src",
      "apps/mobile/app",
    ]) {
      walk(path.join(root, d));
    }
    expect(hits).toEqual([]);
  });

  it("the guard is imported by the expire route alone, so no client code can pull it in", () => {
    const skip = new Set(["node_modules", ".next", ".expo", "dist"]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\./.test(name)) {
          const src = readFileSync(full, "utf8");
          if (/qa-sim["']/.test(src) || /isQaSimServer/.test(src)) {
            hits.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, "apps/web"));
    walk(path.join(root, "apps/mobile/src"));
    walk(path.join(root, "apps/mobile/app"));
    expect(hits.sort()).toEqual([
      "apps/web/app/api/qa/expire-session/route.ts",
      "apps/web/lib/qa-sim.ts",
    ]);
    const route = read("apps/web/app/api/qa/expire-session/route.ts");
    expect(route).not.toMatch(/["']use client["']/);
    const guard = read("apps/web/lib/qa-sim.ts");
    expect(guard).not.toMatch(/["']use client["']/);
  });
});
