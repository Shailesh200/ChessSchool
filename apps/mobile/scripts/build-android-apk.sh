#!/usr/bin/env bash
# Local release APK with EXPO_PUBLIC_* from apps/mobile/.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing apps/mobile/.env — copy from .env.example and set EXPO_PUBLIC_* values." >&2
  exit 1
fi

# Export public env for Expo/Metro embed during the Gradle JS bundle step.
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${EXPO_PUBLIC_API_URL:-}" || -z "${EXPO_PUBLIC_GOOGLE_CLIENT_ID:-}" ]]; then
  echo "EXPO_PUBLIC_API_URL and EXPO_PUBLIC_GOOGLE_CLIENT_ID must be set in .env" >&2
  exit 1
fi

echo "→ API: $EXPO_PUBLIC_API_URL"
echo "→ Google Web client: ${EXPO_PUBLIC_GOOGLE_CLIENT_ID:0:20}…"
echo "→ Prebuild (android)…"
pnpm exec expo prebuild --platform android --no-install

echo "→ assembleRelease…"
cd android
./gradlew :app:assembleRelease \
  --no-configure-on-demand \
  -Dorg.gradle.configureondemand=false \
  --console=plain

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "✓ APK ready:"
ls -lh "$APK"
echo "$APK"
