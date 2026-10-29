#!/usr/bin/env bash
# Install the capture APK and run the chosen Maestro flow.
# android-emulator-runner executes its script one line at a time, so the
# workflow calls this file as a single command.
set -euo pipefail

scrub_maestro_output() {
  if [ -n "${RUNNER_TEMP:-}" ] && [ -d "$RUNNER_TEMP/maestro-raw" ]; then
    find "$RUNNER_TEMP/maestro-raw" -type f ! -name '*.png' -delete || true
  fi
}

# ALLOW-LIST copied before the screenshot dir is reduced to PNGs:
#   screen-hierarchy/*.json
#   commands.json
#   manifest.json
# Login links in those files are redacted. logs/ is not copied
# (no device-logcat.txt, no maestro.log).
preserve_hierarchy() {
  local src="$RUNNER_TEMP/maestro-raw"
  local dest="$RUNNER_TEMP/maestro-hierarchy"
  [ -d "$src" ] || return 0
  mkdir -p "$dest"
  find "$src" -type f \( \
      -path '*/screen-hierarchy/*.json' -o \
      -name 'commands.json' -o \
      -name 'manifest.json' \
    \) -print0 |
    while IFS= read -r -d '' file; do
      rel="${file#"$src"/}"
      mkdir -p "$dest/$(dirname "$rel")"
      cp "$file" "$dest/$rel"
    done
  find "$dest" -type f -print0 |
    while IFS= read -r -d '' file; do
      grep -q 'chessschool:///login' "$file" 2>/dev/null || continue
      sed -i -E 's#chessschool:///login[^[:space:]"]*#chessschool:///login?redacted#g' "$file"
    done
}

export PATH="$PATH:$HOME/.maestro/bin"
adb wait-for-device
adb shell wm size 1080x1920
adb shell wm density 420
echo "Display size:"
adb shell wm size
echo "Display density:"
adb shell wm density
adb install -r -t "$RUNNER_TEMP/app-release.apk"
mkdir -p "$RUNNER_TEMP/maestro-raw"
set +e
maestro test --test-output-dir "$RUNNER_TEMP/maestro-raw" "$MAESTRO_FLOW_FILE"
status=$?
set -e
if [ "$status" -eq 0 ] && ! find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print -quit | grep -q .; then
  if [ -d "$HOME/.maestro" ]; then
    find "$HOME/.maestro" -name '*.png' -exec cp -t "$RUNNER_TEMP/maestro-raw" {} +
  fi
fi
preserve_hierarchy
scrub_maestro_output
if [ "$status" -ne 0 ]; then
  exit "$status"
fi
if ! find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print -quit | grep -q .; then
  echo "Maestro finished without writing a PNG screenshot."
  exit 1
fi
find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print
