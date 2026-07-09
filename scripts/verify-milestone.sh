#!/usr/bin/env bash
# Full milestone verification — run before owner approval, merge to main (see plans/00_MASTER_DEVELOPMENT_PLAN.md)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════════════════════════"
echo " ChessSchool verify:milestone"
echo "═══════════════════════════════════════════════════════════"

echo "→ pnpm typecheck"
pnpm typecheck

echo "→ pnpm lint"
pnpm lint

echo "→ pnpm --filter web format:check"
pnpm --filter web format:check

echo "→ test coverage (≥${MIN_COVERAGE_PERCENT:-90}%)"
bash scripts/verify-test-coverage.sh

echo "→ pnpm build"
pnpm build

echo "→ E2E route manifest coverage"
node scripts/verify-e2e-route-coverage.mjs

echo "→ Web SEO baseline"
bash scripts/verify-web-seo.sh

echo "→ pnpm --filter web db:fresh"
pnpm --filter web db:fresh

echo "→ pnpm e2e"
pnpm e2e

if [[ "${SKIP_LIGHTHOUSE:-}" == "1" ]]; then
  echo "→ Lighthouse skipped (SKIP_LIGHTHOUSE=1)"
else
  echo "→ Web Lighthouse (all routes in scripts/web-lighthouse-routes.json)"
  bash scripts/verify-web-lighthouse.sh
fi

echo ""
echo "✓ Milestone verification passed"
