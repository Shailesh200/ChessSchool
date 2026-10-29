#!/usr/bin/env bash
# DRAFT. One shell, one worker (linux-medium-nested-virtualization): emulator boots IN PARALLEL with the
# server build, then the units run. qa-sim only. Never prints a secret (no set -x, no env dump).
set -uo pipefail
APK="${1:?apk path}"
ROOT="$(git rev-parse --show-toplevel)" && cd "$ROOT" || exit 1
OUT="qa-sim-artifacts"; mkdir -p "$OUT"
SERVER_PID=""; ACC_ENV=""
# ONE exit trap (R4/R6): stop the server's whole process group, scrub this run's passwords out of the artifacts, delete the accounts file (the final sweep deletes it again as its last action).
cleanup() {
  local ec=$? swept=0
  if [ -n "$SERVER_PID" ]; then kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null; fi
  if [ -n "$ACC_ENV" ] && [ -s "$ACC_ENV" ]; then python3 scripts/qa-sim-scrub.py "$ACC_ENV" "$OUT" >>"$OUT/scrub.log" 2>&1 || echo "[qa-sim] WARNING: password scrub reported a problem (see scrub.log); do not trust the artifacts" >&2; fi
  [ -n "$ACC_ENV" ] && rm -f "$ACC_ENV"
  rm -f "$OUT/.emu.rc" "$OUT/.emu.why"
  # final image sweep (also reached on SIGTERM, when qa-sim-maestro.sh was killed mid-unit): deletes every image/video and symlink outside the non-secret units'
  # folders, writes the __final-purge__ FAIL marker and makes the job fail. SIGKILL cannot run this trap: the workflow's always() sweep step covers that.
  bash scripts/qa-sim-final-sweep.sh >>"$OUT/final-sweep.log" 2>&1 || swept=1
  [ "$swept" -ne 0 ] && [ "$ec" -eq 0 ] && exit 1   # the sweep found something after an exit 0: never green
  true
}
trap cleanup EXIT

