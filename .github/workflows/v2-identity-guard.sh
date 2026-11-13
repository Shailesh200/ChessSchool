#!/usr/bin/env bash
# Fail if a new commit (not already in BASE_SHA) has the wrong author or
# committer, a co-author trailer, or a forbidden name in the message or diff.
set -euo pipefail

BASE_SHA="${BASE_SHA:-610968701e8a555823381a7d6459ac2685cd0220}"
EXPECTED="Shailesh200 <31487364+Shailesh200@users.noreply.github.com>"
EVENT_NAME="${EVENT_NAME:-push}"
BEFORE="${BEFORE:-}"
PR_BASE="${PR_BASE:-}"
PR_HEAD="${PR_HEAD:-}"

term_trailer="$(printf '%s-%s' 'Co-authored' 'by')"
term_handle="$(printf '%s%s' 'shailesh-' 'arc')"
term_other="$(printf '%s%s' 'arca' 'na')"

fetch_commit() {
  sha="$1"
  if [ -z "$sha" ]; then
    return 0
  fi
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    return 0
  fi
  git fetch --no-tags origin "$sha"
}

fetch_commit "$BASE_SHA"

if [ "$EVENT_NAME" = "pull_request" ]; then
  if [ -z "$PR_BASE" ] || [ -z "$PR_HEAD" ]; then
    echo "pull_request event is missing base or head sha" >&2
    exit 1
  fi
  fetch_commit "$PR_BASE"
  fetch_commit "$PR_HEAD"
  range_start="$PR_BASE"
  range_end="$PR_HEAD"
elif [ -z "$BEFORE" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  range_start="$BASE_SHA"
  range_end="HEAD"
else
  if ! git cat-file -e "${BEFORE}^{commit}" 2>/dev/null; then
    git fetch --no-tags origin "$BEFORE" || true
  fi
  if git cat-file -e "${BEFORE}^{commit}" 2>/dev/null; then
    range_start="$BEFORE"
    range_end="HEAD"
  else
    range_start="$BASE_SHA"
    range_end="HEAD"
  fi
fi

commits="$(git rev-list "${range_start}..${range_end}")"
if [ -z "$commits" ]; then
  echo "No commits in ${range_start}..${range_end}."
  exit 0
fi

fail=0
while IFS= read -r commit; do
  [ -n "$commit" ] || continue
  if git merge-base --is-ancestor "$commit" "$BASE_SHA"; then
    echo "skip ${commit} (already in ${BASE_SHA})"
    continue
  fi

  author="$(git log -1 --format='%an <%ae>' "$commit")"
  committer="$(git log -1 --format='%cn <%ce>' "$commit")"
  if [ "$author" != "$EXPECTED" ] || [ "$committer" != "$EXPECTED" ]; then
    echo "unexpected identity on ${commit}"
    echo "  author:    ${author}"
    echo "  committer: ${committer}"
    fail=1
  fi

  blob="$(git show --format=fuller --no-color "$commit")"
  for term in "$term_trailer" "$term_handle" "$term_other"; do
    if printf '%s\n' "$blob" | grep -qiF -- "$term"; then
      echo "forbidden text in ${commit}"
      fail=1
    fi
  done
done <<EOF
$commits
EOF

if [ "$fail" -ne 0 ]; then
  echo "identity guard failed"
  exit 1
fi

echo "identity guard passed"
