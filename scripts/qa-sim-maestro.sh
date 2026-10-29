#!/usr/bin/env bash
# DRAFT. Runs the units in parity/maestro/flows/qa/manifest.tsv, one at a time, NO retries anywhere.
# Inputs (env): QA_DEVICE (adb serial), QA_SERVER_OK (1|0), QA_SERVER_REASON, QA_ACCOUNTS_ENV (0600 file, outside the artifact dir),
#   (QA_SERVER_VERDICT is ignored: a qa-sim server that is not up ALWAYS makes the server-dependent units FAIL, never SKIPPED; Arc's final rule)
# Output: qa-sim-artifacts/ (repo root)/results.tsv + results.md + results.json (PASS|FAIL|SKIPPED per unit, with reason).
# secret units (manifest column 4 = yes, i.e. the flows type a MAESTRO_*_PASSWORD value; anything other than `no` counts as secret): run WITHOUT --test-output-dir, with
#   maestro's cwd in a fresh scratch folder (all paths passed to maestro are absolute realpaths), and
#   every image/video file under the unit's Maestro debug dir and scratch cwd is deleted right after the unit (scripts/qa-sim-purge-images.py), before the e2e script's password scrub;
#   any file left = that unit FAIL. At the end of the run (before the artifact check and upload) a final sweep over the whole qa-sim-artifacts/ deletes every
#   image/video (by content and extension) outside the non-secret units' folders and FAILs the run (__final-purge__) if there was any. scripts/qa-sim-flow-guard.py runs first: if it fails, every unit is FAIL (a flow with a password var must be flagged secret,
#   and no flagged flow, nor a _common flow it runs, may contain takeScreenshot or startRecording).
# Exit: 0 all PASS, 1 any FAIL, 2 no FAIL but some SKIPPED (only logout-isolation-2 when logout-1 did not PASS). A SKIPPED unit is never a PASS.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)" && cd "$ROOT" || exit 1
FLOWS="parity/maestro/flows/qa"; OUT="qa-sim-artifacts"
mkdir -p "$OUT/junit" "$OUT/maestro"
DEV="${QA_DEVICE:?}"; SERVER_OK="${QA_SERVER_OK:?}"; SERVER_REASON="${QA_SERVER_REASON:-server not up}"; SERVER_VERDICT=FAIL   # server not up = the server units FAIL (INCOMPLETE, exit 1); the no-server units still run
API="${QA_SIM_API_PY:-scripts/qa-sim-api.py}"; TAP="scripts/qa-sim-ui-tap.py"
RES="$OUT/results.tsv"; : >"$RES"
GUARD_FAIL=""
# v9: the flow guard needs PyYAML, which is installed only in the workflow's venv: QA_SIM_PY is that venv's python (set by the workflow with set-env). Never a bare python3.
# Unset or not executable = loud (stderr) and every unit FAIL (the run is INCOMPLETE, exit 1), never a silent fallback to the system python.
PYBIN="${QA_SIM_PY:-}"
if [ -z "$PYBIN" ] || [ ! -x "$PYBIN" ]; then
  GUARD_FAIL="QA_SIM_PY is unset or not an executable file: the flow guard cannot run (the venv step did not run)"
  echo "[qa-sim] FAIL: $GUARD_FAIL" >&2; echo "$GUARD_FAIL" >"$OUT/flow-guard.log"
elif ! "$PYBIN" scripts/qa-sim-flow-guard.py --flows "$FLOWS" >"$OUT/flow-guard.log" 2>&1; then
  GUARD_FAIL="flow guard failed: $(grep -m1 'GUARD FAIL' "$OUT/flow-guard.log" | cut -c1-300) (see flow-guard.log)"
fi
adbx() { adb -s "$DEV" "$@"; }
SCRATCH="$(mktemp -d)"; trap 'rm -rf "$SCRATCH"' EXIT   # baselines etc. never in the artifact dir

if [ "$SERVER_OK" = 1 ]; then
  # shellcheck disable=SC1090
  set -a; . "$QA_ACCOUNTS_ENV"; set +a
fi

record() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$RES"; echo "[qa-sim] $1: $2 $3"; }

