#!/usr/bin/env bash
# Fail closed before the QA simulator opens a database.
# Prints TURSO_* names when those variables are set. Does not print values.
# qa-sim-guard:start
set -euo pipefail

turso_names=""
while IFS= read -r name; do
  if [ -z "${name}" ]; then
    continue
  fi
  if [ -z "${turso_names}" ]; then
    turso_names="${name}"
  else
    turso_names="${turso_names}, ${name}"
  fi
done < <(env | awk -F= '/^TURSO_/ { print $1 }' | sort)

if [ -n "${turso_names}" ]; then
  echo "Refusing to run: TURSO_* variables are set (${turso_names})." >&2
  exit 1
fi

case "${DATABASE_URL-}" in
  file:*) ;;
  *)
    echo "Refusing to run: DATABASE_URL must start with file:." >&2
    exit 1
    ;;
esac
# qa-sim-guard:end
