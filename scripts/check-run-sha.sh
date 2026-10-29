#!/usr/bin/env bash
# DRAFT. LOCAL helper, run by the dispatcher on the clean checkout of R BEFORE dispatching. Read-only: it changes nothing and uses no
# network unless you pass --fetch (anonymous `git fetch` of the three SHAs from origin; nothing else leaves the box). Never prints a secret.
#
#   scripts/check-run-sha.sh --staging S --base B --run R --approved FILE [--fetch]
#
# S   the staging SHA QA verified (full 40 hex).        B   the staging SHA at the previous promotion (full 40 hex).
# R   the stable run SHA (full 40 hex): the single squash commit Arc promoted; what gets dispatched and checked out.
# --approved FILE   REQUIRED (no default path): lines `label patch-id approver`, approver = imu or arc. Its sha256 is printed.
# Nothing is defaulted and no branch names are accepted: S, B, R must be explicit 40-hex SHAs whose objects exist locally
# (or --fetch gets them anonymously: `git fetch --no-tags origin S B R`).
#
# Check 1: B..S and the approved list must match BOTH ways.
#   - Every row has a 40-hex patch-id (or `empty:<40-hex commit sha>`), an approver of imu|arc, and matches a commit in B..S; else MISSING.
#   - Every non-merge commit in B..S is covered by a row, else UNLISTED (prints SHA, subject, patch-id). Empty commits (no diff, so no
#     patch-id) fail unless listed as `label empty:<sha> approver`.
#   - DUPLICATE-PATCH: if one patch-id belongs to N>1 commits in B..S (c1, its revert, c3 = c1 again), it FAILS unless the list carries that id on
#     exactly N rows. A row repeated beyond the commit count is MISSING.
#   - ANY merge commit in B..S FAILS (Arc: every slot lands as a single linear commit).
# Check 2: `git rev-parse R^{tree}` == `git rev-parse S^{tree}`.
# DISPATCH OK only if both pass; exit 0 only then; exit 1 on any FAIL or refusal; exit 2 on bad usage. Also refused unless the tree is clean and HEAD == R.
#
# EXACT patch-id command (Imu must compute the approved ids with this, not with a bare `git log -p`). The `-c` options pin the diff settings,
# so a local gitconfig cannot change the ids (ids DO change with diff.context, diff.noprefix, diff.*Prefix):
#   env -u GIT_DIFF_OPTS git -c diff.context=3 -c diff.noprefix=false -c diff.mnemonicPrefix=false -c diff.relative=false -c diff.srcPrefix=a/ -c diff.dstPrefix=b/ \
#       -c diff.external= -c diff.renames=true -c diff.algorithm=myers -c diff.interHunkContext=0 -c core.abbrev=auto -c core.quotepath=true -c log.showSignature=false \
#       log -p --no-color --no-ext-diff --no-textconv B..S | git patch-id --stable
# (with default git config this is identical to `git log -p --no-color B..S | git patch-id --stable`; the scratch tests confirm it.)
# Output per commit with a diff: `<patch-id> <commit>`. Merges and empty commits print nothing. The patch-id covers the diff INCLUDING context lines.
set -uo pipefail
S=""; B=""; R=""; approved=""; dofetch=0
while [ $# -gt 0 ]; do
  case "$1" in
    --staging) S="${2:?--staging needs a 40-hex SHA}"; shift 2 ;;
    --base) B="${2:?--base needs a 40-hex SHA}"; shift 2 ;;
    --run) R="${2:?--run needs a 40-hex SHA}"; shift 2 ;;
    --approved) approved="${2:?--approved needs a file}"; shift 2 ;;
    --fetch) dofetch=1; shift ;;
    -h|--help) n="$(grep -n '^set -uo pipefail' "$0" | head -1 | cut -d: -f1)"; sed -n "2,$((n-1))p" "$0"; exit 0 ;;
    *) echo "unknown argument $1 (usage: --staging S --base B --run R --approved FILE [--fetch])" >&2; exit 2 ;;
  esac
done
die() { echo "check-run-sha REFUSED: $*" >&2; exit 1; }
unset GIT_DIFF_OPTS
pgit() { git -c diff.context=3 -c diff.noprefix=false -c diff.mnemonicPrefix=false -c diff.relative=false -c diff.srcPrefix=a/ -c diff.dstPrefix=b/ \
           -c diff.external= -c diff.renames=true -c diff.algorithm=myers -c diff.interHunkContext=0 -c core.abbrev=auto -c core.quotepath=true -c log.showSignature=false "$@"; }
