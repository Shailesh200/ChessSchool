#!/usr/bin/env bash
# DRAFT. Pre-flight checks for the qa-sim workflow. Prints names and verdicts only, never values.
#   qa-sim-preflight.sh guard   (guard job)  : SHA given + 40 hex, HEAD == SHA, clean tree, DATABASE_URL file:, eas.json profiles, UTC window
#   qa-sim-preflight.sh e2e     (e2e job)    : the same SHA/HEAD/clean checks + the build job's git_commit_hash == SHA, UTC window
# Env: QA_SHA (dispatched git_commit_sha), QA_BUILD_SHA (e2e only: needs.build_android.outputs.git_commit_hash)
#   guard mode also: apps/mobile/app/onboarding.tsx has the avatar testID (slot 14a), eas.json profiles, no job-level EXPO_PUBLIC_QA_SIM in the workflow
set -euo pipefail
mode="${1:?mode guard|e2e}"
fail() { echo "qa-sim preflight REFUSED: $*" >&2; exit 1; }

sha="${QA_SHA:-}"
[ -n "$sha" ] || fail "git_commit_sha is empty (the run must be pinned to an exact commit)"
printf '%s' "$sha" | grep -Eq '^[0-9a-fA-F]{40}$' || fail "git_commit_sha must be a full 40-character hex SHA"
sha="$(printf '%s' "$sha" | tr '[:upper:]' '[:lower:]')"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "no git repository in this job (cannot verify HEAD)"
head="$(git rev-parse HEAD)"
[ "$head" = "$sha" ] || fail "HEAD is $head, not the dispatched $sha"
[ -z "$(git status --porcelain)" ] || fail "working tree is not clean (git status --porcelain is not empty)"
echo "ok: HEAD == dispatched SHA, tree clean"

if [ "$mode" = e2e ]; then
  b="$(printf '%s' "${QA_BUILD_SHA:-}" | tr '[:upper:]' '[:lower:]')"
  [ -n "$b" ] || fail "the build job reported no git_commit_hash"
  [ "$b" = "$sha" ] || fail "the APK was built from $b, not the dispatched $sha"
  echo "ok: APK build commit == dispatched SHA"
fi

# Midnight-UTC window: the app/server day keys and the 20-40 minute run must not straddle 00:00 UTC.
# Refuse 22:30-00:30 UTC (04:00-06:00 IST): the build takes 15-25 min and the last units run 25-35 min after e2e starts, so a
# dispatch before 22:30 UTC finishes before 00:00 UTC; the runner also re-reads the day before each file.
m=$(( 10#$(date -u +%H) * 60 + 10#$(date -u +%M) ))
if [ "$m" -ge 1350 ] || [ "$m" -lt 30 ]; then
  fail "it is $(date -u +%H:%M) UTC: no dispatch between 22:30 and 00:30 UTC (04:00-06:00 IST); rerun after 00:30 UTC"
fi
echo "ok: outside the 22:30-00:30 UTC window ($(date -u +%H:%M) UTC)"

if [ "$mode" = guard ]; then
  case "${DATABASE_URL-}" in file:*) echo "ok: DATABASE_URL has the file: prefix" ;; *) fail "DATABASE_URL must start with file: (set it on this job)" ;; esac
  # X3 (Imu): the onboarding avatar testIDs of slot 14a must be in the checked-out content (a shallow checkout may lack history, so content, not ancestry)
  [ -f apps/mobile/app/onboarding.tsx ] || fail "apps/mobile/app/onboarding.tsx not found"
  grep -qF 'testID={`avatar-${i}`}' apps/mobile/app/onboarding.tsx || fail "apps/mobile/app/onboarding.tsx lacks the avatar testID testID={\`avatar-\${i}\`} (slot 14a, Frenkie): finish-onboarding taps id avatar-0"
  echo "ok: onboarding.tsx has the avatar-\${i} testID"
  # The workflow must not set EXPO_PUBLIC_QA_SIM in any job env: only the eas.json qa-sim profile may (see qa-sim-env-names.sh)
  if [ -d .eas/workflows ] && grep -Eq '^[[:space:]]*EXPO_PUBLIC_QA_SIM[[:space:]]*:' .eas/workflows/*.y*ml 2>/dev/null; then fail ".eas/workflows sets EXPO_PUBLIC_QA_SIM in a job env (only the eas.json qa-sim profile may)"; fi
  # EXPO_PUBLIC_QA_SIM is allowed ONLY in the qa-sim profile of apps/mobile/eas.json
  node -e '
    const fs=require("fs");const j=JSON.parse(fs.readFileSync("apps/mobile/eas.json","utf8"));
    const bad=[];const walk=(o,p)=>{if(o&&typeof o==="object")for(const k of Object.keys(o)){if(k==="EXPO_PUBLIC_QA_SIM")bad.push(p);walk(o[k],p)}};
    const profs=j.build||{};
    for(const name of Object.keys(profs)){ if(name!=="qa-sim") walk(profs[name],name); }
    if(!profs["qa-sim"]){console.error("no qa-sim profile in eas.json");process.exit(1)}
    if(bad.length){console.error("EXPO_PUBLIC_QA_SIM is set in profile(s): "+[...new Set(bad)].join(", "));process.exit(1)}
    console.log("ok: EXPO_PUBLIC_QA_SIM appears only in the qa-sim profile (checked: "+Object.keys(profs).filter(n=>n!=="qa-sim").join(", ")+")");
  ' || fail "eas.json profile check failed"
fi
echo "qa-sim preflight $mode: all checks passed"
