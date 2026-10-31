#!/usr/bin/env bash
# Vercel Ignored Build Step (apps/web). Exit 0 = skip deployment, exit 1 = build.
# https://vercel.com/docs/project-configuration#ignorecommand
#
# Routes by VERCEL_PROJECT_ID (system env — "Available at: Both build and runtime",
# https://vercel.com/docs/environment-variables/system-environment-variables#vercel_project_id)
# and VERCEL_GIT_COMMIT_REF. Fail closed on unknown project or empty ref.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/vercel-ignore.mjs"
