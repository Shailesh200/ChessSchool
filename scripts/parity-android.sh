#!/usr/bin/env bash
# Android emulator/device parity harness — PWA mweb vs native app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PARITY_ENV="${PARITY_ENV:-local}"
export PARITY_BASE_URL="${PARITY_BASE_URL:-http://localhost:3210}"
export PARITY_OUT="${PARITY_OUT:-parity/reports-android}"
export PARITY_PLATFORM=android
WEB_PORT="${PARITY_WEB_PORT:-3210}"
METRO_PORT="${PARITY_METRO_PORT:-8081}"

echo "═══════════════════════════════════════════════════════════"
echo " ChessSchool parity:android (PWA mweb ↔ native Android)"
echo " Env: $PARITY_ENV · Web: $PARITY_BASE_URL"
echo "═══════════════════════════════════════════════════════════"

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ Maestro CLI not found. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "✗ adb not found. Install Android platform-tools and ensure a device/emulator is connected."
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "✗ No Android device/emulator (adb get-state failed)."
  echo "  Start an AVD or plug in a device with USB debugging, then retry."
  exit 1
fi

if [ -d "/opt/homebrew/opt/openjdk@17/bin" ]; then
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
fi
export PATH="$HOME/.maestro/bin:$PATH"

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
(cd apps/mobile && EXPO_PUBLIC_API_URL="$PARITY_BASE_URL" EXPO_PUBLIC_PARITY=1 pnpm exec expo start --port "$METRO_PORT" --clear) &
METRO_PID=$!
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$METRO_PORT/status" >/dev/null 2>&1; then break; fi
  sleep 2
done

export EXPO_PUBLIC_API_URL="$PARITY_BASE_URL"
export EXPO_PUBLIC_PARITY=1

APP_ID="com.chessschool.app"
if ! adb shell pm path "$APP_ID" >/dev/null 2>&1; then
  echo "✗ Dev build not installed on connected Android device."
  echo "  Run once: cd apps/mobile && EXPO_PUBLIC_API_URL=$PARITY_BASE_URL npx expo run:android"
  exit 1
fi

# Emulator reaches host Metro via 10.0.2.2; physical device needs LAN IP in deep link (set PARITY_METRO_HOST).
METRO_HOST="${PARITY_METRO_HOST:-10.0.2.2}"
echo "→ Launching dev client on Android (Metro host: $METRO_HOST)"
adb shell am force-stop "$APP_ID" 2>/dev/null || true
adb shell am start -a android.intent.action.VIEW \
  -d "exp+chess-school://expo-development-client/?url=http://${METRO_HOST}:${METRO_PORT}" \
  "${APP_ID}/.MainActivity" >/dev/null 2>&1 || \
  adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

sleep 25

node scripts/parity-compare.mjs
