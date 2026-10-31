#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

run_ci_config() {
  local scripts_json fail=0 ran=0
  scripts_json="$(node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts||{}));")"
  echo "ci-config: checking root package.json scripts"
  for name in lint typecheck format:check; do
    if node -e "const s=$scripts_json; process.exit(s['$name']?0:1)" 2>/dev/null; then
      ran=$((ran + 1))
      echo "ci-config: pnpm -w $name"
      if ! pnpm -w "$name"; then
        fail=1
      fi
    fi
  done
  if [ "$ran" -eq 0 ]; then
    echo "ci-config: no lint/typecheck/format:check scripts at repo root" >&2
    return 1
  fi
  [ "$fail" -eq 0 ]
}

run_db_safety() {
  node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  findProdLibsqlInFile,
  drizzleConfigHardcodesRemoteUrl,
} from "./scripts/release/lib/db-safety.mjs";

const root = process.cwd();
const ls = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer" });
if (ls.status !== 0) process.exit(2);
const files = ls.stdout.toString("utf8").split("\0").filter(Boolean);
const hits = [];
for (const rel of files) {
  let content;
  try {
    content = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    continue;
  }
  hits.push(...findProdLibsqlInFile(rel, content));
  hits.push(...drizzleConfigHardcodesRemoteUrl(rel, content));
}
if (hits.length) {
  for (const h of hits) console.error(`${h.path}:${h.line} ${h.kind}`);
  process.exit(1);
}
console.log("db-safety: PASS");
NODE
}

SHA=""
out=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out) out="${2:?}"; shift 2 ;;
    -h|--help)
      echo "usage: scripts/release/run-all.sh <SHA> [--out DIR]"
      exit 0
      ;;
    *)
      if [ -z "$SHA" ]; then SHA="$1"; shift
      else echo "unknown argument: $1" >&2; exit 2
      fi
      ;;
  esac
done

[ -n "$SHA" ] || { echo "pass the run SHA as the first argument" >&2; exit 2; }
printf '%s' "$SHA" | grep -Eq '^[0-9a-fA-F]{40}$' || { echo "SHA must be 40 hex chars" >&2; exit 2; }
SHA="$(printf '%s' "$SHA" | tr '[:upper:]' '[:lower:]')"

[ -n "$out" ] || out="release-out/$SHA"
mkdir -p "$out"

SUMMARY_FILE="$out/summary.json"
CHECKS='{}'

set_check() {
  local name="$1" status="$2"
  CHECKS="$(node -e "
    const c=JSON.parse(process.argv[1]);
    c[process.argv[2]]={status:process.argv[3]};
    console.log(JSON.stringify(c));
  " "$CHECKS" "$name" "$status")"
}

any_fail=0

if bash scripts/release/deps-gate.sh --out "$out"; then
  set_check deps-gate PASS
else
  set_check deps-gate FAIL
  any_fail=1
fi

if bash scripts/release/secrets-scan.sh --out "$out"; then
  set_check secrets-scan PASS
else
  set_check secrets-scan FAIL
  any_fail=1
fi

if run_ci_config; then
  set_check ci-config PASS
else
  set_check ci-config FAIL
  any_fail=1
fi

if run_db_safety; then
  set_check db-safety PASS
else
  set_check db-safety FAIL
  any_fail=1
fi

if [ -n "${BASE:-}" ] && [ -n "${STAGING:-}" ]; then
  if bash scripts/release/approved-check.sh --base "$BASE" --staging "$STAGING"; then
    set_check approved-check PASS
  else
    set_check approved-check FAIL
    any_fail=1
  fi
else
  set_check approved-check SKIPPED
  echo "approved-check: SKIPPED (set BASE and STAGING to run)"
fi

node -e "
const fs=require('fs');
const summary={ sha: process.argv[1], checks: JSON.parse(process.argv[2]) };
fs.writeFileSync(process.argv[3], JSON.stringify(summary, null, 2));
" "$SHA" "$CHECKS" "$SUMMARY_FILE"

echo "run-all: wrote $SUMMARY_FILE"
[ "$any_fail" -eq 0 ] || exit 1
