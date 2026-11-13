# ChessSchool v2 — Phase 1 (product shell)

Branch `feat/phase1-new-chessschool`. Phase 2 (chess + return loop) is in [PHASE2.md](PHASE2.md); rows below marked locked are open now. New code only; `apps/web` and `apps/mobile` (the live 0.3.x product) are untouched.

| Package | What |
|---------|------|
| `packages/chessschool-design` | Tokens, icons, copy, progress/streak/rank/merge logic, API types + client, Cody (Storybook × Clay) + effects + sounds + icons (generated) |
| `apps/chessschool-api` | Hono + Drizzle/libSQL API (new `cs_*` schema) |
| `apps/chessschool-web` | Next.js 16 PWA — desktop + mobile web |
| `apps/chessschool` | Expo SDK 54 / Expo Router 6 — iOS + Android (`com.chessschool.app`, 0.4.0) |

## Run it

```bash
pnpm install
pnpm cs:api                  # API on :3300 (SQLite file apps/chessschool-api/local.db)
pnpm cs:web                  # web on :3100 (proxies /v1/* to the API)
EXPO_PUBLIC_API_URL=http://10.0.2.2:3300 pnpm cs:native   # Android emulator; iOS sim: http://localhost:3300
pnpm cs:check                # typecheck all four + unit tests
```

## Routes

| Screen | Web | Native | Notes |
|--------|-----|--------|-------|
| Splash | `/` | `index` | 1.5 s Cody + mark, then Today (account or seen welcome) or Welcome |
| Welcome (4 steps) | `/welcome` | `welcome` | Hi → who's learning → daily minutes → start as guest / I have an account. Skip always visible |
| Log in | `/login` | `login` | Email + password, Google when configured, guest link |
| Sign up | `/signup` | `signup` | Name (pre-filled from guest), email, password; guest progress merges |
| Learn (Today) | `/today` | `(tabs)/today` | Greeting, rank/level, streak + XP chips, hero lesson, path of 6, rank curve, daily goal ring, save card |
| Orientation | `/orientation` | `orientation` (full-screen modal) | 3 beats, then seal + "+10 XP" + "Welcome to the school!" |
| Rooms | `/rooms` | `(tabs)/rooms` | Play · Practice · Club, each locked with a promise + "Remind me" |
| Room detail | `/rooms/[id]` (`/play`, `/practice`, `/club` redirect) | `rooms/[id]` | Locked room with a way back to Learn |
| Profile (You) | `/you` | `(tabs)/you` | Avatar, Guest/Member badge, stats, save banner, name, daily goal |
| Settings | `/settings` | `settings` | Appearance, sounds, haptics (native), daily reminder, account, legal, reset device, version |
| Terms | `/terms` | `terms` (modal) | Stub + privacy link |
| Privacy | `/privacy` → chess-school.in/privacy | opens in-app browser | |
| Offline | `/offline` (service-worker fallback) | banner | |
| 404 | any unknown URL | `+not-found` | |

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/v1/health` | — | Liveness |
| POST | `/v1/auth/register` | — | `{name,email,password,guest?}` → user, profile, merged progress, token + httpOnly cookie |
| POST | `/v1/auth/login` | — | `{email,password,guest?}` (merges guest progress) |
| POST | `/v1/auth/google` | — | `{idToken,guest?}`; links to an existing email account |
| POST | `/v1/auth/logout` | cookie/Bearer | Deletes the session |
| GET/PATCH | `/v1/me` | ✓ | Name, who, daily minutes, appearance, sound |
| GET | `/v1/home?day=YYYY-MM-DD` | ✓ | Personalised shell: name, streak, XP, today's node, path states, rooms |
| PUT | `/v1/progress` | ✓ | Sanitised max-merge; never loses completions |

Sessions: 32-byte random token, SHA-256 stored, 30 days; httpOnly SameSite=Lax cookie on web, Bearer + SecureStore on native. Auth routes rate-limited (12/min per IP+route).

## Local state

`chessschool.v2.state` (localStorage / AsyncStorage): guest id, welcome seen, profile, prefs, progress, account, ceremony flag, room reminders, reminder-offered flag. Hydration tolerates junk and old versions. Guest → account: `guestPayload()` → server merge → `applyAuth()` merges again locally.

## Verified

Web (`apps/chessschool-web/e2e/phase1.mjs`, Chrome via Playwright) — passes:
- Mobile 390×844, light **and** dark: splash → welcome (all 4 steps) → guest Today → orientation → done ceremony → reminder sheet once → reload keeps progress → rooms reminder → name + goal → settings → reset sheet → sign-up validation → sign up keeps name + orientation + "progress saved" → reload → Member profile → sign out → wrong password → log in → reset device → fresh welcome.
- Desktop 1440×900 light + dark, tablet 900: rail layouts.
- Reduced motion: no running CSS animations; Lottie on poster frames.
- API down: banner, guest Today works, sign-up shows the offline message. 404.
- No horizontal overflow on any screen; no console errors or hydration warnings.
- Production build + `e2e/offline.mjs`: service worker active, Learn/Rooms/Profile open offline.

Native (`apps/chessschool/scripts/phase1-android.sh`, Android 15 emulator, Expo Go 54) — passes:
- Same guest → orientation → reminder → rooms → name → dark mode → reset sheet → sign up (keeps name + progress, ceremony) → Member → sign out → wrong-password flow, driven through accessibility labels with "remove animations" on (reduced motion).
- Force-stop + relaunch: name, XP, streak kept. Emulator reboot + API stopped: banner, guest Today with progress.

Unit tests: 58 in the design package (contrast, orientation, streak, rank, merge, sanitise, hydrate, guest→account), 14 in the API (register/login/logout, Google create/link/Google-only, rate limit, me, home, progress merge + anti-inflation).

## Not done / needs you

- **iOS**: no iOS simulator is installed on this machine, so iOS was not run. The app has no iOS-specific code paths beyond the Expo defaults.
- **Google Sign-In**: web button renders when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set; the server needs `GOOGLE_CLIENT_IDS`. Native Google needs a dev/EAS build (not Expo Go); in Expo Go the button hides itself. Not exercised end-to-end with a real Google account.
- **Hosting**: the API is not deployed. Create a new Turso database (free tier, separate from production) and set `DATABASE_URL`/`DATABASE_AUTH_TOKEN`; set `EXPO_PUBLIC_API_URL` in EAS env for preview/production (deliberately absent from `eas.json` so builds never point at the old API). Without it the native app runs in on-device guest mode.
- **Daily reminder** is a permission + preference only; scheduling the notification is Phase 2.
- **Rive**: Cody ships as Lottie; the Rive brief is in the design package README.
- Nothing is committed beyond the checkpoint of the previous branch.
