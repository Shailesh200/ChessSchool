// Phase 1, 2 and 3 walkthroughs, in order.
// Usage: node e2e/phase1-3.mjs [outDir]   (web on BASE_URL, default http://localhost:3100)
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiBase = process.env.CHESSSCHOOL_API_URL ?? "";
if (apiBase.toLowerCase().includes("chess-school.in")) {
  console.error("refusing to run: API base URL must be a local server");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const steps = ["phase1.mjs", "phase2.mjs", "phase3.mjs"];

for (const step of steps) {
  const args = [join(here, step)];
  if (out) args.push(join(out, step.replace(/\.mjs$/, "")));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (status) => resolve(status ?? 1));
  });
  if (code !== 0) process.exit(code);
}
