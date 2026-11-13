#!/usr/bin/env bash
# Phase 3 checks on an Android emulator running the app in Expo Go (any progress state).
# Requires: emulator booted, Metro on :8083, API on :3300 (adb reverse), Expo Go installed.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-/tmp/native3}
mkdir -p "$OUT"
d() { python3 scripts/adb-drive.py "$@"; }
open() { adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8083/--/$1" host.exp.exponent >/dev/null; sleep 5; }
adb shell settings put global animator_duration_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0
trap 'adb shell settings put global animator_duration_scale 1; adb shell settings put global transition_animation_scale 1; adb shell settings put global window_animation_scale 1' EXIT
step() { echo "• $*"; }

step "tabs"
d has "Gym" 60; d has "Puzzles"
d tap "Gym"; d has "Pass & play" 20
d shot "$OUT/01-gym.png"

step "puzzle + hint"
open puzzle
d has "Find the best move." 20
d tap "Hint"; sleep 1
d shot "$OUT/02-puzzle-hint.png"
adb shell input keyevent BACK; sleep 2

step "bot game vs Professor Bishop"
open "play?bot=bishop"
d has "Game setup" 20; d tap "Start game"; sleep 2
d tap "e2,"; d tap "e4,"
d has "Your move" 30
d shot "$OUT/03-bishop.png"
d has "Professor Bishop played" 10
d tap "Show all moves"; d has "Move sounds" 10
d shot "$OUT/03b-moves.png"
adb shell input keyevent BACK; sleep 1
d tap "Resign"; sleep 1; d tap "Resign"; d has "Game over." 20
d has "Accuracy" 30
d shot "$OUT/04-result.png"
d tap "See analysis"; d has "Game analysis" 20; sleep 2
d tap "Next move"; sleep 1
d shot "$OUT/04-analysis.png"
adb shell input keyevent BACK; sleep 2; adb shell input keyevent BACK; sleep 2

step "pass & play, 3 + 2"
d tap "Gym"; d tap "Pass & play"
d has "Game setup" 20; d tap "3 + 2"; d tap "Start game"; sleep 2
d tap "e2,"; d tap "e4,"
d has "Black to move" 15
d shot "$OUT/05-pass-play.png"
d tap "Resign"; sleep 1; d tap "Resign"; d has "Black resigned." 20
adb shell input keyevent BACK; sleep 2

step "looks: Ocean + Outline"
open looks
d tap "Ocean."; sleep 2
d shot "$OUT/06-ocean.png"
for _ in 1 2 3; do adb shell input swipe 540 1800 540 700 400; sleep 1; done
d tap "Outline."; sleep 2
d shot "$OUT/07-outline.png"
adb shell input keyevent BACK; sleep 2
open looks; d tap "Classroom."; sleep 1
for _ in 1 2; do adb shell input swipe 540 1800 540 900 400; sleep 1; done
d tap "Toy."; sleep 1
adb shell input keyevent BACK; sleep 2

step "achievements"
open you
for _ in 1 2; do adb shell input swipe 540 1800 540 700 400; sleep 1; done
d has "First game" 10
d shot "$OUT/08-badges.png"

echo "phase 3 android: all flows passed"