# run one flow file; extra args are -e KEY=VAL pairs (never passwords: those go in MAESTRO_*_PASSWORD shell variables,
# exported per unit by unit_env, so they are not in the maestro command line / ps). Returns the maestro exit code. No --retry.
# Every path handed to maestro is absolute (realpath, loud failure), because a secret unit runs maestro with its cwd in a fresh mktemp -d folder:
# a takeScreenshot without --test-output-dir writes <name>.png relative to the JVM cwd, which must never be the repo root (or anything uploaded).
run_flow() {
  local unit="$1" file="$2"; shift 2
  local label="${unit}-${file%.yaml}" tod=() dbg junit flow cwd="" log
  log="$OUT/maestro/$label.log"
  mkdir -p "$OUT/maestro/$label" "$OUT/junit"
  dbg="$(realpath -e "$OUT/maestro/$label")" && junit="$(realpath -e "$OUT/junit")/$label.xml" && flow="$(realpath -e "$FLOWS/$file")" \
    || { echo "[qa-sim] cannot resolve an absolute path for $label (debug dir, junit dir or flow file)" >"$log"; echo "[qa-sim] cannot resolve an absolute path for $label" >&2; return 1; }
  UNIT_DIRS+=("$dbg")
  if [ "$SECRET" = no ]; then
    # no password typed: keep screenshots. takeScreenshot output goes to <dir>/screenshots/
    mkdir -p "$dbg/screens" && tod=(--test-output-dir "$(realpath -e "$dbg/screens")") || return 1
  else
    # secret unit: no --test-output-dir; maestro's cwd is a fresh scratch folder (inside the mktemp -d SCRATCH, removed after the unit);
    # the debug dir can still hold Maestro's failure screenshots. Both are purged after the unit, before the scrub.
    cwd="$(mktemp -d "$SCRATCH/cwd.XXXXXX")" && cwd="$(realpath -e "$cwd")" || { echo "[qa-sim] cannot create the scratch cwd for $label" >"$log"; return 1; }
    UNIT_DIRS+=("$cwd"); TMP_CWDS+=("$cwd")
  fi
  (
    [ -z "$cwd" ] || cd "$cwd" || exit 1
    exec maestro --device "$DEV" test --format junit --output "$junit" \
      --debug-output "$dbg" ${tod[@]+"${tod[@]}"} \
      "$@" "$flow"
  ) >"$log" 2>&1
}

net_off() {
  adbx shell cmd connectivity airplane-mode enable >/dev/null 2>&1 || adbx shell settings put global airplane_mode_on 1
  adbx shell svc wifi disable >/dev/null 2>&1; adbx shell svc data disable >/dev/null 2>&1; sleep 3
  if adbx shell ping -c 1 -W 3 10.0.2.2 >/dev/null 2>&1; then echo "host still reachable" >&2; return 1; fi
}
net_on() {
  adbx shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || adbx shell settings put global airplane_mode_on 0
  adbx shell svc wifi enable >/dev/null 2>&1; adbx shell svc data enable >/dev/null 2>&1
  for _ in $(seq 1 30); do adbx shell ping -c 1 -W 2 10.0.2.2 >/dev/null 2>&1 && return 0; sleep 2; done
  echo "host not reachable after 60s" >&2; return 1
}

LI_A_XP=40   # lesson XP seeded for A (below the 50 goal, so the card shows 40/50 XP)
LI_DAY=""
# per-unit account mapping (values live only in the 0600 env file)
unit_env() {  # sets UE (array of -e args, no secrets), exports MAESTRO_*_PASSWORD for this unit, and ACC_E / ACC_P (variable NAMES for qa-sim-api.py)
  UE=(); ACC_E=""; ACC_P=""
  unset MAESTRO_E2E_PASSWORD MAESTRO_A_PASSWORD MAESTRO_B_PASSWORD
  case "$1" in
    m10-*) UE=(-e "E2E_EMAIL=$M10_EMAIL"); export MAESTRO_E2E_PASSWORD="$M10_PASSWORD"; ACC_E=M10_EMAIL; ACC_P=M10_PASSWORD ;;
    m11-*) UE=(-e "E2E_EMAIL=$M11_EMAIL"); export MAESTRO_E2E_PASSWORD="$M11_PASSWORD"; ACC_E=M11_EMAIL; ACC_P=M11_PASSWORD ;;
    m50-*) UE=(-e "E2E_EMAIL=$M50_EMAIL"); export MAESTRO_E2E_PASSWORD="$M50_PASSWORD" ;;
    m51-*) UE=(-e "E2E_SIGNUP_EMAIL=$S_EMAIL" -e "E2E_NAME=QA Signup"); export MAESTRO_E2E_PASSWORD="$S_PASSWORD" ;;
    logout-isolation-*)
      # A_XP: lesson XP seeded for A through the API. B_XP: B's own XP today as the API reports it (read after snapshot-b).
      UE=(-e "A_EMAIL=$A_EMAIL" -e "B_EMAIL=$B_EMAIL" -e "A_XP=$LI_A_XP")
      export MAESTRO_A_PASSWORD="$A_PASSWORD" MAESTRO_B_PASSWORD="$B_PASSWORD"
      if [ -s "$SCRATCH/b.base.json" ]; then UE+=(-e "B_XP=$(python3 "$API" get "$SCRATCH/b.base.json" today_xp)"); fi ;;
  esac
  return 0
}

