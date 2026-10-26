#!/usr/bin/env node
/**
 * EAS hook (`eas-build-pre-install`). One script so this key is not duplicated.
 *
 * PR #23 (P1-14) adds `scripts/fetch-stockfish.sh` and would otherwise set
 * this same npm script to `bash scripts/fetch-stockfish.sh`. #55 merges after
 * #23. When that file is present, run it first (iOS downloads pinned
 * Stockfish; Android exits 0). Then refuse production and preview builds
 * that set EXPO_PUBLIC_PARITY.
 *
 * EAS runs this before dependencies install, so it stays dependency-free.
 * Any value of the flag counts as set, including "" and "0".
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fetchScript = path.join(here, "fetch-stockfish.sh");
if (fs.existsSync(fetchScript)) {
  const fetched = spawnSync("bash", [fetchScript], {
    cwd: path.resolve(here, ".."),
    stdio: "inherit",
  });
  if ((fetched.status ?? 1) !== 0) process.exit(fetched.status ?? 1);
}

const profile = process.env.EAS_BUILD_PROFILE?.trim();
const flag = process.env.EXPO_PUBLIC_PARITY;
if ((profile === "production" || profile === "preview") && flag !== undefined) {
  console.error(
    `eas-build-pre-install: refusing ${profile} build because EXPO_PUBLIC_PARITY is set to ${JSON.stringify(flag)}. Production and preview builds must not include the parity auto-login deep link.`,
  );
  process.exit(1);
}
