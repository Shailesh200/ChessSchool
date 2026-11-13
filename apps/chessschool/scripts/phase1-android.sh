#!/usr/bin/env bash
# Phase 1 walkthrough on an Android emulator running the app in Expo Go (fresh data).
# Requires: emulator booted, Metro on :8083, API on :3300 (adb reverse), Expo Go installed.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-/tmp/native}
mkdir -p "$OUT"
d() { python3 scripts/adb-drive.py "$@"; }
# Android "remove animations" = reduced motion for the app, and lets uiautomator reach idle.
adb shell settings put global animator_duration_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0
trap 'adb shell settings put global animator_duration_scale 1; adb shell settings put global transition_animation_scale 1; adb shell settings put global window_animation_scale 1' EXIT
step() { echo "• $*"; }

d has "Hi, I'm Cody." 60
sleep 3
d devmenu
d shot "$OUT/01-welcome.png"
step "welcome → guest"
d tapuntil "Continue" "Who's learning?"
d tap "Just me"
d shot "$OUT/02-who.png"
d tap "Continue"
d tap "15 min"
d tap "Continue"
d has "Your seat is ready."
d tap "Start as a guest"
d has "Meet the school"
d has "friend"
sleep 1
d shot "$OUT/03-today-new.png"

step "orientation"
d tap "Begin"
d has "This is Learn."
d shot "$OUT/04-orient-1.png"
d tap "Continue"
d tap "Continue"
d tap "I've got it"
d has "Welcome to the school!"
sleep 1.5
d shot "$OUT/05-orient-done.png"
d tap "Back to Learn"
d has "Want a daily nudge?" 10
d shot "$OUT/06-notif-sheet.png"
d tap "Not now"
d has "10 XP"
d has "1 day"
d shot "$OUT/07-today-done.png"

step "gym"
d tap "Gym"
d has "Pass & play"
d shot "$OUT/08-gym.png"

step "profile"
d tap "Profile"
d tap "Edit name"
d type "Name" "Asha"
d shot "$OUT/09a-you-keyboard.png"
d enter
d has "Nice to meet you, Asha."
d shot "$OUT/09-you-guest.png"

step "settings + reset sheet"
d tap "Settings"
d has "Looks"
d tap "Looks"
d has "App theme"
d tap "Dark"
sleep 0.8
d back
d shot "$OUT/10-settings-dark.png"
d scroll 600
d tap "Reset this device"
d has "Start fresh on this device?"
d shot "$OUT/11-reset-sheet.png"
d tap "Keep everything"
d back

step "signup keeps name + orientation"
d tap "Profile"
d tap "Create account"
d has "Save your progress."
EMAIL="native$(date +%s)@example.com"
d type "Email" "$EMAIL"
d enter              # "next" moves focus to the password field
d keys "pawnpawn1"
d shot "$OUT/12-signup.png"
d enter              # "go" submits
d has "Your progress is saved." 15
d has "Asha"
d shot "$OUT/13-today-saved-dark.png"

step "profile member, sign out, wrong + right login"
d tap "Profile"
d has "Member"
d tap "Settings"
d scroll 500
d tap "Sign out"
d has "Good"
d tap "Profile"
d tap "Log in"
d type "Email" "$EMAIL"
d enter
d keys "wrongpass"
d enter
d has "don't match"
d shot "$OUT/14-login-error.png"
echo "$EMAIL" > "$OUT/email.txt"
echo "ALL OK → $OUT"