for v in S B R; do
  [ -n "${!v}" ] || die "pass --staging S --base B --run R, all three (no defaults; nothing auto-picks a head)"
  printf '%s' "${!v}" | grep -Eq '^[0-9a-fA-F]{40}$' || die "$v must be a full 40-hex SHA (no branch names, no short SHAs)"
  printf -v "$v" '%s' "$(printf '%s' "${!v}" | tr '[:upper:]' '[:lower:]')"
done
[ -n "$approved" ] || die "--approved FILE is required (there is no default path)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "run this inside the clean checkout of the repo"
[ "$dofetch" = 1 ] && { git fetch --no-tags --quiet origin "$S" "$B" "$R" >/dev/null 2>&1 || echo "note: anonymous fetch failed (continuing with what is local)" >&2; }
for v in S B R; do
  git cat-file -e "${!v}^{commit}" 2>/dev/null || die "commit ${!v} ($v) is not in this checkout (fetch it, or pass --fetch if it is on origin)"
done
head="$(git rev-parse HEAD)"; [ "$head" = "$R" ] || die "HEAD is $head, not the run SHA $R: check out R on a clean checkout first"
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"
[ -f "$approved" ] || die "approved list not found: $approved"
git merge-base --is-ancestor "$B" "$S" 2>/dev/null || die "base $B is not an ancestor of staging $S"

ids="$(mktemp)"; nonmerge="$(mktemp)"; merges="$(mktemp)"; apptmp="$(mktemp)"
trap 'rm -f "$ids" "$nonmerge" "$merges" "$apptmp"' EXIT
echo "staging S=${S:0:12}  base B=${B:0:12}  run R=${R:0:12}"
echo "approved list: $approved  sha256 $(sha256sum "$approved" | cut -d' ' -f1)"
# the list is read from a copy with CRs removed and a final newline guaranteed (a last row without newline is not dropped)
{ tr -d '\r' <"$approved"; printf '\n'; } >"$apptmp"

# ---- check 1: B..S and the approved list must match both ways ----
pgit log -p --no-color --no-ext-diff --no-textconv "$B..$S" | git patch-id --stable >"$ids"      # lines: <patch-id> <commit>
git rev-list --no-merges "$B..$S" >"$nonmerge"; git rev-list --merges "$B..$S" >"$merges"
echo "check 1 (B..S vs approved list, both ways): $(wc -l <"$nonmerge") non-merge commit(s) ($(wc -l <"$ids") with a diff), $(wc -l <"$merges") merge commit(s)"
[ -s "$nonmerge" ] || die "no non-merge commits between B and S: nothing to check"
declare -A ncommit rowsfor; declare -A shas
while read -r p c; do ncommit[$p]=$(( ${ncommit[$p]:-0} + 1 )); shas[$p]="${shas[$p]:-} ${c:0:10}"; done <"$ids"
bad=0; total=0; okempty=" "
# (a) every approved row must be well formed, approved by imu|arc, and match a commit in B..S
while read -r slot pid approver _; do
  case "$slot" in ''|\#*) continue ;; esac
  total=$((total+1))
  if printf '%s' "${pid:-}" | grep -Eq '^empty:[0-9a-f]{40}$'; then kind=empty; elif printf '%s' "${pid:-}" | grep -Eq '^[0-9a-f]{40}$'; then kind=pid
  else printf '  %-8s MISSING  no approved patch-id yet (%s)\n' "$slot" "${pid:-empty}"; bad=$((bad+1)); continue; fi
  case "${approver:-}" in imu|arc) ;; *) printf '  %-8s MISSING  no approver (need imu or arc as the third column, got %s)\n' "$slot" "${approver:-empty}"; bad=$((bad+1)); continue ;; esac
  if [ "$kind" = pid ]; then
    n="${ncommit[$pid]:-0}"; r=$(( ${rowsfor[$pid]:-0} + 1 ))
    if [ "$n" -eq 0 ]; then printf '  %-8s MISSING  patch-id %s is in no commit of B..S\n' "$slot" "$pid"; bad=$((bad+1)); continue; fi
    if [ "$r" -gt "$n" ]; then
      if [ "$n" -eq 1 ]; then printf '  %-8s MISSING  the same patch-id is listed for two rows (%s)\n' "$slot" "$pid"
      else printf '  %-8s MISSING  patch-id %s is listed %d times but only %d commit(s) have it\n' "$slot" "$pid" "$r" "$n"; fi
      bad=$((bad+1)); continue
    fi
    rowsfor[$pid]=$r
    c="$(awk -v p="$pid" '$1==p {print $2}' "$ids" | sed -n "${r}p")"
    printf '  %-8s PRESENT  %s  %s  (approved by %s)\n' "$slot" "$(git rev-parse --short "$c")" "$(git log -1 --format=%s "$c" | cut -c1-60)" "$approver"
  else
    e="${pid#empty:}"
    case "$okempty" in *" $e "*) printf '  %-8s MISSING  %s is listed twice\n' "$slot" "$pid"; bad=$((bad+1)); continue ;; esac
    if grep -qx "$e" "$nonmerge" && ! grep -q " $e\$" "$ids"; then okempty="$okempty$e "; printf '  %-8s PRESENT  %s  %s  (empty commit, approved by %s)\n' "$slot" "$(git rev-parse --short "$e")" "$(git log -1 --format=%s "$e" | cut -c1-50)" "$approver"
    else printf '  %-8s MISSING  %s is not an empty non-merge commit of B..S\n' "$slot" "$pid"; bad=$((bad+1)); fi
  fi
