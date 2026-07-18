# Mobile device checklist (non-screenshot)

Pixel overlays cannot verify audio, haptics, gestures, or Google Play Services.
Run on a physical Android (Internal testing) and/or iOS Simulator before each store build.

## Auth & install
- [ ] Fresh install from Internal testing / TestFlight opens past splash
- [ ] Email/password login succeeds against production API
- [ ] Google Sign-In shows account picker (does **not** open Play Store “unreviewed” sheet)
- [ ] Guest → enroll merges progress without wipe

## Board & pieces
- [ ] Classic piece theme shows all 12 piece types (not blank squares)
- [ ] Marble 3D and at least one other asset theme (Merida / Alpha) render
- [ ] Drag-to-move activates after ~10px; tap still selects
- [ ] Promotion chooser appears for pawn → last rank
- [ ] Check / success flashes visible (colorblind toggle optional spot-check)

## Sound & haptics
- [ ] Move / capture / error SFX with Sound on; silent with Sound off
- [ ] Coach TTS (or expo-speech fallback) speaks once per coach line
- [ ] Mute during lesson works
- [ ] Button tap haptic when Haptics on; none when off
- [ ] Campus locked-class press → error haptic + fail sound

## Core flows
- [ ] Academy campus loads without “Try again”
- [ ] Lesson complete → resume card updates
- [ ] Placement graduation unlocks next school on campus
- [ ] Bot match clocks + resign
- [ ] Online create/join (if testing online)

## Settings
- [ ] Text size 85% / 125% changes Learn + lesson chrome
- [ ] Colorblind + high contrast change board / chrome
- [ ] App theme + board/piece theme persist after kill

## Sign-off
| Build | versionCode / version | Device | Date | Tester |
| --- | --- | --- | --- | --- |
| | | | | |
