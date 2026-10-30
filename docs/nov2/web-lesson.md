# nov2 web lesson kit parity (`nov2/zoro-web-lesson`)

Premium lesson player aligned to design-kit screens **05a–08**, **06a/b**, **07** at **390px** and **1280px** width. Side-by-side coach/board layout uses kit **`lgrid` at 900px** (`min-width: 900px` in `globals.css`).

## QA (no screenshots in git)

Compare kit HTML under local `design-kit/screens/` to web `/dev/lesson-kit?screen=05a` … `08` at 390 and 1280. Capture only to artifact storage, e.g.:

```bash
pnpm --filter web build
PORT=3210 pnpm --filter web start &
SCREENSHOT_OUT_DIR=/opt/cursor/artifacts/zoro-shots node apps/web/scripts/capture-lesson-shots.mjs
```

## Behaviour pinned by tests

- `lessonLayoutBreakpoint.test.ts` — side-by-side layout at 900px
- `lessonOpponentReplyManual.test.tsx` — opponent reply needs a second Continue (no auto-advance)
- `lessonKitScreenMatch.test.tsx` — kit `data-screen` markers for 05a–08 dev fixtures
- `lessonManualAdvance.test.tsx` — correct bar waits for Continue
- `lessonKit.test.tsx` — footer bars, hint ladder, complete shell
- `KitRouteLoader` — loader / loader-dark on map loading + lesson `loading.tsx`; logo-splash on `/splash`

## Known remaining gaps

- **CeremonyOverlay** still wraps lesson complete (graduation/exam flows).
- **Live board** vs kit static SVG board on tap-square steps (rings on live `ChessBoard`).
