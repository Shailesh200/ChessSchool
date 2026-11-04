#!/usr/bin/env bash
# Phase 2 walkthrough on an Android emulator (Expo Go): the first chess lessons, Practice and a
# game vs Cody. Run after phase1-android.sh (or any state where "Meet the school" is done).
# Requires: emulator booted, Metro on :8083, API on :3300 (adb reverse), Expo Go installed.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-/tmp/native2}
mkdir -p "$OUT"
d() { python3 scripts/adb-drive.py "$@"; }
adb shell settings put global animator_duration_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0
trap 'adb shell settings put global animator_duration_scale 1; adb shell settings put global transition_animation_scale 1; adb shell settings put global window_animation_scale 1' EXIT
step() { echo "• $*"; }
next() { d tap "Continue"; }
mv() { d tap "$1,"; d tap "$2,"; }

d has "Your path" 60
d shot "$OUT/01-today.png"

step "lesson: the board"
d tapuntil "Start lesson" "This is the board."
next; next
d tap "a1,"
d has "Find the e-file"
d shot "$OUT/02-board-miss.png"
d tap "e4,"; next
d tap "d5,"; next
d tap "h1,"; next
next
d tap "e1,"; next
d tap "d1,"; next
d tap "64"
d shot "$OUT/03-board-choice.png"
next
d has "Lesson complete!"
d has "+20 XP"
d shot "$OUT/04-board-done.png"

step "lesson: how pieces move"
d tap "Next lesson"
d has "The rook goes straight."
next
mv a1 a5; mv a5 e5; mv e5 e8
d shot "$OUT/05-stars-done.png"
next; next
mv c1 e3; mv e3 g5; mv g5 d8; next; next
mv d1 d6; mv d6 h2; mv h2 b8; next; next
d shot "$OUT/06-knight.png"
mv b1 c3; mv c3 e4; mv e4 g5; next; next
mv e1 f2; mv f2 g3; next
d tap "Knight"; next
d has "Lesson complete!"

step "lesson: pawns"
d tap "Next lesson"
next
mv e2 e4; next; next
mv e4 d5; next; next
mv b7 b8
d shot "$OUT/07-promote.png"
next
d tap "Diagonally forward"; next
d has "Lesson complete!"

step "lesson: check"
d tap "Next lesson"
next
d tap "Yes"; next
mv a1 a8; next; next
mv a1 a8
d shot "$OUT/08-mate.png"
next
mv g1 g7; next
d tap "Checkmate"; next
d has "Lesson complete!"
d shot "$OUT/09-check-done.png"

step "today shows the next lesson"
d tap "Back to Learn"
d has "Your first game"
d has "95 XP"
d shot "$OUT/10-today.png"

step "practice"
d tap "Rooms"
d has "Open"
d shot "$OUT/11-rooms.png"
d tap "Start practice"
d tap "Start practice"
d has "Show me"
d shot "$OUT/12-drill.png"
d tap "Close lesson"
d back

step "play vs Cody"
d tap "Play Cody"
d has "Gentle"
d shot "$OUT/13-play-setup.png"
d tap "Start game"
mv e2 e4
d has "Your move" 20
d has "1. e4"
d shot "$OUT/14-play-reply.png"
d tap "Take back"
d has "Your move"
mv d2 d4
d has "Your move" 20
d tap "Resign"
d tap "Resign"
d has "Game over."
d shot "$OUT/15-play-result.png"
echo "phase 2 android: all flows passed"
