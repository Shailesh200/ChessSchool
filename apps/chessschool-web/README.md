# chessschool-web

ChessSchool v2 for desktop and mobile web — Next.js 16 App Router PWA. Not the live `apps/web`.

```bash
pnpm --filter chessschool-api dev   # API on :3300 first
pnpm --filter chessschool-web dev   # http://localhost:3100
pnpm --filter chessschool-web e2e   # Phase 1 walkthrough → /tmp/cs-shots (needs both servers + Chrome)
node e2e/phase3.mjs /tmp/p3         # Phase 3: Gym, Puzzles, Looks, achievements, feedback, delete account
```

- `/v1/*` is rewritten to `CHESSSCHOOL_API_URL` (default `http://localhost:3300`) so the session cookie is first-party.
- Design assets are copied from `packages/chessschool-design/assets` into `public/assets` on `dev`/`build` (gitignored).
- The service worker (`public/sw.js`) registers in production builds only (or with `?sw=1`). Check offline behaviour with `next build && next start --port 3101` then `node e2e/offline.mjs`.

| Variable | Purpose |
|----------|---------|
| `CHESSSCHOOL_API_URL` | API origin for the rewrite |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Shows the Google button (same web client ID as the old app) |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs for OG metadata |
