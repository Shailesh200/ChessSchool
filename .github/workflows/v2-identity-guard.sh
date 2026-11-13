#!/usr/bin/env bash
# Commit metadata only. File contents are not read, so this script's own
# pattern text is not part of the check.
set -euo pipefail

BASE_SHA="${BASE_SHA:-610968701e8a555823381a7d6459ac2685cd0220}"
pattern='shailesh-arc|arcana|cursoragent|gmail|co-authored|anthropic|claude'

if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  git fetch --no-tags origin "$BASE_SHA"
fi

if ! git merge-base --is-ancestor "$BASE_SHA" HEAD; then
  echo "base ${BASE_SHA} is not reachable from HEAD" >&2
  exit 1
fi

commits="$(git rev-list "${BASE_SHA}..HEAD")"
if [ -z "$commits" ]; then
  echo "No commits in ${BASE_SHA}..HEAD."
  exit 0
fi

fail=0
while IFS= read -r commit; do
  [ -n "$commit" ] || continue
  author_name="$(git log -1 --format='%an' "$commit")"
  author_email="$(git log -1 --format='%ae' "$commit")"
  committer_name="$(git log -1 --format='%cn' "$commit")"
  committer_email="$(git log -1 --format='%ce' "$commit")"
  message="$(git log -1 --format='%B' "$commit")"
  for field in author_name author_email committer_name committer_email message; do
    value="${!field}"
    if printf '%s\n' "$value" | grep -qiE -- "$pattern"; then
      echo "forbidden text in ${field} of ${commit}"
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
