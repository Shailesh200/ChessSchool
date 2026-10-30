# nov2/sanji-web-a — Premium screen migration

Branch builds tier-1/2 **screen UIs** on **`origin/nov2/zoro-web-kit-rc`** (`2c139c3` on `rc/nov2` `b30c2af`). Uses kit tokens, `AppShell`, and `uiKit` (`premium` | `legacy`).

## Password reset

- **Email link (Luffy `nov2/luffy-backend-rc`):** `{origin}/account/reset?token=` — routes live on that branch (`apps/web/app/account/reset/`, `apps/web/app/forgot-password/`); do not add those paths here.
- **UI (premium dex):** `/login/forgot` (19a), `/login/reset` (19b, `?token=` for local QA).
- **After luffy merge:** in his route files, swap body to `<PremiumForgotPasswordScreen />` / `<PremiumResetPasswordScreen />` from `@/features/premium-ui/screens/passwordResetPremiumScreens`.
- **Client shim:** `apps/web/features/premium-ui/auth/resetApi.ts` (then swap to `@/lib/auth/passwordReset.client` + `@/lib/auth/password-reset-path`)
  - `POST /api/auth/password/forgot` `{ email }`
  - `POST /api/auth/password/reset` `{ token, password }`
  - No GET validate (invalid link shown when POST returns 400).

## Nav

Learn · Play · Review · Profile (kit shell).

## Screenshots vs design

PNG captures are **not committed** (Arc review artifacts live outside the repo). Keep them locally under e.g. `design-ref/captures/premium-screens/` or any path set via `SCREENSHOT_OUT_DIR`. Design reference PNGs: `design-ref/png/` (local). Regenerate:

```bash
pnpm --filter web dev
node apps/web/scripts/capture-web-screenshots.mjs
```

| App screenshot | Design reference | Deviations |
|----------------|------------------|------------|
| `01-splash-{390,1280}.png` | `01-splash*.png` | Uses kit horizontal logo; no Lottie hero loop yet. |
| `16-auth-login-*` | `16-auth-*` | Premium dex auth on `/login`; errors/signup variants not shot separately. |
| `19a-forgot-password-*` | `19a-forgot-password-*` | Matches dex layout; backend generic message when luffy not merged. |
| `19b-reset-password-*` | `19b-reset-password-*` | Query token on `/login/reset`; strength meter live; invalid link on POST 400. |
| `03-map-*` | `03-map*` | Normal/dark from catalog; other states via `?premiumMap=`; inside kit AppShell (not full mock sidebar duplicate). |
| `04-class-detail-*` | `04-class-detail*` | Mastery sidebar simplified vs mock skill rows; exam row links real `/exam`. |
| `09-class-exam-*` | `09-class-exam*` | Premium header chrome + real `LessonPlayer` (board layout differs from static mock). |
| `13-profile-*` | `13-profile*` | Inside AppShell; no dark profile variant shot. |
| `14-settings-*` | `14-settings*` | `uiKit` toggle mirrors Theme Studio. |
| `15-notify-*` | `15-notify*` | Functional toggles; saved state on `/notify/saved` not in batch. |

## Home JS budget

Run after `pnpm --filter web build`:

```bash
node scripts/verify-home-js-budget.mjs
```

Budget: **320 KB gzip**. Last measure on this branch: **316.5 KB gzip** (`node scripts/verify-home-js-budget.mjs` after `pnpm --filter web build`).

## Branches

| Branch | Role |
|--------|------|
| `nov2/sanji-web-a-rc` | **Canonical** — kit-rc + screen commits |
| `nov2/sanji-web-a` | Obsolete local replay (not pushed) |

## Public assets

`apps/web/public/premium/assets/` holds dex full-body art, coach Lottie `.js` bundles, map loader stills, and exam piece SVGs. Coach **heads** and static accents use `apps/web/public/kit/` (see `screens-dex.css`). SHA-256 audit vs `public/kit/`: no byte-identical duplicates; premium-only files stay under `premium/assets/`.
