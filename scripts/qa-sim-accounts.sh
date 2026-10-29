#!/usr/bin/env bash
# DRAFT. SOURCED (not run) by qa-sim-e2e-android.sh and qa-sim-final-sweep.sh: the rules for the fixed accounts file `${TMPDIR:-/tmp}/qa-sim-accounts.env`
# (0600, holds the run's throwaway passwords). Defines functions only; prints nothing; never reads or prints the file's content.
#   qa_acc_location_ok PATH TOP OUTREL   0 = the path is outside the repo (TOP) and outside the artifact folder TOP/OUTREL
#                                        1 = INSIDE the repo or the artifact folder (the upload could pick it up): refuse
#                                        2 = its directory does not exist (nothing can be there); the writer treats this as a refusal, the sweep does not
#   qa_acc_create PATH TOP OUTREL        writer: location rule, refuse a symlink or a file that is not a regular file owned by us, then `mktemp` in the SAME
#                                        directory (mode 0600) and an atomic `mv -T` over PATH (rename(2) replaces a planted symlink, it never follows it)
# On a refusal QA_ACC_WHY holds the reason (no secret in it).
QA_ACC_WHY=""

qa_acc_location_ok() {
  local p="$1" top="$2" outrel="$3" d b rd rtop rout
  d="$(dirname -- "$p")"; b="${p##*/}"
  rd="$(cd -P -- "$d" 2>/dev/null && pwd -P)" || { QA_ACC_WHY="the directory of the accounts file ($d) does not exist"; return 2; }
  rtop="$(cd -P -- "$top" 2>/dev/null && pwd -P)" || { QA_ACC_WHY="the repo root cannot be resolved"; return 1; }
  rout="$(readlink -m -- "$rtop/$outrel" 2>/dev/null)" || rout="$rtop/$outrel"
  case "$rd/" in
    "$rtop"/*) QA_ACC_WHY="the accounts file path resolves inside the repo ($rd/$b is under the repo root): the upload could pick it up"; return 1 ;;
    "$rout"/*) QA_ACC_WHY="the accounts file path resolves inside the artifact folder ($rd/$b): it would be uploaded"; return 1 ;;
  esac
  return 0
}

qa_acc_create() {
  local p="$1" top="$2" outrel="$3" d t
  qa_acc_location_ok "$p" "$top" "$outrel" || return 1
  if [ -L "$p" ]; then QA_ACC_WHY="the accounts file path is a symlink (planted?): refused"; return 1; fi
  if [ -e "$p" ] && { [ ! -f "$p" ] || [ ! -O "$p" ]; }; then QA_ACC_WHY="the accounts file path exists but is not a regular file owned by this user: refused"; return 1; fi
  d="$(dirname -- "$p")"
  t="$(umask 077; mktemp "$d/.qa-sim-accounts.XXXXXX" 2>/dev/null)" || { QA_ACC_WHY="mktemp failed in $d"; return 1; }
  chmod 600 -- "$t" 2>/dev/null || { rm -f -- "$t"; QA_ACC_WHY="chmod 600 failed"; return 1; }
  mv -f -T -- "$t" "$p" 2>/dev/null || { rm -f -- "$t"; QA_ACC_WHY="atomic mv onto the accounts file path failed"; return 1; }
  [ -f "$p" ] && [ ! -L "$p" ] && [ -O "$p" ] || { QA_ACC_WHY="the accounts file is not a regular file owned by us after the mv"; return 1; }
  return 0
}
