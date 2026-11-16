// Bundles the API into one Node function and writes Vercel's Build Output
// (.vercel/output). Deploy with `vercel deploy --prebuilt`.
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".vercel/output");
const fn = join(out, "functions/index.func");

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: [join(root, "src/vercel.ts")],
  outfile: join(fn, "index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  // The web client talks to Turso over HTTP and has no native bindings.
  alias: { "@libsql/client": "@libsql/client/web" },
  legalComments: "none",
  logLevel: "warning",
});

// 180 s: an AI lesson draft is up to two language-model calls of ~85 s each, and a coach explanation can try three providers.
writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.js", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 180 }, null, 2),
);
writeFileSync(join(out, "config.json"), JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }], crons: [{ path: "/v1/cron/weekly", schedule: "30 3 * * *" }, { path: "/v1/cron/leagues", schedule: "35 18 * * *" }] }, null, 2));
console.log("built", join(out));
