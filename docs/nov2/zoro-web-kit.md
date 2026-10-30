# nov2/zoro-web-kit — Premium Illustrated design kit

Branch integrates the attached **web-kit-src** into `apps/web` as the default UI. Screen-level HTML mocks remain in `/workspace/design-kit` (extracted locally); production code lives under `apps/web/app/premium/` and `apps/web/public/kit/`.

## Screenshots

Playwright browsers were not installed in the cloud VM; capture locally:


| Viewport | Route | Notes |
|----------|-------|--------|
| 390×844 | `/dev/kit-showcase` | Mobile shell + component gallery |
| 1280×800 | `/dev/kit-showcase` | Sidebar shell (≥1024px) |

```bash
pnpm --filter web dev
# In another terminal:
pnpm --filter web exec playwright screenshot http://localhost:3000/dev/kit-showcase docs/nov2/kit-showcase-390.png --viewport-size=390,844
pnpm --filter web exec playwright screenshot http://localhost:3000/dev/kit-showcase docs/nov2/kit-showcase-1280.png --viewport-size=1280,800
```

## Done in this branch

- Kit tokens (`kit-tokens.css`) + legacy alias layer (`premium-aliases.css`) in `globals.css`
- Self-hosted fonts (Bricolage Grotesque, DM Sans, Noto Devanagari) via `@font-face`
- `uiKit` setting: **premium** (default) vs **legacy** rollback (Theme Studio)
- Premium light/dark via `data-theme` (Midnight app theme → dark; others → light)
- Color-blind + high-contrast variants preserved
- App shell: bottom tabs &lt;1024px, sidebar ≥1024px
- Shared components restyled: Button, Card, chips, TopBar, BottomNav, Sheet, ConfirmDialog, Toaster, ProgressBar, EmptyState, Logo, CoachAvatar polish
- Vitest pins for token mapping + ui kit switch (`core/themes/kitTokens.test.ts`)

## Left for follow-up screen branches

- Replace inline `Icon.tsx` paths with kit SVG sprite where names align
- Full `components.css` parity (path nodes, feedback bars, board chrome)
- Lottie UI wiring from `public/kit/lottie-ui`
- Per-screen migration vs `design-kit/screens/*.html`
- Theme Studio copy when premium collapses app/school pickers to light/dark only

## Kit gaps (local decisions)

- **Nav icons**: kept existing React `Icon` set; kit Lucide SVGs copied to `public/kit/icons` for later sprite work
- **EmptyState `review`**: uses `empty.webp` (kit has no separate review empty)
- **Desktop sidebar search row**: retained command palette affordance (not in static kit chrome)
- **Legacy Logo crest**: icon-only mode still uses simplified SVG crest
