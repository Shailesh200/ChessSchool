#!/usr/bin/env bash
# Assert the checked-out commit. Does not fetch or check out another ref.
# The workflow is dispatched on the candidate ref.
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
  echo "Cannot read HEAD because this job has no git repository." >&2
  exit 1
fi

root="$(git rev-parse --show-toplevel)"
cd "${root}"

sha="$(printf '%s' "${sha}" | tr '[:upper:]' '[:lower:]')"
current="$(git rev-parse HEAD)"
if [ "${current}" != "${sha}" ]; then
  echo "Refusing to run: HEAD is ${current}, not the git_commit_sha for this run. Dispatch the workflow on the candidate ref." >&2
  exit 1
fi

echo "Using checked-out commit ${current}."
