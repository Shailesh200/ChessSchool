# Native Stockfish — integration plan (`feat/native-stockfish`)

Goal: the app plays at true **web/chess.com strength** by bundling the real **Stockfish** C++ engine (same major release the web uses, capped to the chosen ELO), instead of the in-house JS bot. This requires a **dev build** (Expo Go can't load native modules).

## iOS builds fetch the engine (do not commit it)

`modules/stockfish/ios/engine/` is gitignored (GPLv3 sources plus the NNUE nets). A clean checkout has no engine, so the pod cannot link `stockfish_cpp_main` until the files are fetched.

`scripts/fetch-stockfish.sh` downloads a **pinned** release and the two nets `src/evaluate.h` names, checks SHA-256, and only then replaces `engine/`. A bad download or a checksum mismatch exits 1 and leaves any previous tree in place.

| Pin | Value |
|---|---|
| Release | Stockfish 18, tag [`sf_18`](https://github.com/official-stockfish/Stockfish/releases/tag/sf_18) (2026-01-31). Same major version as the web WASM build. |
| Source tarball | `https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_18.tar.gz` |
| Source SHA-256 | `22a195567e3493e7c9ca8bf8fa2339f4ffc876384849ac8a417ff4b919607e7b` |
| Big net | `nn-c288c895ea92.nnue` — 108,919,594 bytes. SHA-256 `c288c895ea924429ea9092e3f36b2b3c1f00f2a3a4c759ff7e57e79e3b43e4a7` |
| Small net | `nn-37f18f62d772.nnue` — 3,519,630 bytes. SHA-256 `37f18f62d772f3107e1d6aaca3898c130c3c86f2ab63e6555fbbca20635a899d` |

Nets are fetched from `https://tests.stockfishchess.org/api/nn/<name>`, then `https://github.com/official-stockfish/networks/raw/master/<name>` if the first mirror fails. The filename's 12 hex chars are the leading bytes of that SHA-256 (Stockfish's own naming rule); the script also checks the full digest.

**EAS.** `apps/mobile/package.json` hook `eas-build-pre-install` runs the script. EAS sets `EAS_BUILD_PLATFORM`. The script fetches only when that is `ios` or unset (a local run). Android EAS builds exit 0 immediately and do not download. The hook runs before `pod install`, which is when `Stockfish.podspec` globs `engine/**/*.{cpp,h}`. The `.nnue` files are not pod resources; `incbin` reads them at compile time through `-I engine`.

**Local iOS** (simulator or device), from `apps/mobile`:

```bash
bash scripts/fetch-stockfish.sh          # or: pnpm fetch-stockfish
npx expo prebuild -p ios
npx expo run:ios
```

Re-running the script is a no-op when the stamp and both net checksums still match.

**Where the files land** (all gitignored):

- `modules/stockfish/ios/engine/` — `src/` tree (`main.cpp`, `nnue/`, `incbin/`, `syzygy/`, …)
- `modules/stockfish/ios/engine/*.nnue` — the two nets, next to the sources so `incbin` finds them via `-I engine`
- `modules/stockfish/ios/engine/Copying.txt` — Stockfish's own GPLv3 text
- `modules/stockfish/ios/engine/AUTHORS` — Stockfish's own credits

`ios/stockfish-config.h` (committed) is force-included by the podspec. It turns on the upstream Makefile profile without editing fetched sources: arm64 gets `USE_NEON=8` and `USE_POPCNT` (ARCH=armv8, no dotprod — iOS 15.1 still includes A9–A11), x86_64 simulator gets SSE4.1 + popcnt. `main` is still renamed to `stockfish_cpp_main` for the shim.

**App size.** The big net is 108,919,594 bytes and the small net is 3,519,630 bytes, **112,439,224 bytes (~108 MiB)** together. `network.cpp` embeds both with `incbin`. That embedded image is the only copy in the app: the podspec does not ship `engine/*.nnue` as resources, and nothing looks for the nets on the iOS bundle path. `Network::load` uses the embedded data when `EvalFile` / `EvalFileSmall` are the default names (`<internal>`). Its file fallbacks are the process working directory and the binary's directory, and the Swift bridge never sends an `EvalFile` path. The C++ sources add under 1 MiB. Uncompressed engine payload is about **108 MiB** before App Store thinning and compression.

The JS adapter in `src/stockfish.ts` is unchanged. If the native module is missing (Expo Go, web, Android) `nativeBestMove` returns null and `getBotMove` uses the in-house JS engine. That fallback is a safety net, not the iOS build path.

## ✅ VERIFIED WORKING (in the iOS Simulator)
Native Stockfish builds, links, runs, and **drives the bot on a real iOS Simulator**. Proof from the Metro logs while playing a vs-Bot game:
```
LOG  [bot-engine] stockfish=true nativeMove=e7e6 elo=300
LOG  [bot-engine] stockfish=true nativeMove=f8e7 elo=300
```
`stockfish=true` → the native module loaded; the moves are Stockfish's, capped to the chosen ELO. The chessboard also matches web (classic = Cburnett Staunton pieces).

See **"Run in the iOS Simulator"** below for the exact, reproducible steps (and the gotchas hit along the way).

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

### 2. Fetch the pinned Stockfish 18 sources
Do not curl a release by hand. From `apps/mobile`:

```bash
bash scripts/fetch-stockfish.sh
```

That writes `modules/stockfish/ios/engine/` (sources, both NNUE nets, `Copying.txt`, `AUTHORS`). See **iOS builds fetch the engine** above for the pin, checksums, and the EAS hook. The simulator log at the top of this file was captured against an earlier hand-dropped Stockfish 16.1 tree; new builds use `sf_18`. `SIMULATOR.md` still shows that old manual curl — use the script instead.

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

## Licensing
Shipping native Stockfish on iOS is approved under **GPLv3**, with this app's code kept public.

- Stockfish's own `Copying.txt` (the GPLv3 text) and `AUTHORS` are downloaded next to the engine sources by `scripts/fetch-stockfish.sh`. They are not compiled and they are not committed.
- Engine source that was actually built: [Stockfish `sf_18`](https://github.com/official-stockfish/Stockfish/releases/tag/sf_18).
- Full licence text, also linked from `Copying.txt`: <https://www.gnu.org/licenses/gpl-3.0.txt>
- Corresponding source for ChessSchool: <https://github.com/Shailesh200/ChessSchool>

The in-app licence screen is a separate change. This build step only makes the upstream `Copying.txt` and `AUTHORS` available beside the fetched sources.

## Fallback guarantee
If the native module is absent or errors, `getBotMove` uses the improved JS engine — so the app never breaks in Expo Go, on web, or if a build issue arises.
