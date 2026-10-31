#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

out=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out) out="${2:?}"; shift 2 ;;
    -h|--help)
      echo "usage: scripts/release/deps-gate.sh [--out DIR]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$out" ] && mkdir -p "$out"

audit_tmp="$(mktemp)"
trap 'rm -f "$audit_tmp"' EXIT

pnpm audit --json >"$audit_tmp" 2>/dev/null || true
if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$audit_tmp" 2>/dev/null; then
  echo "deps-gate: pnpm audit did not produce valid JSON" >&2
  exit 2
fi

export AUDIT_TMP="$audit_tmp" WAIVERS_PATH="$ROOT/scripts/release/audit-waivers.json" OUT_DIR="$out"
result="$(node --input-type=module <<'NODE'
import fs from "node:fs";
import { evaluateDepsGate } from "./scripts/release/lib/audit.mjs";
const audit = JSON.parse(fs.readFileSync(process.env.AUDIT_TMP, "utf8"));
const waiverDoc = JSON.parse(fs.readFileSync(process.env.WAIVERS_PATH, "utf8"));
const r = evaluateDepsGate(audit, waiverDoc);
console.log(JSON.stringify(r));
NODE
)"

node -e "
const r=$result;
console.log(
  'critical='+r.counts.critical+
  ' high='+r.counts.high+
  ' moderate='+r.counts.moderate+
  ' low='+r.counts.low+
  ' unwaived='+r.unwaived.length
);
"

payload="$(node -e "const r=$result; console.log(JSON.stringify({ status: r.pass?'PASS':'FAIL', counts: r.counts, unwaived: r.unwaived }, null, 2));")"
if [ -n "$out" ]; then
  printf '%s\n' "$payload" >"$out/deps.json"
fi

if node -e "const r=$result; process.exit(r.pass?0:1)"; then
  echo "deps-gate: PASS"
  exit 0
fi
echo "deps-gate: FAIL (unwaived critical/high advisories)" >&2
exit 1
