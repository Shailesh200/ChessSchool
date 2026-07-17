#!/usr/bin/env bash
# iOS Simulator parity harness — PWA mweb vs native app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PARITY_ENV="${PARITY_ENV:-local}"
export PARITY_BASE_URL="${PARITY_BASE_URL:-http://localhost:3210}"
export PARITY_OUT="${PARITY_OUT:-parity/reports}"
WEB_PORT="${PARITY_WEB_PORT:-3210}"
METRO_PORT="${PARITY_METRO_PORT:-8081}"

echo "═══════════════════════════════════════════════════════════"
echo " ChessSchool parity:iOS (PWA mweb ↔ native simulator)"
echo " Env: $PARITY_ENV · Web: $PARITY_BASE_URL"
echo "═══════════════════════════════════════════════════════════"

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ Maestro CLI not found. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

# Maestro requires Java 17+
if [ -d "/opt/homebrew/opt/openjdk@17/bin" ]; then
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
fi
export PATH="$HOME/.maestro/bin:$PATH"

if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "→ Booting iOS simulator…"
  for device in "iPhone 17 Pro" "iPhone 17" "iPhone 16 Pro" "iPhone 15 Pro"; do
    if xcrun simctl boot "$device" 2>/dev/null; then
      echo "  booted: $device"
      break
    fi
  done
  open -a Simulator
  sleep 10
fi

WEB_PID=""
METRO_PID=""
cleanup() {
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "$METRO_PID" ]] && kill "$METRO_PID" 2>/dev/null || true
}
trap cleanup EXIT

if [ "$PARITY_ENV" = "local" ]; then
  for port in "$WEB_PORT" 3000; do
    OLD_WEB=$(lsof -ti tcp:"$port" 2>/dev/null | head -1 || true)
    if [ -n "${OLD_WEB:-}" ]; then
      echo "→ Stopping web on :$port (parity starts a fresh dev server)"
      kill "$OLD_WEB" 2>/dev/null || true
    fi
  done
  sleep 2
  rm -f apps/web/.next/dev/lock 2>/dev/null || true
fi

if ! curl -sf "$PARITY_BASE_URL/academy" >/dev/null 2>&1; then
  echo "→ Starting web dev server @ :$WEB_PORT"
  (cd apps/web && SESSION_TOKEN_SECRET=e2e-test-session-token-secret pnpm exec next dev -p "$WEB_PORT") &
  WEB_PID=$!
  for i in $(seq 1 90); do
    if curl -sf "http://localhost:$WEB_PORT/academy" >/dev/null 2>&1; then break; fi
    sleep 2
  done
  export PARITY_BASE_URL="http://localhost:$WEB_PORT"
fi

echo "→ Seeding parity account"
node scripts/parity-seed.mjs

# Fail fast if curriculum APIs are down (class/lesson captures depend on them).
for path in "/api/class/class-pieces" "/api/lesson/pawn-power"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PARITY_BASE_URL$path" || echo "000")
  if [ "$code" != "200" ]; then
    echo "✗ Expected 200 from $PARITY_BASE_URL$path (got $code). Seed DB: pnpm --filter web db:fresh"
    exit 1
  fi
done

echo "→ Starting Metro @ :$METRO_PORT with parity API ($PARITY_BASE_URL)"
for pid in $(lsof -ti tcp:"$METRO_PORT" 2>/dev/null || true); do kill "$pid" 2>/dev/null || true; done
sleep 2
# Do not set CI=1 here — Expo CI mode disables Metro reloads and pins a stale bundle.
(cd apps/mobile && EXPO_PUBLIC_API_URL="$PARITY_BASE_URL" EXPO_PUBLIC_PARITY=1 pnpm exec expo start --port "$METRO_PORT" --clear) &
METRO_PID=$!
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$METRO_PORT/status" >/dev/null 2>&1; then break; fi
  sleep 2
done

export EXPO_PUBLIC_API_URL="$PARITY_BASE_URL"
export EXPO_PUBLIC_PARITY=1

APP_ID="com.chessschool.app"
if ! xcrun simctl get_app_container booted "$APP_ID" >/dev/null 2>&1; then
  echo "✗ Dev build not installed on booted simulator."
  echo "  Run once: cd apps/mobile && EXPO_PUBLIC_API_URL=$PARITY_BASE_URL npx expo run:ios"
  exit 1
fi

echo "→ Launching dev client on simulator"
xcrun simctl launch booted "$APP_ID" "exp+chess-school://expo-development-client/?url=http://localhost:$METRO_PORT" >/dev/null 2>&1 || \
  xcrun simctl launch booted "$APP_ID" >/dev/null 2>&1 || true

sleep 25

node scripts/parity-compare.mjs