done <"$apptmp"
[ "$total" -gt 0 ] || { echo "  the approved list has no rows" >&2; bad=$((bad+1)); }
# (b) DUPLICATE-PATCH: a patch-id shared by N>1 commits needs exactly N rows
dup=0
for p in "${!ncommit[@]}"; do
  n="${ncommit[$p]}"; [ "$n" -gt 1 ] || continue
  if [ "${rowsfor[$p]:-0}" -ne "$n" ]; then printf '  DUPLICATE-PATCH %s is the patch-id of %d commits (%s ) but the list has %d row(s) for it (needs exactly %d)\n' "$p" "$n" "${shas[$p]}" "${rowsfor[$p]:-0}" "$n"; dup=$((dup+1)); fi
done
# (c) every non-merge commit in B..S must be on the list (by patch-id; an empty commit by empty:<sha>)
extra=0
while read -r c; do
  pidc="$(awk -v c="$c" '$2==c {print $1; exit}' "$ids")"
  if [ -n "$pidc" ]; then
    [ "${ncommit[$pidc]}" -gt 1 ] && continue          # reported by DUPLICATE-PATCH when its rows do not add up
    [ "${rowsfor[$pidc]:-0}" -ge 1 ] && continue
  else case "$okempty" in *" $c "*) continue ;; esac; pidc="(empty commit: list it as empty:$c)"; fi
  printf '  UNLISTED %s  %s  patch-id %s\n' "$c" "$(git log -1 --format=%s "$c" | cut -c1-70)" "$pidc"; extra=$((extra+1))
done <"$nonmerge"
# (d) ANY merge commit in B..S fails
nm=0
while read -r m; do
  [ -n "$m" ] || continue
  printf '  MERGE    %s  %s  FAIL: no merge commits allowed in B..S (every slot must be a single linear commit)\n' "$m" "$(git log -1 --format=%s "$m" | cut -c1-60)"; nm=$((nm+1))
done <"$merges"
c1=PASS; [ $((bad+dup+extra+nm)) -gt 0 ] && c1=FAIL
if [ "$c1" = PASS ]; then echo "check 1: PASS (all $total list row(s) PRESENT, every non-merge commit listed, no merges)"
else echo "check 1: FAIL ($bad list row(s) MISSING, $dup DUPLICATE-PATCH, $extra commit(s) UNLISTED, $nm merge commit(s))"; fi

# ---- check 2: R's tree == S's tree ----
tr_r="$(git rev-parse "$R^{tree}")"; tr_s="$(git rev-parse "$S^{tree}")"
if [ "$tr_r" = "$tr_s" ]; then c2=PASS; echo "check 2 (R tree == S tree): PASS ($tr_r)"
else c2=FAIL; echo "check 2 (R tree == S tree): FAIL (R tree $tr_r, S tree $tr_s)"; fi

if [ "$c1" = PASS ] && [ "$c2" = PASS ]; then echo "DISPATCH OK: run $R (staging $S verified, base $B)"; exit 0; fi
echo "DO NOT DISPATCH $R: check 1 $c1, check 2 $c2" >&2; exit 1