# Independent verification (does not use scripts/qa-sim-purge-images.py): prints every image/video file (extension OR magic bytes) under the ROOT dirs
# that is not under an allowed dir.   media_left ROOT... [-- ALLOWDIR...]
media_left() {
  python3 - "$@" <<'PY'
import os, sys
a = sys.argv[1:]; roots = a[:a.index("--")] if "--" in a else a; allow = [os.path.realpath(x) for x in a[a.index("--") + 1:]] if "--" in a else []
EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic", ".heif", ".tif", ".tiff", ".svg", ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp")
def media(p):
    if p.lower().endswith(EXT): return True
    try: h = open(p, "rb").read(16)
    except OSError: return False
    return (h.startswith(b"\x89PNG") or h.startswith(b"\xff\xd8\xff") or h[:3] == b"GIF" or h[:2] == b"BM" or h[:4] in (b"II*\x00", b"MM\x00*")
            or (h[:4] == b"RIFF" and h[8:12] in (b"WEBP", b"AVI ")) or h[4:8] == b"ftyp" or h[:4] == b"\x1a\x45\xdf\xa3")
for r in roots:
    for d, _, fs in os.walk(r):
        for f in fs:
            p = os.path.join(d, f); rp = os.path.realpath(p)
            if media(p) and not any(rp == x or rp.startswith(x + os.sep) for x in allow): print(p)
PY
}

device_day() { adbx shell date -u +%Y-%m-%d 2>/dev/null | tr -d '\r'; }   # the emulator runs in UTC (set by the e2e script, checked by require-utc)

