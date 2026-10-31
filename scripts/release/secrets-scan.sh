#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

out=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out) out="${2:?}"; shift 2 ;;
    -h|--help)
      echo "usage: scripts/release/secrets-scan.sh [--out DIR]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$out" ] && mkdir -p "$out"

findings="$(node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  isDisallowedEnvFile,
  isTestLikePath,
  scanFileContent,
  staticBundleForbiddenNames,
  formatFinding,
} from "./scripts/release/lib/secrets.mjs";

const root = process.cwd();
const ls = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer" });
if (ls.status !== 0) process.exit(2);
const files = ls.stdout.toString("utf8").split("\0").filter(Boolean);
const hits = [];

for (const rel of files) {
  if (isTestLikePath(rel)) continue;
  if (isDisallowedEnvFile(rel)) {
    hits.push(formatFinding(rel, 0, "tracked-env-file"));
    continue;
  }
  let content;
  try {
    content = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    continue;
  }
  const lines = content.split("\n");
  hits.push(
    ...scanFileContent({ path: rel, lines }).map((f) =>
      formatFinding(f.path, f.line, f.rule),
    ),
  );
}

const staticDir = path.join(root, "apps/web/.next/static");
if (fs.existsSync(staticDir)) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) {
        let text;
        try {
          text = fs.readFileSync(p, "utf8");
        } catch {
          continue;
        }
        const rel = path.relative(root, p);
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (const rule of staticBundleForbiddenNames(lines[i])) {
            hits.push(formatFinding(rel, i + 1, rule));
          }
        }
      }
    }
  };
  walk(staticDir);
}

process.stdout.write(JSON.stringify(hits));
NODE
)"

count="$(node -e "const h=$findings; console.log(h.length)")"
if [ "$count" -gt 0 ]; then
  echo "secrets-scan: FAIL ($count finding(s))"
  node -e "const h=$findings; for (const line of h) console.log('  '+line);"
  status=FAIL
  code=1
else
  echo "secrets-scan: PASS"
  status=PASS
  code=0
fi

if [ -n "$out" ]; then
  node -e "
    const h=$findings;
    const fs=require('fs');
    fs.writeFileSync(process.argv[1], JSON.stringify({ status: process.argv[2], findings: h }, null, 2));
  " "$out/secrets.json" "$status"
fi
exit "$code"
