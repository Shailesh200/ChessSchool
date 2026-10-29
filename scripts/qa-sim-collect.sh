#!/usr/bin/env bash
# Copy Maestro logs and screenshots next to the next-start log for upload.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
dest="${root}/qa-sim-artifacts"
mkdir -p "${dest}/maestro" "${dest}/maestro-home"

if [ -n "${MAESTRO_TESTS_DIR:-}" ] && [ -d "${MAESTRO_TESTS_DIR}" ]; then
  cp -R "${MAESTRO_TESTS_DIR}/." "${dest}/maestro/"
fi

home_tests="${HOME:-}/.maestro/tests"
if [ -d "${home_tests}" ]; then
  cp -R "${home_tests}/." "${dest}/maestro-home/"
fi
