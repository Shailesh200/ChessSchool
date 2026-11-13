#!/usr/bin/env node
// Regenerates every committed asset in packages/chessschool-design/assets.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const script of ["cody.mjs", "fx.mjs", "sounds.mjs", "raster.mjs"]) {
  execFileSync(process.execPath, [join(here, script)], { stdio: "inherit" });
}
