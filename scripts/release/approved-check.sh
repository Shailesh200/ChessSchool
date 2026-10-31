#!/usr/bin/env bash
# Approved patch-id list + merge + identity checks for B..S (GT-004).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

B=""; S=""; approved="$ROOT/release/approved-patch-ids.txt"
while [ $# -gt 0 ]; do
  case "$1" in
    --base) B="${2:?}"; shift 2 ;;
    --staging) S="${2:?}"; shift 2 ;;
    --approved) approved="${2:?}"; shift 2 ;;
    -h|--help)
      echo "usage: scripts/release/approved-check.sh --base B --staging S [--approved FILE]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "approved-check REFUSED: $*" >&2; exit 1; }

[ -n "$B" ] && [ -n "$S" ] || die "pass --base B and --staging S"
for v in B S; do
  printf '%s' "${!v}" | grep -Eq '^[0-9a-fA-F]{40}$' || die "$v must be a full 40-hex SHA"
  printf -v "$v" '%s' "$(printf '%s' "${!v}" | tr '[:upper:]' '[:lower:]')"
done
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git work tree"
git cat-file -e "$B^{commit}" 2>/dev/null || die "base $B not found"
git cat-file -e "$S^{commit}" 2>/dev/null || die "staging $S not found"
git merge-base --is-ancestor "$B" "$S" 2>/dev/null || die "base is not an ancestor of staging"
[ -f "$approved" ] || die "approved list not found: $approved"

unset GIT_DIFF_OPTS
pgit() {
  git -c diff.context=3 -c diff.noprefix=false -c diff.mnemonicPrefix=false -c diff.relative=false \
    -c diff.srcPrefix=a/ -c diff.dstPrefix=b/ -c diff.external= -c diff.renames=true \
    -c diff.algorithm=myers -c diff.interHunkContext=0 -c core.abbrev=auto -c core.quotepath=true \
    -c log.showSignature=false "$@"
}

ids="$(mktemp)"; nonmerge="$(mktemp)"; merges="$(mktemp)"; idlog="$(mktemp)"
trap 'rm -f "$ids" "$nonmerge" "$merges" "$idlog"' EXIT

pgit log -p --no-color --no-ext-diff --no-textconv "$B..$S" | git patch-id --stable >"$ids"
git rev-list --no-merges "$B..$S" >"$nonmerge"
git rev-list --merges "$B..$S" >"$merges"
git log --format='%an <%ae> | %cn <%ce>%n%B' "$B..$S" >"$idlog"

echo "approved-check: base ${B:0:12} staging ${S:0:12} list $approved"

export APPROVED_PATH="$approved" IDS_PATH="$ids" NONMERGE_PATH="$nonmerge" MERGES_PATH="$merges" IDLOG_PATH="$idlog"
result="$(node --input-type=module <<'NODE'
import fs from "node:fs";
import { parseApprovedRows, evaluateApprovedCheck } from "./scripts/release/lib/approved.mjs";

const approvedText = fs.readFileSync(process.env.APPROVED_PATH, "utf8");
const rows = parseApprovedRows(approvedText);
const patchLines = fs
  .readFileSync(process.env.IDS_PATH, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [patchId, commit] = line.split(/\s+/);
    return { patchId, commit };
  });
const nonMergeCommits = fs
  .readFileSync(process.env.NONMERGE_PATH, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);
const mergeCommits = fs
  .readFileSync(process.env.MERGES_PATH, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);
const identityLog = fs.readFileSync(process.env.IDLOG_PATH, "utf8");
const r = evaluateApprovedCheck({
  rows,
  patchLines,
  nonMergeCommits,
  mergeCommits,
  identityLog,
});
console.log(JSON.stringify(r));
NODE
)"

node -e "const r=$result; for (const e of r.errors.slice(0, 20)) console.log('  '+e); if (r.errors.length>20) console.log('  ...');"

if node -e "const r=$result; process.exit(r.pass?0:1)"; then
  echo "approved-check: PASS"
  exit 0
fi
echo "approved-check: FAIL" >&2
exit 1
