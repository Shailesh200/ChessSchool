# nov2 web lesson kit parity (`nov2/zoro-web-lesson`)

Premium lesson player aligned to design-kit screens **05a–08**, **06a/b**, **07** at **390px** and **1280px** width. Layout breakpoint for coach/board side-by-side matches kit **`lgrid` at 900px** (`min-width: 900px` and `min-height: 560px` in kit CSS; web applies side-by-side from **900px** width in `globals.css`).

## Screenshots

Captured under [`shots/`](./shots/) (kit static HTML vs running web app).

| Screen | Kit reference | Kit shot (390 / 1280) | Web shot (390 / 1280) | Notes |
|--------|---------------|------------------------|------------------------|-------|
| Showcase | — | — | `web-kit-showcase-{390,1280}.png` | Shell/tokens QA |
| 05a intro | `design-kit/screens/05a-lesson-intro.html` | `kit-05a-lesson-intro-*.png` | `web-05a-lesson-intro-*.png` | Live board vs kit SVG board |
| 05b drill | `05b-lesson-drill.html` | `kit-05b-lesson-drill-*.png` | `web-05b-lesson-drill-*.png` | After “Got it”; disabled Check bar |
| 05c tap squares | `05c-lesson-tap-squares.html` | `kit-05c-lesson-tap-squares-*.png` | *(kit HTML only in this pass)* | Web uses `ringSquares` on live board for tap/highlight steps |
| 05d why quiz | `05d-lesson-why-quiz.html` | `kit-05d-lesson-why-quiz-*.png` | *(kit HTML only)* | Quiz uses `PreschoolQuiz` + kit footer on correct |
| 06a correct bar | `06a-bar-correct.html` | `kit-06a-bar-correct-*.png` | *(manual move capture deferred)* | Manual Continue; lottie success + xp-pop |
| 06b wrong bar | `06b-bar-wrong.html` | `kit-06b-bar-wrong-*.png` | *(manual move capture deferred)* | Try again / Show me |
| 07 hint | `07-hint.html` | `kit-07-hint-*.png` | *(kit HTML only)* | Hint ladder + hintline in `.lx` |
| 08 complete | `08-lesson-complete.html` | `kit-08-lesson-complete-*.png` | *(complete via unit tests)* | Week strip, daily goal, quote, dynamic xp-pop |

Regenerate web captures:

```bash
pnpm --filter web build
pnpm exec playwright install chromium   # if needed; does not change lockfile
pnpm --filter web exec playwright test e2e/nov2-lesson-shots.spec.ts
```

## Behaviour pinned by tests

- `lessonKitXp.test.ts` — dynamic xp-pop id + duration formatting
- `lessonManualAdvance.test.ts` — correct bar waits for Continue (no timer auto-advance)
- `LessonPlayer.finish.test.tsx` — intro uses **Got it**
- `lessonKit.test.tsx` — fbar correct/wrong, hint ladder, complete shell (week, quote, daily goal)
- `LessonKitFooter` + `KitLottie` coverage in `lessonKit.test.tsx`

## Known remaining gaps

- **CeremonyOverlay** still wraps lesson complete (graduation/exam flows).
- **Opponent reply** after a correct move auto-advances to the next step after the reply animation when the student presses Continue once (kit uses fully manual stepping).
- **Loader / logo-splash** lotties are wired in `KitLottie` but not shown on lesson routes (splash/loaders belong to other flows).
