#!/usr/bin/env bash
# Final image sweep over the repo-root qa-sim-artifacts/, run (a) as the workflow step `if: always()` BEFORE the artifact check and the upload, so that even
# a killed e2e step (EAS timeout, SIGKILL) cannot leave a secret unit's image in the upload, and (b) from the e2e script's cleanup() EXIT trap (SIGTERM).
#   Allowed: image/video files inside the non-secret units' own Maestro folders (manifest column 4 exactly `no`, only folders that exist).
#   Everything else under qa-sim-artifacts/ that is an image/video (content or extension) or a symlink is DELETED, and that is a FAIL: a `__final-purge__` FAIL row
#   is appended to results.tsv and results.md (verdict INCOMPLETE; results.json too, best effort), INCOMPLETE.txt is written, and the exit code is 1.
#   Fallback: if the python sweep cannot be trusted (missing python, a crash, an exit code other than 0 or 1) or the manifest cannot be read, ALL media under
#   qa-sim-artifacts/ (non-secret units' included) and every symlink is deleted by plain shell (find, head, od; no python), then the same FAIL marker and exit 1.
# The accounts file `${TMPDIR:-/tmp}/qa-sim-accounts.env` (rules in scripts/qa-sim-accounts.sh): its block runs BEFORE the early exit for a missing $OUT/ (so a run killed before any
#   artifact existed still gets it deleted), the file is scrubbed into the artifacts only if it is a regular file owned by us (a symlink is refused, never read), the path must
#   resolve outside the repo and outside $OUT/ (else FAIL), and `finish` deletes it as the LAST action of EVERY path out of this script (every exit goes through `finish`).
# The python sweep's exit codes: 0 nothing found, 10 residue found and deleted, 11 something remains, anything else (a crash is 1) = fallback. Exit 0 here = nothing found. Never prints file contents, only names and counts.
set -uo pipefail
export LC_ALL=C
ACC="${TMPDIR:-/tmp}/qa-sim-accounts.env"
# `finish RC` is the ONLY way out of this script: the accounts file is deleted as the very last action (rm -f removes a symlink itself, never its target).
finish() {
  rm -f -- "$ACC" 2>/dev/null
  if [ -e "$ACC" ] || [ -L "$ACC" ]; then echo "[qa-sim-sweep] FAIL: the accounts file $ACC could not be deleted" >&2; exit 1; fi
  exit "${1:-1}"
}
trap 'finish 143' TERM; trap 'finish 130' INT; trap 'finish 129' HUP
trap 'finish "$?"' EXIT   # v9: any other way out (an unbound variable under set -u, a bash fatal) still deletes the accounts file and keeps the status
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || finish 1
TOP="$(cd "$HERE/.." && pwd)" || finish 1
cd "$TOP" || finish 1
OUT="qa-sim-artifacts"
MAN="parity/maestro/flows/qa/manifest.tsv"
# ---- the accounts file: BEFORE the early exit below, so it is handled (and deleted by finish) even when no artifacts exist ----
# After a SIGKILL the e2e script's trap never ran, so the artifacts were not scrubbed and the accounts file (a fixed path, see qa-sim-e2e-android.sh) is still there:
# scrub the artifacts with it now; finish deletes it. If that cannot be done, or the path/file is not acceptable, the run is INCOMPLETE too.
acc_bad=0; acc_why=""
if [ -r "$HERE/qa-sim-accounts.sh" ] && . "$HERE/qa-sim-accounts.sh"; then
  qa_acc_location_ok "$ACC" "$TOP" "$OUT"; loc=$?
  if [ "$loc" = 1 ]; then acc_bad=1; acc_why="$QA_ACC_WHY"; fi
else
  acc_bad=1; acc_why="scripts/qa-sim-accounts.sh is missing: the accounts file location cannot be checked"
fi
if [ "$acc_bad" = 0 ] && { [ -e "$ACC" ] || [ -L "$ACC" ]; }; then
  if [ -L "$ACC" ] || [ ! -f "$ACC" ] || [ ! -O "$ACC" ]; then
    acc_bad=1; acc_why="the accounts file path is a symlink, not a regular file, or not owned by this user: refused (not read), it is only deleted"
  elif [ -s "$ACC" ] && [ -d "$OUT" ]; then
    if command -v python3 >/dev/null 2>&1 && python3 "$HERE/qa-sim-scrub.py" "$ACC" "$OUT" >>"$OUT/scrub.log" 2>&1; then
      echo "[qa-sim-sweep] the accounts file was still present (the e2e trap did not run): artifacts scrubbed, file will be deleted"
    else
      acc_bad=1; acc_why="the password scrub of the artifacts could not be done after the e2e step was killed (the accounts file is deleted, text logs may still hold throwaway passwords)"
    fi
  fi
fi

