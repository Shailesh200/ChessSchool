# nov2 web lesson kit parity (`nov2/zoro-web-lesson`)

Premium lesson player aligned to design-kit screens **05a–08**, **06a/b**, **07** at **390px** and **1280px** width. Layout breakpoint for coach/board side-by-side matches kit **`lgrid` at 900px** (`min-width: 900px` in `globals.css`).

## Screenshots

Captured under [`shots/`](./shots/) (kit static HTML vs running web app). Widths **390** and **1280** px.

| Screen | Kit reference | Kit shot (390 / 1280) | Web shot (390 / 1280) | Notes |
|--------|---------------|------------------------|------------------------|-------|
| Showcase | — | — | `web-kit-showcase-{390,1280}.png` | Shell/tokens QA |
| 05a intro | `design-kit/screens/05a-lesson-intro.html` | `kit-05a-lesson-intro-*.png` | `web-05a-lesson-intro-*.png` | Live board vs kit SVG board |
| 05b drill | `05b-lesson-drill.html` | `kit-05b-lesson-drill-*.png` | `web-05b-lesson-drill-*.png` | After “Got it”; disabled Check bar |
| 05c tap squares | `05c-lesson-tap-squares.html` | `kit-05c-lesson-tap-squares-*.png` | — | Web uses `ringSquares` on live board (no static route yet) |
| 05d why quiz | `05d-lesson-why-quiz.html` | `kit-05d-lesson-why-quiz-*.png` | — | Quiz step needs a dedicated lesson fixture for shots |
| 06a correct bar | `06a-bar-correct.html` | `kit-06a-bar-correct-*.png` | — | Manual Continue after a scored move (not in shot spec yet) |
| 06b wrong bar | `06b-bar-wrong.html` | `kit-06b-bar-wrong-*.png` | — | Try again / Show me (not in shot spec yet) |
| 07 hint | `07-hint.html` | `kit-07-hint-*.png` | — | Hint ladder in `.lx` (kit HTML reference only) |
| 08 complete | `08-lesson-complete.html` | `kit-08-lesson-complete-*.png` | — | Complete UI covered by unit tests |

Regenerate:

```bash
pnpm --filter web build
pnpm --filter web exec playwright install chromium   # local cache only; lockfile unchanged
CI=1 pnpm --filter web exec playwright test e2e/nov2-lesson-shots.spec.ts
```

Kit HTML paths assume `design-kit/screens/` at repo root (local extract; not committed).

## Behaviour pinned by tests

- `lessonLayoutBreakpoint.test.ts` — side-by-side layout at 900px
- `lessonKitXp.test.ts` — dynamic xp-pop id + duration formatting
- `lessonManualAdvance.test.tsx` — correct bar waits for Continue (no timer auto-advance on move)
- `LessonPlayer.finish.test.tsx` — intro uses **Got it**
- `lessonKit.test.tsx` — fbar correct/wrong, hint ladder, complete shell (week, quote, daily goal)
- `ChessBoard.rings.test.tsx` — `ringSquares` inset ring styles

## Known remaining gaps

- **CeremonyOverlay** still wraps lesson complete (graduation/exam flows).
- **Opponent reply** after Continue on a correct move still auto-advances following the reply animation (kit is fully manual between steps).
- **Loader / logo-splash** lotties are wired in `KitLottie` but not shown on lesson routes.
- **Playwright web captures** for 05c–08, 06a/b — add routes/fixtures to `nov2-lesson-shots.spec.ts` when stable lesson URLs exist.