# manifest rows as FAIL: used when the whole run cannot happen
fail_all() { : >"$OUT/results.tsv"; while IFS=$'\t' read -r u _; do case "$u" in ''|\#*) ;; *) printf '%s\tFAIL\t%s\n' "$u" "$1" >>"$OUT/results.tsv";; esac; done <parity/maestro/flows/qa/manifest.tsv; }

# ---- (1) FIRST, before anything is installed or downloaded: environment: STOP (do not quietly unset) if the job env has a name that could point at a real database, deployment or
# production build. The names list goes to the artifacts. Unsetting below is only an extra safety step after this check passed. ----
if ! bash scripts/qa-sim-env-names.sh e2e >"$OUT/env-names.txt" 2>"$OUT/env-names.err"; then
  why="forbidden environment variable name(s) in the e2e job: $(sed -n 's/^  - //p' "$OUT/env-names.err" | tr '\n' ' ')"
  cat "$OUT/env-names.err" >&2; fail_all "env: $why"; exit 1
fi
# ---- R5: tools the runner needs, checked before anything is booted ----
# v9: qa-sim-maestro.sh runs the flow guard with the venv's python (PyYAML lives only there). Unset or not executable: stop now, before anything is booted.
if [ -z "${QA_SIM_PY:-}" ] || [ ! -x "${QA_SIM_PY:-}" ]; then
  why="QA_SIM_PY is unset or not an executable file: the venv step did not run, so the flow guard cannot run"
  echo "[qa-sim] $why" >&2; fail_all "tooling: $why"; exit 1
fi
if ! command -v maestro >/dev/null 2>&1; then
  echo "[qa-sim] maestro not on PATH: installing the pinned CLI" | tee -a "$OUT/tools.log"
  curl -fsSL "https://get.maestro.mobile.dev" 2>>"$OUT/tools.log" | MAESTRO_VERSION="${QA_MAESTRO_VERSION:-2.0.2}" bash >>"$OUT/tools.log" 2>&1 || true
  export PATH="$HOME/.maestro/bin:$PATH"
fi
jmaj="$(java -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p')"
if ! command -v maestro >/dev/null 2>&1 || [ "${jmaj:-0}" -lt 17 ]; then
  why="maestro CLI missing (have: $(command -v maestro || echo no)) or java < 17 (have: ${jmaj:-none})"
  echo "[qa-sim] $why" >&2; fail_all "tooling: $why"; exit 1
fi
echo "[qa-sim] tools ok: maestro present, java $jmaj" | tee -a "$OUT/tools.log"

unset_names=""
for n in $(compgen -e | grep -E '^(TURSO_|VERCEL)' || true) DATABASE_AUTH_TOKEN QA_SIM; do
  if [ -n "${!n+x}" ]; then unset "$n"; unset_names="$unset_names $n"; fi   # names only, never values
done
echo "[qa-sim] unset variables (names only):${unset_names:- none}"
export DATABASE_URL="file:local.db"       # qa-sim-web.sh refuses anything else
bash scripts/qa-sim-guard.sh || { echo "guard refused"; exit 1; }
# QA_SIM=1 is NOT exported here: qa-sim-web.sh sets it inline on the `next start` line only (server-only, never EXPO_PUBLIC_).

# ---- emulator: find or install the SDK pieces, then boot in the background ----
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
SDKM="$(command -v sdkmanager || true)"; [ -z "$SDKM" ] && [ -n "$SDK_ROOT" ] && SDKM="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
AVDM="$(command -v avdmanager || true)"; [ -z "$AVDM" ] && [ -n "$SDK_ROOT" ] && AVDM="$SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
IMG="${QA_SIM_SYSIMG:-system-images;android-35;default;x86_64}"   # x86_64 only (docs), example from the Maestro job docs
EMU_OK=0; EMU_WHY=""
boot_emulator() {
  [ -n "$SDK_ROOT" ] || { EMU_WHY="no ANDROID_SDK_ROOT/ANDROID_HOME on the image"; return 1; }
  [ -x "$SDKM" ] || { EMU_WHY="sdkmanager not found"; return 1; }
  # Docs do not say the image ships the emulator or a system image: install only what is missing.
  [ -x "$SDK_ROOT/emulator/emulator" ] || { yes | "$SDKM" --licenses >/dev/null 2>&1; "$SDKM" "emulator" >>"$OUT/sdk.log" 2>&1 || { EMU_WHY="sdkmanager emulator failed"; return 1; }; }
  [ -x "$SDK_ROOT/platform-tools/adb" ] || "$SDKM" "platform-tools" >>"$OUT/sdk.log" 2>&1
  [ -d "$SDK_ROOT/${IMG//;//}" ] || { yes | "$SDKM" --licenses >/dev/null 2>&1; "$SDKM" "$IMG" >>"$OUT/sdk.log" 2>&1 || { EMU_WHY="sdkmanager $IMG failed"; return 1; }; }
  echo no | "$AVDM" create avd -n qa -k "$IMG" -d pixel_6 --force >>"$OUT/sdk.log" 2>&1 || { EMU_WHY="avdmanager create failed"; return 1; }
  export PATH="$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$PATH"
  nohup emulator -avd qa -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel on >"$OUT/emulator.log" 2>&1 &
  timeout 300 adb wait-for-device || { EMU_WHY="adb wait-for-device timed out after 300 s"; return 1; }
  for _ in $(seq 1 90); do [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && return 0; sleep 4; done
  EMU_WHY="emulator did not finish booting in 6 minutes"; return 1
}
# The server and the app key progress by UTC day: put the emulator in UTC (best effort here, verified by the require-utc step).
set_utc() {
  adb root >/dev/null 2>&1; sleep 2
  adb shell setprop persist.sys.timezone UTC >/dev/null 2>&1
  adb shell "service call alarm 3 s16 UTC" >/dev/null 2>&1 || adb shell "cmd alarm set-timezone UTC" >/dev/null 2>&1
  echo "[qa-sim] emulator zone offset now: $(adb shell date +%z | tr -d '\r'); UTC date $(adb shell date -u +%Y-%m-%d | tr -d '\r')" | tee -a "$OUT/tools.log"
}
( boot_emulator; echo "$?" >"$OUT/.emu.rc"; echo "$EMU_WHY" >"$OUT/.emu.why" ) &
EMU_PID=$!

# ---- server: install, provision, build, start, wait. 15 min cap for all of it; the readiness wait inside
# qa-sim-web.sh is 90 x 2 s = 3 minutes after `next start`. ----
SERVER_OK=0; SERVER_REASON="server did not start"; SERVER_VERDICT=FAIL
# ---- APK pre-flight (final proof for Jimbe's slot 14): decode the APK's manifest AND the referenced network security config.
# PASS only if android:networkSecurityConfig is set, usesCleartextTraffic is not true, and the config allows cleartext ONLY for
# 10.0.2.2 and localhost (no base-config cleartext, no <debug-overrides>). Any other result fails every server unit and the server is NOT started.
# Report: $OUT/apk-preflight.txt and apk-preflight.json.
APK_CHECK="${QA_SIM_APK_CHECK:-scripts/qa-sim-apk-check.py}"
APK_RES="$(python3 "$APK_CHECK" "$APK" "$OUT/apk-preflight" 2>>"$OUT/apk-preflight.err")" || true
APK_NSC="$(printf '%s\n' "$APK_RES" | sed -n 's/^RESULT=//p' | head -1)"; APK_WHY="$(printf '%s\n' "$APK_RES" | sed -n 's/^REASON=//p' | head -1)"
[ -n "$APK_NSC" ] || { APK_NSC=UNREADABLE; APK_WHY="APK pre-flight could not run (see apk-preflight.err): the qa-sim network security config is unproven"; printf 'result: UNREADABLE\nreason: %s\n' "$APK_WHY" >"$OUT/apk-preflight.txt"; }
echo "[qa-sim] APK network security pre-flight: $APK_NSC - $APK_WHY"
if [ "$APK_NSC" = PASS ]; then
  if timeout 900 bash scripts/qa-sim-web.sh >"$OUT/web-start.log" 2>&1; then
    SERVER_OK=1
  else
    rc=$?
    SERVER_REASON="qa-sim-web.sh failed (exit $rc): $(tail -n 3 "$OUT/web-start.log" | tr '\n' ' ' | cut -c1-200)"
  fi
else
  SERVER_VERDICT=FAIL; SERVER_REASON="$APK_WHY"   # server NOT started; the no-server units still run
fi
SERVER_PID="$(cat "$OUT/next.pid" 2>/dev/null || true)"   # cleanup() (the single EXIT trap) kills its process group
if [ "$SERVER_OK" = 1 ]; then
  # live proof from the running server: no TURSO_*, file: DB (counts and a prefix only)
  if [ ! -r "/proc/$SERVER_PID/environ" ]; then
    echo "[qa-sim] LOUD: cannot read /proc/$SERVER_PID/environ: the no-TURSO/file: DB proof is impossible, so the server is NOT trusted" | tee -a "$OUT/web-start.log" >&2
    SERVER_OK=0; SERVER_REASON="could not read the server's environment to prove file: DB and no TURSO_* (/proc/PID/environ unreadable)"
  else
    PENV="$(tr '\0' '\n' <"/proc/$SERVER_PID/environ")"
    nt="$(printf '%s\n' "$PENV" | grep -c '^TURSO_' || true)"
    dbp="$(printf '%s\n' "$PENV" | sed -n 's/^DATABASE_URL=\(file:\).*/\1/p' | head -1)"
    echo "[qa-sim] server env proof: TURSO_* vars=$nt, DATABASE_URL prefix=${dbp:-none}" | tee -a "$OUT/web-start.log"
    if [ "$nt" != 0 ] || [ "$dbp" != "file:" ]; then SERVER_OK=0; SERVER_REASON="server env proof failed"; fi
  fi
fi

# ---- accounts: fresh every run, random passwords, 0600 file outside the repo and the artifact dir ----
# A FIXED path (not a random name) so that the workflow's always() sweep step can still scrub the artifacts and delete the file after a SIGKILL, when this trap cannot run.
# Created safely (scripts/qa-sim-accounts.sh): the path must resolve outside the repo and outside $OUT, a symlink or a file that is not ours is REFUSED, and the file is a
# `mktemp` (0600) in the same directory moved atomically over the path. A refusal fails every unit and ends the run (the sweep deletes whatever sits at the path).
ACC_PATH="${TMPDIR:-/tmp}/qa-sim-accounts.env"
# shellcheck source=qa-sim-accounts.sh
. "$ROOT/scripts/qa-sim-accounts.sh" || { echo "[qa-sim] scripts/qa-sim-accounts.sh cannot be loaded" >&2; fail_all "accounts: scripts/qa-sim-accounts.sh cannot be loaded"; exit 1; }
if ! qa_acc_create "$ACC_PATH" "$ROOT" "$OUT"; then
  echo "[qa-sim] accounts file refused: $QA_ACC_WHY" >&2; fail_all "accounts file refused: $QA_ACC_WHY"; exit 1
fi
ACC_ENV="$ACC_PATH"   # from here on the single EXIT trap scrubs with it and removes it
if [ "$SERVER_OK" = 1 ] && ! python3 scripts/qa-sim-api.py provision "$ACC_ENV" >>"$OUT/web-start.log" 2>&1; then
  SERVER_OK=0; SERVER_REASON="could not register the fresh test accounts on the server"
fi

# ---- device ----
wait "$EMU_PID" 2>/dev/null
if [ "$(cat "$OUT/.emu.rc" 2>/dev/null)" != 0 ]; then
  echo "[qa-sim] emulator unavailable: $(cat "$OUT/.emu.why")" >&2
  # no device = nothing can run: every unit is a FAIL, not a skip
  fail_all "emulator unavailable: $(cat "$OUT/.emu.why")"
  exit 1
fi
export PATH="$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$PATH"
DEVICE="$(adb devices | awk '/emulator-[0-9]+\tdevice/ {print $1; exit}')"
set_utc
adb -s "$DEVICE" install -r "$APK" >"$OUT/install.log" 2>&1 || { echo "apk install failed" >&2; exit 1; }
adb -s "$DEVICE" shell settings put global window_animation_scale 0
adb -s "$DEVICE" shell settings put global transition_animation_scale 0
adb -s "$DEVICE" shell settings put global animator_duration_scale 0

QA_DEVICE="$DEVICE" QA_SERVER_OK="$SERVER_OK" QA_SERVER_REASON="$SERVER_REASON" QA_SERVER_VERDICT="$SERVER_VERDICT" QA_ACCOUNTS_ENV="$ACC_ENV" \
  bash scripts/qa-sim-maestro.sh
rc=$?
exit "$rc"   # cleanup() runs now: server group killed, passwords scrubbed from $OUT, accounts file removed
