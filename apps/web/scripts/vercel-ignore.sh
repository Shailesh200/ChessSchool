#!/usr/bin/env bash
# Vercel Ignored Build Step for the web app (project root: apps/web).
# Exit 0 skips the deployment. Exit 1 builds.
# https://vercel.com/docs/project-configuration#ignorecommand
#
# Only production deploys and pushes to main build. Everything else is skipped,
# including previews, staging, stable and every PR branch.

if [ "${VERCEL_ENV:-}" = "production" ] || [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  echo "vercel-ignore: build (VERCEL_ENV=${VERCEL_ENV:-} VERCEL_GIT_COMMIT_REF=${VERCEL_GIT_COMMIT_REF:-})"
  exit 1
fi

echo "vercel-ignore: skip build (VERCEL_ENV=${VERCEL_ENV:-} VERCEL_GIT_COMMIT_REF=${VERCEL_GIT_COMMIT_REF:-}); only main and production build"
exit 0
