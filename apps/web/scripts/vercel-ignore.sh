#!/usr/bin/env bash
# Vercel Ignored Build Step for the web app (project root: apps/web).
# Exit 0 skips the deployment. Exit 1 builds.
# https://vercel.com/docs/project-configuration#ignorecommand
set -euo pipefail

# Production, main, and the staging site always build.
if [[ "${VERCEL_ENV:-}" == "production" || "${VERCEL_GIT_COMMIT_REF:-}" == "main" || "${VERCEL_GIT_COMMIT_REF:-}" == "staging" ]]; then
  echo "vercel-ignore: always build (VERCEL_ENV=${VERCEL_ENV:-} VERCEL_GIT_COMMIT_REF=${VERCEL_GIT_COMMIT_REF:-})"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

# Same base turbo-ignore uses: the previous deployment, or HEAD^ when that SHA is missing.
ref="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if ! git cat-file -e "${ref}^{commit}" 2>/dev/null; then
  ref="HEAD^"
fi
if ! git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null; then
  echo "vercel-ignore: no base commit to compare; building"
  exit 1
fi

# Root inputs that change the install or task graph but sit outside workspace packages.
# git diff --quiet exits 1 when those paths differ, which is Vercel's "build" code.
if ! git diff --quiet "$ref" HEAD -- \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  package.json \
  turbo.json \
  .nvmrc
then
  echo "vercel-ignore: root build input changed since ${ref}; building"
  exit 1
fi

# apps/web plus the workspace packages it depends on
# (core, progression, puzzle-school, pulse-tracker). 0 = unaffected, 1 = build.
exec npx --yes turbo-ignore@2.11.10 web --fallback=HEAD^
