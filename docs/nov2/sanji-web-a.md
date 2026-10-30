# nov2/sanji-web-a — Premium screen migration

Branch builds tier-1/2 **screen UIs** on top of **`nov2/zoro-web-kit`** (`origin/nov2/zoro-web-kit` @ 58e9108+). Uses kit tokens (`app/premium/*.css`), shared shell (`AppShell` + `SidebarNav` / `BottomNav` at 1024px), and `uiKit` (`premium` | `legacy`) — not a parallel `uiShell` or duplicate shell components.

## Rebase notes

- **Base:** `origin/nov2/zoro-web-kit-rc` @ `2c139c3` (Zoro kit on `rc/nov2` `b30c2af`). Do not replay `58e9108` locally.
- **Dropped duplicates:** `PremiumAppShell`, local `styles/premium/tokens.css` + `components.css`, duplicate fonts/logo/accents under `public/premium/assets` (art now under `public/kit/` where possible). Dex **bust/full** art remains under `public/premium/assets/dex/` until kit adds equivalents.

## Password reset (19a / 19b)

- Routes: `/login/forgot`, `/login/reset` (Suspense on reset for `useSearchParams`).
- UI: `PremiumForgotPasswordScreen`, `PremiumResetPasswordScreen` + `PremiumAuthDexLayout` (`data-screen="19a-forgot-password"` / `19b-reset-password`).
- **Client API only** (backend on `nov2/luffy-backend`): `apps/web/lib/auth/passwordReset.client.ts`
  - `POST /api/auth/password/forgot`
  - `GET /api/auth/password/reset?token=`
  - `POST /api/auth/password/reset`
  - 404 stubs allow UI dev until luffy lands.

## Nav

Four tabs only (kit shell): **Learn**, **Play**, **Review**, **Profile**.

## Screenshots (390 / 1280)

Design PNGs: extracted auth pack under `design-ref/` (local, not committed).

| Screen | Route | Status |
|--------|-------|--------|
| Forgot entry | `/login/forgot` | **Owed** — capture vs `19a-forgot-password` PNG |
| Reset form | `/login/reset?token=dev` | **Owed** — vs `19b-reset-password` PNG |
| Splash | `/splash` | **Owed** |
| Kit reference | `/dev/kit-showcase` | See `docs/nov2/zoro-web-kit.md` |

Playwright Chromium was attempted in cloud VM; if install fails, capture locally:

```bash
pnpm --filter web dev
pnpm --filter web exec playwright install chromium
pnpm --filter web exec playwright screenshot http://localhost:3000/login/forgot docs/nov2/sanji-forgot-390.png --viewport-size=390,844
pnpm --filter web exec playwright screenshot http://localhost:3000/login/forgot docs/nov2/sanji-forgot-1280.png --viewport-size=1280,800
```

## Deviations (known)

- Coach picker hidden in onboarding (`data-coach-picker="hidden"`), Otto default.
- Profile/settings premium layouts render **inside** kit `AppShell` (no duplicate dex sidebar).
- Some onboarding/academy loader stills use `public/premium/assets/lottie-ui` until kit Lottie wiring (M zoro follow-up).
