#!/usr/bin/env bash
# Lighthouse audit against production Next.js build — all routes in web-lighthouse-routes.json.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
PORT="${WEB_PREVIEW_PORT:-4173}"
URL="http://127.0.0.1:${PORT}/"

LH_BIN="$ROOT/node_modules/.bin/lighthouse"
if [ ! -x "$LH_BIN" ]; then
  echo "✗ lighthouse not installed — run: pnpm add -D lighthouse chrome-launcher (from repo root)" >&2
  exit 1
fi

log() { echo "$@" >&2; }

free_port() {
  if command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT" >/dev/null 2>&1; then
    log "→ Freeing port ${PORT}"
    lsof -ti:"$PORT" | xargs kill 2>/dev/null || true
    sleep 0.5
  fi
}

if [ "${WEB_LH_FORCE_BUILD:-0}" = "1" ] || [ ! -d "$WEB/.next" ]; then
  log "→ Building apps/web"
  (cd "$ROOT" && pnpm --filter web build)
else
  log "→ Using existing apps/web build (set WEB_LH_FORCE_BUILD=1 to rebuild)"
fi

PREVIEW_PID=""
cleanup() {
  if [ -n "$PREVIEW_PID" ] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

free_port

log "→ Ensuring local DB for next start"
(cd "$ROOT" && pnpm --filter web exec node scripts/ensure-db.mjs)

log "→ Starting production server on ${URL}"
(cd "$WEB" && PORT="$PORT" pnpm start:app) >/dev/null 2>&1 &
PREVIEW_PID=$!

for i in $(seq 1 60); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    log "→ Server ready (${i} attempts)"
    break
  fi
  sleep 0.5
done

if ! curl -sf "$URL" >/dev/null 2>&1; then
  log "✗ Server did not start at ${URL}"
  exit 1
fi

export WEB_PREVIEW_PORT="$PORT"
node "$ROOT/scripts/lighthouse-audit-routes.mjs"

REPORT_HTML="$ROOT/reports/lighthouse/index.html"
if [ -f "$REPORT_HTML" ]; then
  log "→ Beautiful report: $REPORT_HTML"
fi

log "✓ Web Lighthouse passed (all routes)"
