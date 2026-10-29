#!/usr/bin/env bash
# qa-sim-venv.sh create | cleanup   (run from a workflow step; v9)
# create : make a FRESH venv in a new mktemp -d folder under ${TMPDIR:-/tmp}, never inside the repo and never under qa-sim-artifacts/ (physical paths compared; fails if the
#          folder resolves inside the repo), install the pinned PyYAML into it with
#            <venv>/bin/python -m pip install --no-deps --only-binary=:all: --require-hashes -r scripts/qa-sim-requirements.txt
#          (no --user, no fallback, no system pip; --only-binary=:all: means an interpreter or platform with no matching hashed wheel (not CPython 3.10-3.13 x86_64 manylinux) FAILS the
#          install instead of building the sdist, whose build requirements the hashes do not cover), check `import yaml`, then hand the interpreter to the LATER steps of the job with EAS's `set-env`:
#            QA_SIM_PY = <venv>/bin/python         QA_SIM_VENV_DIR = the mktemp -d folder (holds the venv and a marker file)
#          Any failure (venv, install, import, set-env missing or failing) removes the folder this run created and exits 1, so the step fails; in the guard job that stops the build.
# cleanup: delete $QA_SIM_VENV_DIR, and only if this script created it: a real directory (not a symlink) owned by us, named qa-sim-venv.*, carrying the marker file that
#          create writes, and resolving outside the repo and qa-sim-artifacts/. QA_SIM_VENV_DIR unset = nothing was created = nothing to delete (exit 0).
set -uo pipefail
export LC_ALL=C
MARK=".qa-sim-venv-created"; MARK_TEXT="created by scripts/qa-sim-venv.sh create"
say() { echo "[qa-sim-venv] $*" >&2; }
phys() { (cd -P -- "$1" 2>/dev/null && pwd -P); }          # physical path of an existing directory
inside() { [ "$1" = "$2" ] || case "$1" in "$2"/*) return 0 ;; *) return 1 ;; esac; }   # inside PATH DIR (both physical)

TOP="$(git rev-parse --show-toplevel 2>/dev/null)" && TOP="$(phys "$TOP")" && cd -P -- "$TOP" || { say "FAIL: cannot resolve the repo root"; exit 1; }
ART="$TOP/qa-sim-artifacts"

case "${1:-}" in
create)
  base="${TMPDIR:-/tmp}"
  [ -d "$base" ] || { say "FAIL: the temp directory $base does not exist"; exit 1; }
  bphys="$(phys "$base")" || { say "FAIL: cannot resolve the temp directory $base"; exit 1; }
  if inside "$bphys" "$TOP" || inside "$bphys" "$ART"; then
    say "FAIL: TMPDIR resolves inside the repo ($bphys): the venv must be outside the repo and outside qa-sim-artifacts/"; exit 1
  fi
  d="$(mktemp -d "$bphys/qa-sim-venv.XXXXXX")" && [ -d "$d" ] && [ ! -L "$d" ] || { say "FAIL: cannot create a temp folder under $bphys"; exit 1; }
  ok=0
  trap '[ "$ok" = 1 ] || rm -rf -- "$d"' EXIT     # only the folder THIS run created, and only if it did not finish
  trap 'exit 143' TERM; trap 'exit 130' INT; trap 'exit 129' HUP
  dphys="$(phys "$d")" || exit 1
  if inside "$dphys" "$TOP" || inside "$dphys" "$ART"; then say "FAIL: the venv folder resolves inside the repo ($dphys)"; exit 1; fi
  printf '%s\n' "$MARK_TEXT" >"$d/$MARK" || exit 1
  python3 -m venv "$d/venv" || { say "FAIL: python3 -m venv failed (is python3-venv/ensurepip installed?)"; exit 1; }
  PY="$d/venv/bin/python"
  [ -x "$PY" ] || { say "FAIL: $PY was not created"; exit 1; }
  "$PY" -m pip install --no-deps --only-binary=:all: --require-hashes -r scripts/qa-sim-requirements.txt || { say "FAIL: the hash-checked, wheel-only PyYAML install failed (a hash mismatch, or no matching wheel: the sdist is never built)"; exit 1; }
  "$PY" -c 'import yaml; print("PyYAML", yaml.__version__)' || { say "FAIL: import yaml failed in the venv"; exit 1; }
  command -v set-env >/dev/null 2>&1 || { say "FAIL: set-env (the EAS step helper) is not on PATH: the later steps could not find the venv"; exit 1; }
  set-env QA_SIM_PY "$PY" && set-env QA_SIM_VENV_DIR "$d" || { say "FAIL: set-env failed"; exit 1; }
  ok=1
  echo "[qa-sim-venv] venv ready: QA_SIM_PY=$PY (folder $d, outside the repo)"
  ;;
cleanup)
  d="${QA_SIM_VENV_DIR:-}"
  [ -n "$d" ] || { echo "[qa-sim-venv] no venv was created by this job: nothing to delete"; exit 0; }
  why=""
  if [ -L "$d" ] || [ ! -d "$d" ]; then why="not a real directory"
  elif [ ! -O "$d" ]; then why="not owned by this user"
  elif case "${d##*/}" in qa-sim-venv.*) false ;; *) true ;; esac; then why="the folder name is not qa-sim-venv.*"
  elif [ -L "$d/$MARK" ] || [ ! -f "$d/$MARK" ] || [ "$(cat -- "$d/$MARK" 2>/dev/null)" != "$MARK_TEXT" ]; then why="the marker file written by create is missing"
  else
    dphys="$(phys "$d")" || dphys=""
    if [ -z "$dphys" ] || inside "$dphys" "$TOP" || inside "$dphys" "$ART"; then why="the folder resolves inside the repo or qa-sim-artifacts/"; fi
  fi
  if [ -n "$why" ]; then say "FAIL: refusing to delete $d: $why (nothing deleted)"; exit 1; fi
  rm -rf -- "$d"
  [ ! -e "$d" ] || { say "FAIL: $d could not be deleted"; exit 1; }
  echo "[qa-sim-venv] deleted the venv folder this job created"
  ;;
*) say "usage: qa-sim-venv.sh create|cleanup"; exit 2 ;;
esac
