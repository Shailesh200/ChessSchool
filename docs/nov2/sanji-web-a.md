# nov2/sanji-web-a — Premium screen migration

Branch builds tier-1/2 **screen UIs** on **`origin/nov2/zoro-web-kit-rc`** (`2c139c3` on `rc/nov2` `b30c2af`). Uses kit tokens, `AppShell`, and `uiKit` (`premium` | `legacy`).

## Password reset

- **Email link (Luffy W-004):** `{origin}/account/reset?token=` — see `password-reset.ts` on `nov2/luffy-backend`.
- **UI:** `/login/forgot` (19a dex), `/account/reset` (19b dex). `/login/reset` redirects to `/account/reset` (query + hash preserved).
- **Client shim:** `apps/web/features/premium-ui/auth/resetApi.ts` (swap to `@/lib/auth/passwordReset.client` after luffy merge)
  - `POST /api/auth/password/forgot` `{ email }`
  - `POST /api/auth/password/reset` `{ token, password }`
  - No GET validate (invalid link shown when POST returns 400).

## Nav

Learn · Play · Review · Profile (kit shell).

## Screenshots vs design

Captured under [`sanji-web-a/`](sanji-web-a/) (390×844 and 1280×800). Design PNGs: `design-ref/png/` (local). Regenerate:

```bash
pnpm --filter web dev
node apps/web/scripts/capture-sanji-screenshots.mjs
```

| App screenshot | Design reference | Deviations |
|----------------|------------------|------------|
| `01-splash-{390,1280}.png` | `01-splash*.png` | Uses kit horizontal logo; no Lottie hero loop yet. |
| `16-auth-login-*` | `16-auth-*` | Premium dex auth on `/login`; errors/signup variants not shot separately. |
| `19a-forgot-password-*` | `19a-forgot-password-*` | Matches dex layout; backend generic message when luffy not merged. |
| `19b-reset-password-*` | `19b-reset-password-*` | Token in hash; strength meter live; no server validate until POST. |
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
