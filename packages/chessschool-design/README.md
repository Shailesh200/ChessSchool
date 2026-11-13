# @chessschool/design

Shared by `apps/chessschool`, `apps/chessschool-web` and `apps/chessschool-api`: tokens, icons, copy, progress/streak/rank/merge logic, API types + client, and every generated asset.

```bash
pnpm --filter @chessschool/design test       # contrast, progress, merge, session handoff
pnpm --filter @chessschool/design generate   # rebuild everything in assets/
```

## Assets

| Path | Source script | What |
|------|---------------|------|
| `assets/lottie/cody/*.json` + `manifest.json` | `scripts/cody.mjs` | Cody (Storybook × Clay), 13 animations (bodymovin 5.7, 60 fps, 512²) |
| `assets/svg/cody.svg` | `scripts/cody.mjs` | Static rest pose (fallback, OG image) |
| `assets/lottie/fx/*.json` | `scripts/fx.mjs` | `xp-pop`, `streak-spark`, `stamp`, `error-shake`, `splash-mark` (256², no baked text) |
| `assets/sound/*.wav` | `scripts/sounds.mjs` | Synthesised cues: `tap`, `success`, `stamp`, `gentle-no`, `level-up` |
| `assets/raster/*` | `scripts/raster.mjs` | Store icons (copied from the published app), PWA icons, maskable, apple-touch, OG image |

`scripts/lottie-kit.mjs` holds the shared shape/keyframe helpers. All artwork is original and generated from code; nothing is hand-edited.

Preview every animation (with a reduced-motion toggle and a size ladder):

```bash
python3 -m http.server 3200   # from the repo root
# http://127.0.0.1:3200/packages/chessschool-design/scripts/preview.html
# frame strips: ...preview.html?strip=wave:0,18,30;celebrate:0,36,58
```

Reduced motion: never autoplay; show `codyPoster[name]` (frame) instead.

## Rig (for a Rive rebuild)

Layer tree, pivots in the 512×512 artboard:

```
root (256,474) scale 88%       — whole character, headroom for jumps
├─ shadow (256,474)
├─ rig (256,472)               — squash & stretch, jump
│  ├─ armL (180,324)  rest 16°   armR (332,324)  rest −16°
│  ├─ body (256,472)           — base, bell, collar
│  └─ head (256,306)           — tilt
│     ├─ eyes (256,212)        — blink = scaleY 8%; look = translate
│     ├─ eyesClosed / hearts   — alternate eye sets
│     ├─ mouth variants        — smile · open · wow · frown · side · tiny
│     └─ cap (256,96)
│        ├─ tasselCord
│        └─ tassel (382,100)   — secondary motion, always lags the head
└─ extras                      — stars, ?, Zzz, sweat, tears, floating hearts
```

Rive state machine to build: one `Idle` base state with a random blink, plus triggers `wave`, `celebrate`, `wow` (return to Idle) and booleans `thinking`, `sad`, `sleepy`, `happy`. Eyes and mouth as a nested artboard with one input `expression` (0 smile, 1 open, 2 wow, 3 frown, 4 side, 5 tiny) so any body motion can combine with any face. Drop the exported `cody.riv` in `assets/rive/`; the apps should prefer it when present and fall back to Lottie.
