#!/usr/bin/env bash
# Pin the QA sim job to a full commit SHA, or keep the checkout when no SHA is given.
# Usage: qa-sim-pin-commit.sh [sha]
set -euo pipefail

sha="${1:-}"

if [ -z "${sha}" ]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Using checked-out commit $(git rev-parse HEAD)."
  else
    echo "Using the checked-out project."
  fi
  exit 0
fi

if ! printf '%s' "${sha}" | grep -Eq '^[0-9a-fA-F]{40}$'; then
  echo "git_commit_sha must be a full 40-character hexadecimal SHA." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Cannot check out the requested commit because this job has no git repository." >&2
  exit 1
fi

root="$(git rev-parse --show-toplevel)"
cd "${root}"

current="$(git rev-parse HEAD)"
if [ "${current}" = "${sha}" ]; then
  echo "Using checked-out commit ${current}."
  exit 0
fi

git fetch --depth 1 origin "${sha}"
git checkout --detach "${sha}"
actual="$(git rev-parse HEAD)"
if [ "${actual}" != "${sha}" ]; then
  echo "Checkout ended on ${actual}, not the requested commit." >&2
  exit 1
fi
echo "Using checked-out commit ${actual}."
