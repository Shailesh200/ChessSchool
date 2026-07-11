#!/usr/bin/env bash
# Unit test coverage gates — minimum 90% on scoped logic modules.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MIN="${MIN_COVERAGE_PERCENT:-90}"

echo "→ Web integration suite (temp libSQL — auth, progress, session APIs)"
pnpm --filter web run test:integration

echo "→ Web unit tests + coverage (apps/web, min ${MIN}%)"
pnpm --filter web exec vitest run --coverage --exclude "**/*.integration.test.ts"

echo "→ Mobile unit tests + coverage (apps/mobile, min ${MIN}%)"
pnpm --filter mobile exec vitest run --coverage

echo "✓ Test coverage gates passed"
