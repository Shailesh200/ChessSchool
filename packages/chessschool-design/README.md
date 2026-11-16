# @chessschool/design

Shared by `apps/chessschool`, `apps/chessschool-web` and `apps/chessschool-api`: tokens, icons, copy, progress/streak/rank/merge logic, API types + client, and every generated asset.

```bash
pnpm --filter @chessschool/design test       # contrast, progress, merge, session handoff
pnpm --filter @chessschool/design generate   # rebuild everything in assets/
```

## Assets

| Path | Source script | What |
|------|---------------|------|
| `assets/lottie/cody/*.json` + `manifest.json` | delivered artwork | Chaukor, the mascot: 10 animations (60 fps, 512², shape layers only). Old pose names alias to these in `src/mascot.ts` |
| `assets/svg/cody.svg` | delivered artwork | Chaukor's rest pose (fallback, share cards, web icons, OG image) |
| `assets/lottie/fx/*.json` | `scripts/fx.mjs` | `xp-pop`, `streak-spark`, `stamp`, `error-shake`, `splash-mark` (256², no baked text) |
| `assets/sound/*.wav` | `scripts/sounds.mjs` | Synthesised cues: `tap`, `success`, `stamp`, `gentle-no`, `level-up` |
| `assets/raster/*` | `scripts/raster.mjs` | Store icons (copied from the published app), Chaukor favicon, PWA icons, maskable, apple-touch, OG image |

`scripts/lottie-kit.mjs` holds the shared shape/keyframe helpers. FX, sounds and rasters are generated from code; the Chaukor files are delivered artwork, copied in as they are.

Preview every animation (with a reduced-motion toggle and a size ladder):

```bash
python3 -m http.server 3200   # from the repo root
# http://127.0.0.1:3200/packages/chessschool-design/scripts/preview.html
# frame strips: ...preview.html?strip=wave:0,18,30;celebrate:0,36,58
```

Reduced motion: never autoplay; show `codyPoster[name]` (frame) instead. One-shot clips settle back to `idle` when they finish.
