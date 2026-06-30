# Native Stockfish — integration plan (`feat/native-stockfish`)

Goal: the app plays at true **web/chess.com strength** by bundling the real **Stockfish** C++ engine (same engine the web uses, capped to the chosen ELO), instead of the in-house JS bot. This requires a **dev build** (Expo Go can't load native modules).

## Status (what's done — committed on this branch)
- ✅ **JS engine adapter** (`src/stockfish.ts`): UCI command builder, `bestmove` parser, `eloToUci` strength mapping (`UCI_Elo` ≥1320, `Skill Level` below), safety timeout. Unit-tested (`src/stockfish.test.ts`, 9 tests).
- ✅ **Wired** into `app/play/game.tsx`: uses native Stockfish for every level when present, **falls back to the JS engine** (so Expo Go / web still work).
- ✅ **Native module scaffold** (`modules/stockfish/`): JS interface (`index.ts`), Expo module config, Swift module (`ios/StockfishModule.swift` — pipe-based UCI bridge), `Stockfish.podspec`, bridging header.
- ✅ **Improved JS engine** (`packages/core/src/engine/bot.ts`) as the offline fallback (quiescence + opening book + iterative deepening; no more piece-hanging). Tested (`src/bot.test.ts`).
- ✅ Toolchain installed: **CocoaPods 1.16.2**, **xcodes 2.0.2**.

## Remaining (needs Xcode — your Apple ID required)

### 1. Install Xcode (only you can — Apple ID + 2FA)
~40 GB; **only ~52 GB free, so free up space first**. Either:
```bash
xcodes install --latest        # prompts for your Apple ID + 2FA
# …or install "Xcode" from the Mac App Store, then:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch      # installs the iOS Simulator runtime + accepts the license
```

### 2. Add the Stockfish engine source (GPLv3 — see license note)
```bash
cd apps/mobile/modules/stockfish/ios
mkdir -p engine
# Stockfish 16.1 source (src/*.cpp,*.h) → engine/, and the NNUE net → engine/*.nnue
curl -L https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_16.1.tar.gz | tar xz
cp Stockfish-sf_16.1/src/*.cpp Stockfish-sf_16.1/src/*.h engine/
# download the matching .nnue referenced in evaluate.h (EvalFileDefaultName) into engine/
```
(If the office proxy blocks the download, fetch from a personal network.)

### 3. Build the dev build + run in the simulator
```bash
cd apps/mobile
npx expo prebuild -p ios            # generates ios/, autolinks modules/stockfish
npx expo run:ios                    # builds + boots the dev build in the simulator
```

### 4. Verify (I do this once Xcode is in)
```bash
xcrun simctl io booted screenshot stockfish.png    # real native screenshot
# + a Maestro flow: open Play → vs Bot 1800 → confirm the bot makes strong moves
```
`src/stockfish.ts` logs nothing by default; add a temporary `console.log` on `stockfish-output` if you want to watch UCI traffic in the Metro logs.

## How strength maps to web
- ≥1320 ELO → `UCI_LimitStrength true` + `UCI_Elo <n>` (Stockfish's own Elo-limited play).
- <1320 → `Skill Level 0–20`.
- `go movetime 700` (≈0.7 s/move) — strong + responsive. Bump for harder play.
This is identical to how lichess/chess.com cap Stockfish, so move quality matches web.

## ⚠️ Licensing — important
Stockfish is **GPL-3.0**. Bundling it makes the app a GPL work: you must (a) license the app's source under GPLv3-compatible terms, (b) include the Stockfish `Copying.txt`, and (c) make the corresponding source available to users. If that's not acceptable for a closed-source app, the alternative is the **server-side `/api/bestmove`** approach (Stockfish runs on your server; the app only receives moves — no GPL obligation on the app binary).

## Fallback guarantee
If the native module is absent or errors, `getBotMove` uses the improved JS engine — so the app never breaks in Expo Go, on web, or if a build issue arises.
