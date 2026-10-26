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
trap scrub_maestro_output EXIT

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
maestro test --test-output-dir "$RUNNER_TEMP/maestro-raw" "$MAESTRO_FLOW_FILE"
if ! find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print -quit | grep -q .; then
  if [ -d "$HOME/.maestro" ]; then
    find "$HOME/.maestro" -name '*.png' -exec cp -t "$RUNNER_TEMP/maestro-raw" {} +
  fi
fi
scrub_maestro_output
if ! find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print -quit | grep -q .; then
  echo "Maestro finished without writing a PNG screenshot."
  exit 1
fi
find "$RUNNER_TEMP/maestro-raw" -name '*.png' -print
