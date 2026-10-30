#!/usr/bin/env bash
# After the qa-sim JS bundle is built, fail if the production host is in it.
# Other EAS profiles exit 0. Pass a directory to scan that tree.
# Local `expo export` runs need `--clear`: two runs in a row reuse Metro's cached transform and the QA_SIM env change is ignored (EAS builds on a fresh worker and is unaffected).
set -euo pipefail

root="${1:-}"
if [ -z "${root}" ]; then
  if [ "${EAS_BUILD_PROFILE:-}" != "qa-sim" ]; then
    exit 0
  fi
  root="."
fi

if [ ! -d "${root}" ]; then
  echo "Refusing qa-sim build: bundle directory is missing." >&2
  exit 1
fi

files=()
while IFS= read -r -d '' file; do
  if [ -n "${file}" ]; then
    files+=("${file}")
  fi
done < <(find "${root}" \
  \( -name node_modules -o -name .git \) -prune -o \
  -type f \( -name '*.bundle' -o -name '*.jsbundle' -o -name '*.hbc' \) -print0)

if [ "${#files[@]}" -eq 0 ]; then
  echo "Refusing qa-sim build: no JS bundle was found." >&2
  exit 1
fi

for file in "${files[@]}"; do
  if grep -a -q -F 'chess-school.in' "${file}"; then
    echo "Refusing qa-sim build: chess-school.in is in ${file}." >&2
    exit 1
  fi
done

echo "qa-sim bundles do not contain chess-school.in (${#files[@]} file(s))."
