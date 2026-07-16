# ChessSchool verification scripts

Run before every milestone **owner approval** and **merge to main**.

## Primary command

```bash
pnpm verify:milestone
```

Runs, in order:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm --filter web format:check`
4. `bash scripts/verify-test-coverage.sh` — unit coverage ≥90% (scoped modules)
5. `pnpm build`
6. `node scripts/verify-e2e-route-coverage.mjs` — e2e covers ≥90% of `web-e2e-routes.json`
7. `bash scripts/verify-web-seo.sh` — static SEO baseline (Next.js)
8. `pnpm --filter web db:fresh`
9. `pnpm e2e` — Playwright smoke + route tests
10. `node scripts/verify-home-js-budget.mjs` — home route JS ≤280 KB gzip (app chunks)
11. `bash scripts/verify-web-lighthouse.sh` — Lighthouse + CWV on every route *(every 5th milestone merge; owner may skip intervening slices)*

**Milestone handoffs:** paste the verification report gate table. Include the **Lighthouse summary + CWV table** on every **5th milestone merge**; otherwise note `SKIP_LIGHTHOUSE=1` and owner approval.

## Escape hatches (document in milestone handoff if used)

| Env var | Effect |
|---------|--------|
| `SKIP_LIGHTHOUSE=1` | Skip Lighthouse — OK on non-audit milestones when owner approves; required on every 5th merge |

## Individual commands

```bash
pnpm verify:coverage      # unit tests + 90% thresholds
pnpm verify:e2e-routes    # e2e route manifest only
pnpm verify:web-seo       # static SEO checks
pnpm verify:web-lighthouse # production build + all routes → reports/lighthouse/index.html
pnpm verify:web           # SEO + Lighthouse
```

## Route manifests

| File | Purpose |
|------|---------|
| `scripts/web-e2e-routes.json` | Routes that **must** have Playwright `page.goto` coverage (≥90%) |
| `scripts/web-lighthouse-routes.json` | Routes audited for Performance, A11y, BP, SEO |

When adding a **new web route**, update both manifests and add e2e tests in `apps/web/e2e/`.

## Coverage scope (≥90%)

| Surface | Scoped paths |
|---------|----------------|
| **Web** | `lib/api-schemas.ts`, `features/lessons/unlock.ts` (+ expand as tests added) |
| **Mobile** | `src/chess-utils.ts`, `src/progress-utils.ts`, `packages/progression`, `packages/core` |
| **New logic** | Add to scoped includes in `vitest.config.ts` when introducing packages/modules |

## Lighthouse tiers

See `scripts/web-lighthouse-routes.json` → `tiers` (critical / public / app).  
All routes enforce **Accessibility, Best Practices, SEO ≥90** (app tier SEO min 80).
