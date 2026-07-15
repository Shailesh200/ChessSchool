# M-072 — Visual Regression & Storybook

**Status:** Verified (2026-07-16)  
**Gate:** G-WebGA  
**Branch:** `milestone/M-072-visual-regression`

## Scope

Establish a Storybook catalog for core UI primitives and Playwright screenshot
gates on key guest-safe routes — the visual baseline before Web GA (M-073).

## Deliverables

| Item | Action |
|------|--------|
| `apps/web/.storybook/` | Storybook 8 + `@storybook/react-vite` (Next 16 is outside `@storybook/nextjs` 8 peer range) |
| `*.stories.tsx` | Button, Card, EmptyState, ProgressBar, Toggle, Logo |
| `apps/web/e2e/visual.spec.ts` | Playwright `toHaveScreenshot` on 5 routes |
| `e2e/visual.spec.ts-snapshots/` | Committed PNG baselines (Pixel 7, OS-agnostic names) |
| `apps/web/storybook-static/` | Gitignored build artifact |

## Routes under visual gate

| Route | Landmark |
|-------|----------|
| `/` | Landing h1 |
| `/login` | Welcome back + Email |
| `/academy` | Daily goal |
| `/themes` | Theme Studio |
| `/settings` | `#settings-sound` |

## Commands

```bash
pnpm --filter web storybook          # interactive catalog
pnpm --filter web build-storybook    # static build → storybook-static/
pnpm --filter web e2e -- visual.spec.ts
# After intentional UI changes:
pnpm --filter web e2e -- visual.spec.ts --update-snapshots
```

## Verification checklist

- [x] Storybook loads UI stories with globals.css tokens
- [x] `build-storybook` succeeds
- [x] `visual.spec.ts` passes with committed baselines
- [x] Unrelated mobile/parity WIP not included in this branch
- [x] Owner approval → merge to `main`

## Out of scope

- Chromatic / paid visual cloud
- Mobile native screenshots
- Full route catalog / dual viewport baselines
- M-073 launch runbook