run_unit() {
  local unit="$1" need="$2" steps="$3"
  SECRET="${4:-yes}"; [ "$SECRET" = no ] || SECRET=yes; UNIT_DIRS=(); TMP_CWDS=()   # fail closed: only an explicit `no` keeps screenshots
  if [ "$need" = yes ] && [ "$SERVER_OK" != 1 ]; then
    if [ "$SERVER_VERDICT" = FAIL ]; then record "$unit" FAIL "$SERVER_REASON"; else record "$unit" SKIPPED "needs the qa-sim server: $SERVER_REASON"; fi
    return
  fi
  UE=(); ACC_E=""; ACC_P=""
  if [ "$need" = yes ]; then unit_env "$unit"; fi
  local part reason="" parts purge_rc left
  IFS='>' read -r -a parts <<<"$steps"
  for part in "${parts[@]}"; do
    case "$part" in
      require:*) if ! grep -q "^${part#require:}"$'\t'PASS$'\t' "$RES"; then record "$unit" SKIPPED "needs ${part#require:} to have passed (the app state it leaves is this unit's start state)"; return; fi ;;
      require-utc) [ "$(adbx shell date +%z | tr -d '\r')" = "+0000" ] || { reason="emulator time zone is not UTC (the day keys would not line up with the server)"; break; } ;;
      a-earn-xp)
        LI_DAY="$(device_day)"
        [[ "$LI_DAY" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { reason="could not read the device date"; break; }
        python3 "$API" earn-xp A_EMAIL A_PASSWORD "$LI_DAY" "$LI_A_XP" >>"$OUT/api-assert.log" 2>&1 || { reason="could not seed A's lesson XP: $(tail -n 1 "$OUT/api-assert.log")"; break; } ;;
      snapshot-b) python3 "$API" snapshot B_EMAIL B_PASSWORD "$SCRATCH/b.base.json" "$LI_DAY" >>"$OUT/api-assert.log" 2>&1 || { reason="could not read B's baseline from the server"; break; } ;;
      expire-a) python3 "$API" expire A_EMAIL A_PASSWORD >>"$OUT/api-assert.log" 2>&1 || { reason="could not expire A's session (POST /api/qa/expire-session): $(tail -n 1 "$OUT/api-assert.log")"; break; } ;;
      assert-isolation:*) python3 "$API" assert-isolation B_EMAIL B_PASSWORD "$SCRATCH/b.base.json" A_EMAIL A_PASSWORD "$LI_A_XP" "${part#assert-isolation:}" >>"$OUT/api-assert.log" 2>&1 || { reason="server-side isolation check failed (see api-assert.log)"; break; } ;;
      *.yaml) if [ "$need" = yes ]; then unit_env "$unit"; fi
        # day keys: re-read the (UTC) day before each logout-isolation file; a rollover since the seed is a FAIL, never a pass
        if [[ "$unit" == logout-isolation-* ]] && [ "$(device_day)" != "$LI_DAY" ]; then reason="day rolled over during the run (seeded for ${LI_DAY:-?}, now $(device_day)); rerun after 00:30 UTC"; break; fi
        run_flow "$unit" "$part" "${UE[@]}" || { reason="flow $part failed (see maestro/${unit}-${part%.yaml}.log)"; break; } ;;
      tap-promo-n) python3 "$TAP" --device "$DEV" promo n >>"$OUT/ui_tap.log" 2>&1 || { reason="could not tap the knight button"; break; } ;;
      tap-promo-q) python3 "$TAP" --device "$DEV" promo q >>"$OUT/ui_tap.log" 2>&1 || { reason="could not tap the queen button"; break; } ;;
      net-off) net_off >>"$OUT/net.log" 2>&1 || { reason="could not put the emulator offline, offline test invalid"; break; } ;;
      net-on) net_on >>"$OUT/net.log" 2>&1 || { reason="network did not come back"; break; } ;;
      assert-xp+10) python3 "$API" assert-xp "$ACC_E" "$ACC_P" "$SCRATCH/$unit.base.json" 10 >>"$OUT/api-assert.log" 2>&1 || { reason="server-side check failed (see api-assert.log)"; break; } ;;
      *) reason="unknown manifest step '$part'"; break ;;
    esac
    # baseline is taken right before the first flow of a unit that asserts XP
  done
  # secret unit: delete every image/video the debug dir holds NOW (before the e2e script's scrub), then prove none remain
  if [ "$SECRET" = yes ] && [ "${#UNIT_DIRS[@]}" -gt 0 ]; then
    # content based (magic bytes AND extension): the purge deletes, then an independent scan (media_left) must find nothing; no extension-only find anywhere
    python3 scripts/qa-sim-purge-images.py "${UNIT_DIRS[@]}" >>"$OUT/purge.log" 2>&1; purge_rc=$?
    left="$(media_left "${UNIT_DIRS[@]}")"
    if [ "$purge_rc" -ne 0 ] || [ -n "$left" ]; then
      reason="image/video files remained under the secret unit's debug dir or scratch cwd after the purge (see purge.log)${reason:+; $reason}"
      # best effort so they are not uploaded either (the unit stays FAIL)
      python3 scripts/qa-sim-purge-images.py "${UNIT_DIRS[@]}" >>"$OUT/purge.log" 2>&1 || true
    fi
  fi
  # remove only the scratch cwd folders this unit created (after the purge and the re-scan above)
  for d in ${TMP_CWDS[@]+"${TMP_CWDS[@]}"}; do [ -n "$d" ] && [ -d "$d" ] && rm -rf -- "$d"; done
  if [ -n "$reason" ]; then record "$unit" FAIL "$reason"; else record "$unit" PASS ""; fi
  # a failed part can leave airplane mode on: always restore before the next unit
  net_on >>"$OUT/net.log" 2>&1 || true
}

while IFS=$'\t' read -r unit need steps secret desc; do
  case "$unit" in ''|\#*) continue ;; esac
  if [ -n "$GUARD_FAIL" ]; then record "$unit" FAIL "$GUARD_FAIL"; continue; fi
  if [ "$need" = yes ] && [ "$SERVER_OK" = 1 ] && [[ "$steps" == *assert-xp* ]]; then
    unit_env "$unit"
    python3 "$API" progress "$ACC_E" "$ACC_P" "$SCRATCH/$unit.base.json" >>"$OUT/api-assert.log" 2>&1 \
      || { record "$unit" FAIL "could not read the baseline from the server"; continue; }
  fi
  run_unit "$unit" "$need" "$steps" "$secret"
done <"$FLOWS/manifest.tsv"