[ -d "$OUT" ] || { echo "[qa-sim-sweep] $OUT/ does not exist: nothing to sweep"; [ "$acc_bad" = 0 ] || echo "[qa-sim-sweep] FAIL: $acc_why" >&2; finish "$acc_bad"; }
is_media_sh() {   # extension OR magic bytes (PNG, JPEG, GIF, BMP, TIFF, Matroska, WebP/AVI, ftyp), no python
  local lc hex
  lc="$(printf '%s' "$1" | tr 'A-Z' 'a-z')"
  case "$lc" in *.png|*.jpg|*.jpeg|*.webp|*.gif|*.bmp|*.heic|*.heif|*.tif|*.tiff|*.svg|*.mp4|*.mov|*.m4v|*.webm|*.mkv|*.avi|*.3gp) return 0 ;; esac
  hex="$(head -c 16 -- "$1" 2>/dev/null | od -An -v -tx1 | tr -d ' \n')"
  case "$hex" in
    89504e470d0a1a0a*|ffd8ff*|474946383761*|474946383961*|424d*|49492a00*|4d4d002a*|1a45dfa3*) return 0 ;;
    ????????66747970*) return 0 ;;
    52494646????????57454250*|52494646????????41564920*) return 0 ;;
  esac
  return 1
}

shell_wipe() {    # delete ALL symlinks and ALL media (allowed folders included) with plain shell; print what is left
  find "$OUT" -type l -exec rm -f -- {} + 2>/dev/null
  find "$OUT" -type f -print0 2>/dev/null | while IFS= read -r -d '' f; do is_media_sh "$f" && rm -f -- "$f"; done
  find "$OUT" -type l -print 2>/dev/null
  find "$OUT" -type f -print0 2>/dev/null | while IFS= read -r -d '' f; do is_media_sh "$f" && printf '%s\n' "$f"; done
}

mark_fail() {     # $1 = reason. Shell only; python only for the best-effort results.json update
  printf '__final-purge__\tFAIL\t%s\n' "$1" >>"$OUT/results.tsv"
  printf '\n| __final-purge__ | FAIL | %s |\n\n**RUN VERDICT: INCOMPLETE** (final sweep: %s; the e2e job exits non-zero)\n' "$1" "$1" >>"$OUT/results.md"
  printf 'INCOMPLETE: the final sweep of qa-sim-artifacts/ failed: %s\n' "$1" >"$OUT/INCOMPLETE.txt"
  python3 - "$OUT/results.json" "$1" 2>/dev/null <<'PY' || true
import json, sys
p, why = sys.argv[1:3]
try: d = json.load(open(p))
except Exception: d = {"units": [], "counts": {}}
d["verdict"] = "INCOMPLETE"; d.setdefault("not_pass", []).append("__final-purge__")
d.setdefault("units", []).append({"unit": "__final-purge__", "result": "FAIL", "reason": why})
json.dump(d, open(p, "w"), indent=1)
PY
  echo "[qa-sim-sweep] FAIL: $1" >&2
}

fallback() {      # $1 = why the python sweep could not be used
  local left
  left="$(shell_wipe)"
  if [ -n "$left" ]; then
    mark_fail "$1; the shell fallback could not remove everything: $(printf '%s' "$left" | head -c 300 | tr '\n' ' ')"
  else
    mark_fail "$1; the shell fallback deleted ALL image/video files and symlinks under $OUT (non-secret units' too)"
  fi
  finish 1
}

[ "$acc_bad" = 0 ] || mark_fail "$acc_why"
[ -r "$MAN" ] || fallback "the manifest $MAN cannot be read"
command -v python3 >/dev/null 2>&1 || fallback "python3 is not available"
[ -f "$HERE/qa-sim-purge-images.py" ] || fallback "scripts/qa-sim-purge-images.py is missing"

ALLOW=()
while IFS=$'\t' read -r unit need steps secret desc || [ -n "${unit:-}" ]; do
  case "$unit" in ''|\#*) continue ;; esac
  [ "$secret" = no ] || continue                        # anything other than exactly `no` counts as secret
  IFS='>' read -r -a parts <<<"$steps"
  for part in "${parts[@]}"; do
    case "$part" in *.yaml) [ -d "$OUT/maestro/${unit}-${part%.yaml}" ] && ALLOW+=("$OUT/maestro/${unit}-${part%.yaml}") ;; esac
  done
done <"$MAN"

outside_left() {  # independent shell check of the python sweep's result: media or symlinks still outside the allowed folders
  find "$OUT" -type l -print 2>/dev/null
  find "$OUT" -type f -print0 2>/dev/null | while IFS= read -r -d '' f; do
    ok=0; for d in ${ALLOW[@]+"${ALLOW[@]}"}; do case "$f" in "$d"/*) ok=1; break ;; esac; done
    [ "$ok" = 1 ] || { is_media_sh "$f" && printf '%s\n' "$f"; }
  done
}

python3 "$HERE/qa-sim-purge-images.py" --sweep "$OUT" ${ALLOW[@]+--allow "${ALLOW[@]}"} >"$OUT/purge-sweep.log" 2>&1
rc=$?
if [ "$rc" = 0 ] || [ "$rc" = 10 ]; then
  [ -z "$(outside_left)" ] || fallback "the python sweep said exit $rc but image/video file(s) or symlink(s) are still outside the non-secret units' folders"
fi
case "$rc" in
  0) echo "[qa-sim-sweep] clean: no image/video file or symlink outside the non-secret units' folders"; finish "$acc_bad" ;;
  10) grep -q '^purge: sweep of ' "$OUT/purge-sweep.log" 2>/dev/null || fallback "the python sweep gave exit code 10 without its summary line"
      mark_fail "image/video file(s) or symlink(s) found outside the non-secret units' folders in $OUT (deleted; see purge-sweep.log)"; finish 1 ;;
  11) fallback "the python sweep could not delete everything or files remain" ;;
  *) fallback "the python sweep errored (exit code $rc)" ;;
esac
