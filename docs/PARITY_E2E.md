# PWA ↔ iOS parity E2E

Side-by-side verification of **mobile web (PWA @ 393×852)** vs **native iOS Simulator** for layout, copy, navigation, fonts, and colors.

## Quick start (local)

### One-time setup

1. **Xcode + iOS Simulator** — see [`apps/mobile/SIMULATOR.md`](../apps/mobile/SIMULATOR.md)
2. **Maestro CLI** — `curl -Ls "https://get.maestro.mobile.dev" | bash`
3. **Dev client on simulator** (includes native modules):

   ```bash
   cd apps/mobile
   EXPO_PUBLIC_API_URL=http://localhost:3210 npx expo run:ios
   ```

4. **Root deps** — `pnpm install`

### Run full parity suite

```bash
pnpm parity:ios
```

This will:

1. Start web @ `:3210` (if not already running)
2. Seed the parity fixture account (`parity@chess-school.local` / `ParityPass1!`)
3. Start Metro (if needed)
4. Guest screens run first (one cold boot), then signed-in screens (one API login via Maestro):
   - Capture **PWA** screenshot (Playwright, mobile viewport)
   - Capture **native** screenshot (Maestro deep links + `simctl` screenshot)
   - Pixel-diff + side-by-side composite
5. Write HTML report → **`parity/reports/index.html`** (all 18 rows)

### Run a single screen

```bash
PARITY_SCREEN=settings pnpm parity:compare
```

(Requires web + Metro + sim already running.)

### Semantic-only (fast, no simulator)

```bash
pnpm --filter web db:fresh
pnpm parity:semantic
```

## Screen matrix

Defined in [`scripts/parity-routes.json`](../scripts/parity-routes.json) — 18 screens covering tabs, class, lesson, play, settings, auth-only hubs, etc.

| Field | Meaning |
|-------|---------|
| `auth: guest \| user` | Guest browse vs parity fixture login |
| `threshold` | `default` 8% · `strict` 4% · `semanticOnly` skip visual diff |
| `semantic` | Copy/labels that must appear on **both** surfaces |
| `web.path` | PWA route |
| `native.steps` | Maestro navigation (tabs, hub testIDs, deep links) |

Add a screen: edit the JSON → `pnpm parity:generate` → extend `apps/web/e2e/parity-matrix.spec.ts` (auto-loops manifest) → add mobile `testID`s if needed.

## CI

[`.github/workflows/parity-ios.yml`](../.github/workflows/parity-ios.yml):

| Job | Runner | When | Blocks merge |
|-----|--------|------|--------------|
| `parity-semantic` | Ubuntu | PR + push | Yes |
| `parity-ios` | macOS | PR + push | Yes |
| `parity-ios-prod` | macOS | Nightly cron | No (artifact only) |

Set GitHub secrets for nightly prod: `PARITY_EMAIL`, `PARITY_PASSWORD`.

## Reports

After a run, open `parity/reports/index.html`:

- **PASS/FAIL** per screen
- **Drift %** (pixel mismatch / viewport)
- **Side-by-side** composite (web left · native right)
- `results.json` for tooling

## Honest limits

- **Not pixel-identical** — Fredoka metrics, RN shadows, and flex rounding differ slightly; thresholds encode that.
- **Audio / haptics / animations** — not compared; use device checklist.
- **Google OAuth** — excluded; parity uses email/password fixture.
- **Admin-only** routes (playground) — omitted from v1 matrix.

## Commands

```bash
pnpm parity:generate   # Regenerate Maestro flows from manifest
pnpm parity:seed       # Upsert fixture account on running API
pnpm parity:compare    # Screenshot + diff (web + sim must be up)
pnpm parity:ios        # Full local orchestrator
pnpm parity:semantic   # Playwright semantic matrix (PWA only)
pnpm verify:parity     # Manifest ↔ Maestro ↔ Playwright coverage
```