# ---- the recorded units must be exactly the manifest's units (an empty manifest, a typo or a skipped row is a FAIL) ----
expected="$(awk -F'\t' '!/^#/ && NF>=3 && $1!="" {print $1}' "$FLOWS/manifest.tsv" | sort)"
recorded="$(awk -F'\t' 'NF>=2 && $1!="" {print $1}' "$RES" | sort)"
if [ -z "$expected" ]; then record "__manifest__" FAIL "the manifest has no units"
elif [ -n "$(printf '%s\n' "$expected" | uniq -d)" ]; then record "__manifest__" FAIL "the manifest lists a unit twice"
elif [ "$expected" != "$recorded" ]; then record "__manifest__" FAIL "recorded units differ from the manifest (missing or duplicated rows)"; fi

# ---- final purge: whole repo-root qa-sim-artifacts/, after all units, before the artifact check and the upload ----
# Every image/video (by content as well as by extension) outside the non-secret units' own Maestro folders is deleted and FAILs the run: a secret unit's
# image can then not reach the upload even if a per-unit purge missed it or it was written somewhere else. Non-secret units keep their images.
ALLOW=()
while IFS=$'\t' read -r unit need steps secret desc; do
  case "$unit" in ''|\#*) continue ;; esac
  [ "$secret" = no ] || continue
  IFS='>' read -r -a parts <<<"$steps"
  for part in "${parts[@]}"; do case "$part" in *.yaml) [ -d "$OUT/maestro/${unit}-${part%.yaml}" ] && ALLOW+=("$OUT/maestro/${unit}-${part%.yaml}") ;; esac; done
done <"$FLOWS/manifest.tsv"
python3 scripts/qa-sim-purge-images.py --sweep "$OUT" ${ALLOW[@]+--allow "${ALLOW[@]}"} >"$OUT/purge-final.log" 2>&1; sweep_rc=$?
final_left="$(media_left "$OUT" ${ALLOW[@]+-- "${ALLOW[@]}"})"
if [ "$sweep_rc" -ne 0 ] || [ -n "$final_left" ]; then
  record "__final-purge__" FAIL "image/video file(s) found outside the non-secret units' folders in $OUT after all units (deleted or not, see purge-final.log); the run is INCOMPLETE"
fi

# ---- summary ----
python3 - "$RES" "$OUT" <<'PY'
import sys, json, collections
res, out = sys.argv[1], sys.argv[2]
rows = [l.rstrip("\n").split("\t") for l in open(res)]
rows = [(r + ["", ""])[:3] for r in rows]
cnt = collections.Counter(r[1] for r in rows)
with open(out + "/results.md", "w") as f:
    f.write("# qa-sim Android results\n\n| unit | result | reason |\n|---|---|---|\n")
    for u, s, why in rows: f.write(f"| {u} | {s} | {why} |\n")
    f.write(f"\nPASS {cnt['PASS']}, FAIL {cnt['FAIL']}, SKIPPED {cnt['SKIPPED']}. SKIPPED is not a pass.\n")
    # verdict: the run passes only if EVERY unit passed. A SKIPPED or FAILED unit makes the whole run INCOMPLETE (never green).
    bad = [u for u, s, _ in rows if s != "PASS"]
    verdict = "PASS" if rows and not bad else "INCOMPLETE"
    f.write(f"\n**RUN VERDICT: {verdict}**" + (f" ({len(bad)} unit(s) not PASS: {', '.join(bad)}; the e2e job exits non-zero)" if bad else "") + "\n")
json.dump({"verdict": verdict, "not_pass": bad, "units": [{"unit": u, "result": s, "reason": why} for u, s, why in rows], "counts": dict(cnt)}, open(out + "/results.json", "w"), indent=1)
print(open(out + "/results.md").read())
PY
fails=$(grep -c $'\tFAIL\t' "$RES" || true); skips=$(grep -c $'\tSKIPPED\t' "$RES" || true)
# any FAIL (exit 1) or SKIPPED (exit 2) unit = INCOMPLETE and a non-zero exit; the e2e job passes this code on unchanged
[ "$fails" -gt 0 ] && { echo "[qa-sim] RUN VERDICT: INCOMPLETE ($fails FAIL, $skips SKIPPED)"; exit 1; }
[ "$skips" -gt 0 ] && { echo "[qa-sim] RUN VERDICT: INCOMPLETE ($skips SKIPPED, 0 FAIL): skipped is not a pass"; exit 2; }
echo "[qa-sim] RUN VERDICT: PASS (every unit PASS)"
exit 0
