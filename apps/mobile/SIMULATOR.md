# Running ChessSchool Mobile in the iOS Simulator (dev build)

This is a **dev build** (a.k.a. development client), **not Expo Go** — it bundles the
native **Stockfish** module, which Expo Go can't load. Everything below is the exact,
reproducible flow that got it running + verified, including the non-obvious snags.

> TL;DR once everything's installed: `cd apps/mobile && npx expo run:ios`

---

## 0. One-time prerequisites
| Tool | Install | Notes |
|---|---|---|
| **Xcode** (full, not just CLT) | Mac App Store, or `brew install xcodes && xcodes install --latest` | ~40 GB; needs **your Apple ID + 2FA**. Free ~40 GB of disk first. |
| Select Xcode | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` | CLT alone gives `xcodebuild: requires Xcode`. |
| First launch | `sudo xcodebuild -runFirstLaunch` | Accepts the license + installs core components. |
| **iOS Simulator runtime** | `xcodebuild -downloadPlatform iOS` | ~8.5 GB. See the **Cryptex gotcha** below. |
| **CocoaPods** | `brew install cocoapods` | For `pod install`. |
| **Node deps** | `pnpm install` (repo root) | |
| *(optional)* **Maestro + Java** | `brew install openjdk@17`; `curl -fsSL "https://get.maestro.mobile.dev" \| bash` | Only for automated UI taps; `xcrun simctl io booted screenshot` works without it. |

### ⚠️ Cryptex runtime gotcha (Xcode 26)
Xcode 26 ships the simulator runtime as a **Cryptex disk image**. After downloading it,
`xcrun simctl runtime list` may show it **"Ready"** while `xcrun simctl list runtimes`
stays **empty** — meaning CoreSimulator can't actually use it, so no device will boot.
If that happens:
1. **`xcrun simctl runtime delete all`** then **`xcodebuild -downloadPlatform iOS`** once (don't trigger it multiple times — that creates duplicate, unusable images).
2. **Reboot the Mac.** Cryptex images mount cleanly at boot; this is what finally registered it.
3. Confirm: `xcrun simctl list runtimes` now shows `com.apple.CoreSimulator.SimRuntime.iOS-26-5`.

---

## 1. Generate the native project + add the Stockfish engine
The `ios/` folder is gitignored (generated). The Stockfish engine source + NNUE nets
(`modules/stockfish/ios/engine/`, ~66 MB, GPLv3) are gitignored too — fetch them locally:

```bash
cd apps/mobile

# (a) generate ios/ and autolink modules/stockfish
npx expo prebuild -p ios

# (b) drop in the Stockfish 16.1 source + the two NNUE nets it references
cd modules/stockfish/ios && mkdir -p engine && cd engine
curl -L https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_16.1.tar.gz | tar xz
cp Stockfish-sf_16.1/src/*.cpp Stockfish-sf_16.1/src/*.h .
cp -r Stockfish-sf_16.1/src/nnue Stockfish-sf_16.1/src/incbin Stockfish-sf_16.1/src/syzygy .
curl -L -o nn-b1a57edbea57.nnue https://tests.stockfishchess.org/api/nn/nn-b1a57edbea57.nnue   # big net (~65 MB)
curl -L -o nn-baff1ede1f90.nnue https://tests.stockfishchess.org/api/nn/nn-baff1ede1f90.nnue   # small net (~3.5 MB)
rm -rf Stockfish-sf_16.1
cd ../../../..   # back to apps/mobile

# (c) re-run pod install so the podspec picks up the engine sources
(cd ios && pod install)
```
(If the office proxy blocks the downloads, grab them on a personal network. The net
filenames come from `evaluate.h` → `EvalFileDefaultName{Big,Small}`.)

## 2. Build + run
```bash
cd apps/mobile
npx expo run:ios            # builds the dev build, installs on a booted sim, starts Metro
```
First build is ~15 min (compiles RN + Hermes + all pods + Stockfish). Subsequent runs
are fast. To target a specific device: `npx expo run:ios --device "iPhone 17 Pro"`.

### ⚠️ Launch gotcha
`expo run:ios` sometimes builds + **installs** fine but errors at the final
`openurl` launch step (`Failed … openUrlAsync`). If the app shows a **blank white
screen** (it's a dev-client waiting for Metro):
- Make sure Metro is up (`npx expo start` in another shell, or let `run:ios` keep it running), then
- Re-run `npx expo run:ios` — with Metro already up the launch handshake succeeds, or
- Open it manually: `xcrun simctl openurl booted "com.chessschool.app://expo-development-client/?url=http://localhost:8081"`.

## 3. Verify it works
```bash
xcrun simctl io booted screenshot /tmp/app.png      # native screenshot
```
To confirm **Stockfish** specifically: open Play → vs Bot → start a match → make a move,
and watch the Metro logs for the engine diagnostic (`app/play/game.tsx`):
```
[bot-engine] stockfish=true nativeMove=e2e4 elo=1500
```
`stockfish=true` = the native engine is driving the bot. `stockfish=false` would mean it
fell back to the JS engine (e.g. the native module didn't load).

---

## How the native engine fits together
- **`modules/stockfish/`** — a local Expo module. `ios/StockfishModule.swift` runs
  Stockfish's UCI loop on a background thread with stdin/stdout rewired to pipes, and
  streams each output line to JS as a `stockfish-output` event.
- **`Stockfish.podspec`** — compiles `engine/**` with `-Dmain=stockfish_cpp_main` and
  `-I engine` (so `incbin` finds the bundled NNUE nets); exposes the C entry via the
  framework umbrella (`public_header_files`). `stockfish-shim.cpp` re-exports the renamed
  C++ `main` as the C symbol `stockfish_main` the Swift bridge links against.
- **`src/stockfish.ts`** — the JS adapter: `eloToUci` (UCI_Elo ≥1320 / Skill Level below),
  `parseBestMove`, a safety timeout. Returns `null` when the module is absent (Expo Go /
  web export) so `@chess-school/core`'s `getBotMove` falls back to the JS engine.
- **`app/play/game.tsx`** — uses native Stockfish when present, JS engine otherwise.

## Other notes
- **Chessboard parity**: the app's "classic" pieces use web's exact Cburnett Staunton SVGs
  (`src/staunton-pieces.ts`); other piece themes share the custom shapes already matched to web.
- **GPL**: bundling Stockfish makes the app GPLv3 (provide source + license). If the app must
  stay closed-source, run Stockfish server-side instead (an `/api/bestmove` endpoint) — no
  GPL obligation on the app binary; the `src/stockfish.ts` adapter shape stays the same.
- **Real device**: same dev build, installed via Xcode or EAS — Expo Go won't work (native module).
